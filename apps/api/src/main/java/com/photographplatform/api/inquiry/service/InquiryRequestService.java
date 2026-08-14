package com.photographplatform.api.inquiry.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.service.BookingService;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.exception.TooManyRequestsException;
import com.photographplatform.api.common.exception.UnauthorizedException;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.common.util.HtmlEscape;
import com.photographplatform.api.inquiry.domain.InquiryRequest;
import com.photographplatform.api.inquiry.dto.CreateInquiryRequest;
import com.photographplatform.api.inquiry.dto.InquiryRequestResponse;
import com.photographplatform.api.inquiry.event.InquiryCreatedEvent;
import com.photographplatform.api.inquiry.repository.InquiryRequestRepository;
import com.photographplatform.api.notification.dto.EmailMessage;
import com.photographplatform.api.notification.email.EmailTemplate;
import com.photographplatform.api.notification.service.EmailService;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.time.Duration;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The authenticated-customer intake path (roadmap §4.5). A customer who arrived
 * from the photographer's bio link, signed in with a magic link, and filled the
 * request form lands here.
 *
 * <p>Why this is not just {@code LeadService}: a {@code Lead} is anonymous and
 * carries its own contact details in the body, so anyone can POST one. An
 * inquiry is submitted by a known, signed-in customer — identity comes from the
 * JWT and the body carries no contact fields at all. The two also speak
 * different vocabularies: the customer form uses the roadmap's German-facing
 * enums ({@code HOCHZEIT}, {@code UNDER_500}) while leads use the older English
 * set ({@code WEDDING}, {@code UNDER_200}), so their scorers cannot be shared
 * without one of them lying about its inputs.
 */
@Service
public class InquiryRequestService {

    private static final Logger LOG = LoggerFactory.getLogger(InquiryRequestService.class);

    /**
     * Bounds inquiry spam from an authenticated customer. Generous enough that a
     * genuine customer refining a request (or contacting a photographer about a
     * second event) is never blocked, tight enough that a compromised account
     * can't flood the photographer's inbox.
     */
    private static final int MAX_PER_CUSTOMER_PER_HOUR = 5;
    private static final Duration RATE_WINDOW = Duration.ofHours(1);

    private final InquiryRequestRepository inquiryRepository;
    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final AuditService auditService;
    private final ApplicationEventPublisher eventPublisher;
    private final StringRedisTemplate redis;
    private final BookingService bookingService;
    private final EmailService emailService;

    public InquiryRequestService(InquiryRequestRepository inquiryRepository,
                                 UserRepository userRepository,
                                 TenantRepository tenantRepository,
                                 AuditService auditService,
                                 ApplicationEventPublisher eventPublisher,
                                 StringRedisTemplate redis,
                                 BookingService bookingService,
                                 EmailService emailService) {
        this.inquiryRepository = inquiryRepository;
        this.userRepository = userRepository;
        this.tenantRepository = tenantRepository;
        this.auditService = auditService;
        this.eventPublisher = eventPublisher;
        this.redis = redis;
        this.bookingService = bookingService;
        this.emailService = emailService;
    }

    /**
     * Persist an inquiry on behalf of the signed-in customer, score it, and
     * alert the photographer.
     *
     * <p>The customer id is taken from the JWT and the tenant from the request's
     * {@code TenantContext} — neither is accepted from the body, so a customer
     * cannot file a request as somebody else or against another photographer.
     */
    @Transactional
    public InquiryRequestResponse create(CreateInquiryRequest req, String ipAddress) {
        UUID customerId = SecurityUtils.requireCurrentUserId();
        UUID tenantId = SecurityUtils.requireCurrentTenantId();

        enforceRateLimit(customerId);

        User customer = userRepository.findById(customerId)
            .orElseThrow(() -> new UnauthorizedException("Authentication required"));
        Tenant tenant = tenantRepository.findById(tenantId)
            .orElseThrow(() -> new UnauthorizedException("Authentication required"));

        String score = calculateScore(req.budgetRange(), req.eventType(), req.proposedDate());

        InquiryRequest inquiry = new InquiryRequest(
            customerId,
            req.eventType(),
            req.budgetRange(),
            req.proposedDate(),
            blankToNull(req.location()),
            blankToNull(req.message()),
            score,
            "BIO_LINK"
        );
        inquiry.setTenantId(tenantId);
        InquiryRequest saved = inquiryRepository.save(inquiry);

        auditService.log("INQUIRY_CREATED", "INQUIRY_REQUEST", saved.getId(),
            tenantId, customerId, ipAddress);

        // The listener is @Async, so TenantContext is already gone by the time it
        // runs — every value it needs travels on the event itself.
        eventPublisher.publishEvent(new InquiryCreatedEvent(
            this,
            saved.getId(),
            displayName(customer),
            customer.getEmail(),
            saved.getEventType(),
            saved.getBudgetRange(),
            saved.getProposedDate(),
            saved.getLocation(),
            score,
            tenant.getOwnerEmail()
        ));

        return toResponse(saved, customer);
    }

