package com.photographplatform.api.inquiry.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.service.BookingConversionService;
import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.exception.UnauthorizedException;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.common.util.Normalize;
import com.photographplatform.api.common.util.Paging;
import com.photographplatform.api.inquiry.domain.InquiryRequest;
import com.photographplatform.api.inquiry.domain.InquiryStatus;
import com.photographplatform.api.inquiry.dto.CreateInquiryRequest;
import com.photographplatform.api.inquiry.dto.InquiryRequestResponse;
import com.photographplatform.api.inquiry.event.InquiryCreatedEvent;
import com.photographplatform.api.inquiry.event.InquiryDecidedEvent;
import com.photographplatform.api.inquiry.repository.InquiryRequestRepository;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.time.Duration;
import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import com.photographplatform.api.common.security.RateLimiter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
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
     * Ordered by {@code createdAt}, then by id.
     *
     * <p>The tie-breaker is not decoration. Postgres promises no order among
     * rows a sort cannot separate, and a studio's bookings cluster hard on a
     * date — a Saturday in June is not two bookings, it is twenty. Without a
     * second key the same row can appear on two pages and another on none,
     * which the clients here read as duplicated and missing bookings rather
     * than as an unstable sort.
     */
    private static final Sort NEWEST_FIRST =
        Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));

    /**
     * Bounds inquiry spam from an authenticated customer. Generous enough that a
     * genuine customer refining a request (or contacting a photographer about a
     * second event) is never blocked, tight enough that a compromised account
     * can't flood the photographer's inbox.
     */
    private static final int MAX_PER_CUSTOMER_PER_HOUR = 5;

    /** The audit row's new value when a decision went out with a personal note. */
    public static final String SENT_WITH_A_NOTE = "sent with a note";
    private static final Duration RATE_WINDOW = Duration.ofHours(1);

    private final InquiryRequestRepository inquiryRepository;
    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final AuditService auditService;
    private final ApplicationEventPublisher eventPublisher;
    private final RateLimiter rateLimiter;
    private final BookingConversionService bookingConversionService;
    private final Clock clock;

    public InquiryRequestService(InquiryRequestRepository inquiryRepository,
                                 UserRepository userRepository,
                                 TenantRepository tenantRepository,
                                 AuditService auditService,
                                 ApplicationEventPublisher eventPublisher,
                                 RateLimiter rateLimiter,
                                 BookingConversionService bookingConversionService,
                                 Clock clock) {
        this.inquiryRepository = inquiryRepository;
        this.userRepository = userRepository;
        this.tenantRepository = tenantRepository;
        this.auditService = auditService;
        this.eventPublisher = eventPublisher;
        this.rateLimiter = rateLimiter;
        this.bookingConversionService = bookingConversionService;
        this.clock = clock;
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

        String score = calculateScore(
            req.budgetRange(), req.eventType(), req.proposedDate(), LocalDate.now(clock));

        InquiryRequest inquiry = new InquiryRequest(
            customerId,
            req.eventType(),
            req.budgetRange(),
            req.proposedDate(),
            Normalize.trimToNull(req.location()),
            Normalize.trimToNull(req.message()),
            score,
            "BIO_LINK"
        );
        inquiry.setTenantId(tenantId);
        inquiry.setLanguage(CustomerLanguage.fromCodeOrDefault(req.language()));
        InquiryRequest saved = inquiryRepository.save(inquiry);

        auditService.log("INQUIRY_CREATED", "INQUIRY_REQUEST", saved.getId(),
            tenantId, customerId, ipAddress);

        // Every value the email needs travels on the event, so the listener
        // queues it without a lookup.
        eventPublisher.publishEvent(new InquiryCreatedEvent(
            this,
            saved.getId(),
            tenantId,
            displayName(customer),
            customer.getEmail(),
            saved.getEventType(),
            saved.getBudgetRange(),
            saved.getProposedDate(),
            saved.getLocation(),
            score,
            tenant.getOwnerEmail(),
            // The Notification's recipient is the owner address; its account's language.
            userRepository.findByTenantIdAndEmail(tenantId, tenant.getOwnerEmail())
                .map(User::getLanguage)
                .orElse(CustomerLanguage.DEFAULT)
        ));

        return toResponse(saved, customer);
    }

    /**
     * The photographer's inbox — every inquiry in the tenant, newest first.
     *
     * <p>An unrecognised {@code status} is refused rather than filtered on: it
     * used to reach the repository as-is, so {@code ?status=PENDINGG} answered
     * an empty inbox — the same response as "nothing is waiting for you".
     */
    @Transactional(readOnly = true)
    public List<InquiryRequestResponse> listForPhotographer(String status, int page, int size) {
        Pageable pageable = Paging.of(page, size, NEWEST_FIRST);
        List<InquiryRequest> inquiries = (status == null || status.isBlank()
            ? inquiryRepository.findAllBy(pageable)
            : inquiryRepository.findByStatus(InquiryStatus.parse(status).name(), pageable)
        ).getContent();

        // Batch-load the customers for this page in one query rather than a
        // findById per inquiry (the old N+1). A missing user row still degrades
        // to an inquiry without contact details rather than blanking the inbox.
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
     * BOOKING_CREATED}. Rejecting moves it to {@code REJECTED}. Either way an
     * {@link InquiryDecidedEvent} tells the Customer, with the photographer's
     * optional personal note. The repository is tenant-scoped by RLS, so the
     * id can only ever resolve within the caller's own tenant.
     *
     * <p>The PENDING check is only meaningful because {@code InquiryRequest}
     * carries an {@code @Version} (V30). Two accepts arriving together both saw
     * PENDING, both passed, and one inquiry produced two bookings and two
     * "your inquiry was accepted" emails. The second write now fails with a
     * 409, and {@code uq_bookings_one_per_inquiry} refuses the duplicate
     * booking at the database as a backstop.
     */
    @Transactional
    public InquiryRequestResponse updateStatus(UUID id, String targetStatus, String note,
                                               String ipAddress) {
        UUID tenantId = SecurityUtils.requireCurrentTenantId();
        UUID actorId = SecurityUtils.requireCurrentUserId();

        InquiryStatus target = InquiryStatus.parseTarget(targetStatus);

        InquiryRequest inquiry = inquiryRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("Inquiry not found: " + id));

        InquiryStatus current = InquiryStatus.parse(inquiry.getStatus());
        if (current.isTerminal()) {
            throw new ConflictException(
                "This inquiry has already been "
                    + Normalize.lower(current.name()).replace('_', ' ') + ".");
        }

        // The inquiry carries only a customer_id; the booking (and the email)
        // need the actual contact details, so resolve the customer once here.
        User customer = userRepository.findById(inquiry.getCustomerId())
            .orElseThrow(() -> new NotFoundException("Customer not found for inquiry: " + id));

        boolean accepted = target == InquiryStatus.BOOKING_CREATED;
        UUID bookingId = accepted
            ? bookingConversionService.createFromInquiry(inquiry, customer, ipAddress).id()
            : null;
        inquiry.setStatus(target.name());
        InquiryRequest saved = inquiryRepository.save(inquiry);

        // The audit action names the decision the photographer made, not the
        // state it resolved to: "INQUIRY_ACCEPTED" is what the existing rows
        // say, and renaming it to match the enum would split the history of one
        // action across two names.
        //
        // A note is the photographer's words to one Customer: the trail says
        // that one was sent, never what it said.
        String personalNote = Normalize.trimToNull(note);
        String action = accepted ? "INQUIRY_ACCEPTED" : "INQUIRY_REJECTED";
        if (personalNote == null) {
            auditService.log(action, "INQUIRY_REQUEST", saved.getId(), tenantId, actorId, ipAddress);
        } else {
            auditService.logChange(action, "INQUIRY_REQUEST", saved.getId(), tenantId, actorId, ipAddress,
                null, SENT_WITH_A_NOTE);
        }

        eventPublisher.publishEvent(new InquiryDecidedEvent(
            this,
            saved.getId(),
            tenantId,
            customer.getEmail(),
            displayName(customer),
            saved.getLanguage(),
            accepted,
            bookingId,
            personalNote,
            clock.instant()));

        return toResponse(saved, customer);
    }

    /** The signed-in customer's own inquiries — scoped to their user id. */
    @Transactional(readOnly = true)
    public List<InquiryRequestResponse> listForCustomer(int page, int size) {
        UUID customerId = SecurityUtils.requireCurrentUserId();
        User customer = userRepository.findById(customerId)
            .orElseThrow(() -> new UnauthorizedException("Authentication required"));
        Pageable pageable = Paging.of(page, size, NEWEST_FIRST);
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
    /**
     * Scoring takes {@code today} rather than reading the clock, because the
     * time component is "how far out is this event" and that answer moves
     * daily. As a parameter the whole thing stays a pure function: a test can
     * pin the boundary between MED and HIGH at an exact date instead of
     * deriving its expectation from the same {@code now()} the implementation
     * uses, which asserts the code against itself and passes either way.
     */
    static String calculateScore(
        String budgetRange, String eventType, LocalDate proposedDate, LocalDate today) {
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
            long days = ChronoUnit.DAYS.between(today, proposedDate);
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
        rateLimiter.check("inquiry:rate:" + customerId, MAX_PER_CUSTOMER_PER_HOUR, RATE_WINDOW,
            "You've sent several requests recently. Please give your photographer "
                + "a moment to reply before sending another.");
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
            inquiry.getLanguage().code(),
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
}