    /** The photographer's inbox — every inquiry in the tenant, newest first. */
    @Transactional(readOnly = true)
    public List<InquiryRequestResponse> listForPhotographer(String status, int page, int size) {
        var pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<InquiryRequest> result = status == null || status.isBlank()
            ? inquiryRepository.findAll(pageable)
            : inquiryRepository.findByStatus(status, pageable);

        // Batch-load the customers for this page in one query rather than a
        // findById per inquiry (the old N+1). A missing user row still degrades
        // to an inquiry without contact details rather than blanking the inbox.
        List<InquiryRequest> inquiries = result.getContent();
        Set<UUID> customerIds = inquiries.stream()
            .map(InquiryRequest::getCustomerId)
            .collect(Collectors.toSet());
        Map<UUID, User> customersById = userRepository.findAllById(customerIds).stream()
            .collect(Collectors.toMap(User::getId, Function.identity()));

        return inquiries.stream().map(inquiry -> {
            User customer = customersById.get(inquiry.getCustomerId());
            if (customer == null) {
                LOG.warn("Inquiry {} references missing customer {}",
                    inquiry.getId(), inquiry.getCustomerId());
            }
            return toResponse(inquiry, customer);
        }).toList();
    }

    /**
     * Photographer triage of a fresh inquiry, reachable only from {@code
     * PENDING}. Accepting converts the inquiry into a booking in one step
     * (roadmap §4.5.7): a booking is created in {@code ENQUIRY} from the
     * inquiry's basics — the photographer fills pricing on the booking
     * afterwards — and the inquiry moves to the terminal {@code
     * BOOKING_CREATED}. Rejecting moves it to {@code REJECTED}. Either way the
     * customer gets an email. The repository is tenant-scoped by RLS, so the
     * id can only ever resolve within the caller's own tenant.
     */
    @Transactional
    public InquiryRequestResponse updateStatus(UUID id, String targetStatus, String ipAddress) {
        UUID tenantId = SecurityUtils.requireCurrentTenantId();
        UUID actorId = SecurityUtils.requireCurrentUserId();

        String target = targetStatus == null ? "" : targetStatus.trim().toUpperCase();
        if (!target.equals("ACCEPTED") && !target.equals("REJECTED")) {
            throw new ConflictException("Unsupported status transition: " + targetStatus);
        }

        InquiryRequest inquiry = inquiryRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("Inquiry not found: " + id));

        if (!"PENDING".equals(inquiry.getStatus())) {
            throw new ConflictException(
                "This inquiry has already been " + inquiry.getStatus().toLowerCase().replace('_', ' ') + ".");
        }

        // The inquiry carries only a customer_id; the booking (and the email)
        // need the actual contact details, so resolve the customer once here.
        User customer = userRepository.findById(inquiry.getCustomerId())
            .orElseThrow(() -> new NotFoundException("Customer not found for inquiry: " + id));

        boolean accepted = target.equals("ACCEPTED");
        if (accepted) {
            bookingService.createFromInquiry(inquiry, customer, ipAddress);
            inquiry.setStatus("BOOKING_CREATED");
        } else {
            inquiry.setStatus("REJECTED");
        }
        InquiryRequest saved = inquiryRepository.save(inquiry);

        auditService.log("INQUIRY_" + target, "INQUIRY_REQUEST", saved.getId(),
            tenantId, actorId, ipAddress);

        notifyCustomerOfDecision(customer, accepted);

        return toResponse(saved, customer);
    }

    /** The signed-in customer's own inquiries — scoped to their user id. */
    @Transactional(readOnly = true)
    public List<InquiryRequestResponse> listForCustomer(int page, int size) {
        UUID customerId = SecurityUtils.requireCurrentUserId();
        User customer = userRepository.findById(customerId)
            .orElseThrow(() -> new UnauthorizedException("Authentication required"));
        var pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return inquiryRepository.findByCustomerId(customerId, pageable)
            .stream()
            .map(inquiry -> toResponse(inquiry, customer))
            .toList();
    }

    // ── scoring ───────────────────────────────────────────────────────────────

    /**
     * Rule-based score from roadmap §4.5.3 step 6: {@code HIGH} requires budget
     * ≥ €500 AND the date more than 60 days out AND a wedding. Everything else
     * falls back to MED when either the budget or the lead time is strong on its
     * own, and LOW when neither is.
     *
     * <p>Component thresholds are expressed on the same 0–100 scale
     * {@code LeadService} uses, so the two intake paths stay legible side by
     * side even though their enum vocabularies differ.
     */
    static String calculateScore(String budgetRange, String eventType, LocalDate proposedDate) {
        int budget = switch (budgetRange == null ? "" : budgetRange) {
            case "OVER_2000" -> 100;
            case "1000_2000" -> 90;
            case "500_1000" -> 80;
            case "UNDER_500" -> 40;
            default -> 50;
        };
        int type = switch (eventType == null ? "" : eventType) {
            case "HOCHZEIT" -> 100;
            case "PORTRAIT", "FAMILIE" -> 70;
            case "EVENT" -> 60;
            default -> 50;
        };
        int time;
        if (proposedDate == null) {
            time = 50;
        } else {
            long days = ChronoUnit.DAYS.between(LocalDate.now(), proposedDate);
            if (days < 0) {
                time = 10;
            } else if (days < 30) {
                time = 40;
            } else if (days <= 60) {
                time = 70;
            } else {
                time = 100;
            }
        }

        // budget >= 80 is exactly "≥ €500"; time == 100 is exactly "> 60 days".
        if (budget >= 80 && type == 100 && time == 100) {
            return "HIGH";
        }
        if (budget >= 80 || time >= 70) {
            return "MED";
        }
        return "LOW";
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private void enforceRateLimit(UUID customerId) {
        String key = "inquiry:rate:" + customerId;
        Long count = redis.opsForValue().increment(key);
        if (count != null && count == 1) {
            redis.expire(key, RATE_WINDOW);
        }
        if (count != null && count > MAX_PER_CUSTOMER_PER_HOUR) {
            throw new TooManyRequestsException(
                "You've sent several requests recently. Please give your photographer "
                    + "a moment to reply before sending another.");
        }
    }

    /**
     * Email the customer the outcome of their inquiry. Best-effort by
     * construction: {@link EmailService#send} swallows and logs delivery
     * failures, so a mail problem can never roll back the booking that
     * acceptance just created.
     */
    private void notifyCustomerOfDecision(User customer, boolean accepted) {
        String subject = accepted
            ? "Your booking request was accepted"
            : "Update on your booking request";
        String message = accepted
            ? "Great news — your photographer accepted your request and started a booking. "
                + "They'll be in touch shortly to confirm the details."
            : "Thank you for reaching out. Unfortunately your photographer isn't able to take "
                + "this booking. We wish you the very best finding the right fit.";
        String html = EmailTemplate.document(
            accepted
                ? "Good news — your photographer accepted your request."
                : "An update on your booking request.",
            EmailTemplate.heading(subject)
                + EmailTemplate.paragraph("Hi " + HtmlEscape.escape(displayName(customer)) + ",")
                + EmailTemplate.paragraph(message));
        emailService.send(new EmailMessage(customer.getEmail(), subject, html));
    }

    private InquiryRequestResponse toResponse(InquiryRequest inquiry, User customer) {
        return new InquiryRequestResponse(
            inquiry.getId(),
            customer == null ? null : displayName(customer),
            customer == null ? null : customer.getEmail(),
            inquiry.getEventType(),
            inquiry.getBudgetRange(),
            inquiry.getProposedDate(),
            inquiry.getLocation(),
            inquiry.getMessage(),
            inquiry.getScore(),
            inquiry.getStatus(),
            inquiry.getSource(),
            inquiry.getCreatedAt()
        );
    }

    /**
     * Customers created just-in-time by the magic-link flow may have no name —
     * the email is the only handle we have, and it's better in the subject line
     * than a literal "null".
     */
    private static String displayName(User customer) {
        String name = customer.getFullName();
        return name == null || name.isBlank() ? customer.getEmail() : name;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
