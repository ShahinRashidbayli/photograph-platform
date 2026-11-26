package com.photographplatform.api.contract.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.booking.service.BookingQueryService;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.exception.UnauthorizedException;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.common.util.Normalize;
import com.photographplatform.api.contract.domain.Contract;
import com.photographplatform.api.contract.domain.ContractStatus;
import com.photographplatform.api.contract.dto.ContractResponse;
import com.photographplatform.api.contract.dto.CreateContractRequest;
import com.photographplatform.api.contract.dto.SignContractRequest;
import com.photographplatform.api.contract.dto.UpdateContractRequest;
import com.photographplatform.api.contract.event.ContractSentEvent;
import com.photographplatform.api.contract.event.ContractSignedEvent;
import com.photographplatform.api.contract.repository.ContractRepository;
import com.photographplatform.api.entitlement.domain.Capability;
import com.photographplatform.api.entitlement.service.EntitlementService;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The contract lifecycle, from draft to signature.
 *
 * <p>This orchestrates; the rules live on {@link Contract}. Whether a contract
 * may still be edited, what a signature must record, and which transitions are
 * legal are all decided by the entity, so a second caller cannot reach a state
 * this service happens to guard against.
 *
 * <p>Plan-gated on {@link Capability#CONTRACTS} (Pro). The gate is applied to
 * the photographer's write paths only — a customer signing a contract they were
 * sent is never refused because the photographer's subscription lapsed
 * afterwards. Taking a document away from the person who was asked to sign it
 * would be a worse outcome than serving one unpaid-for read, and the money has
 * already been made at the point it was sent.
 */
@Service
public class ContractService {

    /** The audit row's new value when a contract went out with a personal note. */
    public static final String SENT_WITH_A_NOTE = "sent with a note";

    private final ContractRepository contractRepository;
    private final BookingRepository bookingRepository;
    private final BookingQueryService bookingQueryService;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final EntitlementService entitlementService;
    private final ContractPdfRenderer pdfRenderer;
    private final AuditService auditService;
    private final ApplicationEventPublisher eventPublisher;
    private final Clock clock;

    public ContractService(ContractRepository contractRepository,
                           BookingRepository bookingRepository,
                           BookingQueryService bookingQueryService,
                           TenantRepository tenantRepository,
                           UserRepository userRepository,
                           EntitlementService entitlementService,
                           ContractPdfRenderer pdfRenderer,
                           AuditService auditService,
                           ApplicationEventPublisher eventPublisher,
                           Clock clock) {
        this.contractRepository = contractRepository;
        this.bookingRepository = bookingRepository;
        this.bookingQueryService = bookingQueryService;
        this.tenantRepository = tenantRepository;
        this.userRepository = userRepository;
        this.entitlementService = entitlementService;
        this.pdfRenderer = pdfRenderer;
        this.auditService = auditService;
        this.eventPublisher = eventPublisher;
        this.clock = clock;
    }

    // ── photographer side ─────────────────────────────────────────────────────

    /**
     * Opens a draft against a booking, pre-filled unless the caller supplied
     * their own text.
     */
    @Transactional
    public ContractResponse createForBooking(UUID bookingId, CreateContractRequest request, String ip) {
        UUID tenantId = SecurityUtils.requireCurrentTenantId();
        entitlementService.requireCapabilityForCurrentTenant(Capability.CONTRACTS);

        Booking booking = requireOwnBooking(bookingId, tenantId);
        Tenant tenant = tenantRepository.findById(tenantId)
            .orElseThrow(() -> new NotFoundException("Tenant not found"));

        if (booking.getStatus().isNotHappening()) {
            throw new ConflictException(
                "Cannot draft a contract for a "
                    + booking.getStatus().name().toLowerCase(java.util.Locale.ROOT) + " booking");
        }

        // One live contract per booking. A second one does not clarify which
        // terms are in force, it obscures it — and the photographer's actual
        // intent ("replace the one I sent") is served by cancelling first,
        // which leaves a trail of what happened.
        boolean alreadyLive = contractRepository.existsByBookingIdAndStatusIn(
            bookingId, List.of(ContractStatus.DRAFT, ContractStatus.SENT, ContractStatus.SIGNED));
        if (alreadyLive) {
            throw new ConflictException(
                "This booking already has a contract. Cancel it before drafting another.");
        }

        String recipientEmail = booking.getClientEmail();
        if (recipientEmail == null || recipientEmail.isBlank()) {
            throw new ConflictException(
                "This booking has no client email — a contract has nobody to send to");
        }

        String title = blankToNull(request.title()) != null
            ? request.title().trim()
            : ContractDraftTemplate.defaultTitle(booking);
        String body = blankToNull(request.body()) != null
            ? request.body()
            : ContractDraftTemplate.render(booking, tenant);

        Contract contract = contractRepository.save(new Contract(
            tenantId,
            bookingId,
            title,
            body,
            booking.getClientName() == null ? recipientEmail : booking.getClientName(),
            recipientEmail
        ));

        auditService.logQuietly("CONTRACT_CREATED", "CONTRACT", contract.getId(),
            tenantId, SecurityUtils.requireCurrentUserId(), ip);
        return ContractResponse.from(contract);
    }

    @Transactional
    public ContractResponse update(UUID id, UpdateContractRequest request, String ip) {
        UUID tenantId = SecurityUtils.requireCurrentTenantId();
        entitlementService.requireCapabilityForCurrentTenant(Capability.CONTRACTS);

        Contract contract = requireOwn(id, tenantId);
        contract.edit(request.title().trim(), request.body());

        auditService.logQuietly("CONTRACT_UPDATED", "CONTRACT", id,
            tenantId, SecurityUtils.requireCurrentUserId(), ip);
        return ContractResponse.from(contract);
    }

    /**
     * Freezes the draft, makes it visible to the Customer and tells them so.
     *
     * <p>Refuses when the photographer has not filled in their statutory
     * identity. A contract naming no party is not a contract, and the legal
     * details were collected in Settings precisely so this could be answered
     * without asking again — see the tenant legal work (V33).
     *
     * @param personalNote the photographer's optional personal note; null for none
     */
    @Transactional
    public ContractResponse send(UUID id, String personalNote, String ip) {
        UUID tenantId = SecurityUtils.requireCurrentTenantId();
        entitlementService.requireCapabilityForCurrentTenant(Capability.CONTRACTS);

        Contract contract = requireOwn(id, tenantId);
        // Checked here as well as on the entity: the entity's refusal is an
        // IllegalStateException, which answers 500, and a double click on
        // "An Kunden senden" is a conflict, not a fault.
        requireStatus(contract, ContractStatus.DRAFT, "Only a draft contract can be sent");
        Tenant tenant = tenantRepository.findById(tenantId)
            .orElseThrow(() -> new NotFoundException("Tenant not found"));

        String issuerName = blankToNull(tenant.getLegalName());
        if (issuerName == null) {
            throw new ConflictException(
                "Add your legal details in Settings first — a contract has to say who is offering it");
        }

        Instant sentAt = clock.instant();
        contract.send(
            OffsetDateTime.ofInstant(sentAt, clock.getZone()),
            issuerName,
            ContractDraftTemplate.issuerAddress(tenant),
            blankToNull(tenant.getLegalEmail())
        );

        tellTheCustomer(contract, "CONTRACT_SENT", personalNote, sentAt, ip);
        return ContractResponse.from(contract);
    }

    /**
     * "Erneut senden": tells the Customer again about a contract that waits
     * for their signature. Changes nothing on the contract; its {@code
     * sentAt} stays the day it was first sent.
     *
     * @param personalNote the photographer's optional personal note; null for none
     */
    @Transactional
    public ContractResponse resend(UUID id, String personalNote, String ip) {
        UUID tenantId = SecurityUtils.requireCurrentTenantId();
        entitlementService.requireCapabilityForCurrentTenant(Capability.CONTRACTS);

        Contract contract = requireOwn(id, tenantId);
        requireStatus(contract, ContractStatus.SENT, "Only a contract waiting for its signature can be sent again");

        tellTheCustomer(contract, "CONTRACT_RESENT", personalNote, clock.instant(), ip);
        return ContractResponse.from(contract);
    }

    /**
     * Audits the send and publishes {@link ContractSentEvent}. The Customer's
     * language comes from the booking, through booking's service; the address
     * is the contract's recipient, the one address the portal shows it to.
     */
    private void tellTheCustomer(Contract contract, String action, String personalNote, Instant sentAt, String ip) {
        // A note is the photographer's words to one Customer: the trail says
        // that one was sent, never what it said.
        String trimmedNote = Normalize.trimToNull(personalNote);
        UUID actorId = SecurityUtils.requireCurrentUserId();
        if (trimmedNote == null) {
            auditService.logQuietly(action, "CONTRACT", contract.getId(), contract.getTenantId(), actorId, ip);
        } else {
            auditService.logChange(action, "CONTRACT", contract.getId(), contract.getTenantId(), actorId, ip,
                null, SENT_WITH_A_NOTE);
        }

        eventPublisher.publishEvent(new ContractSentEvent(
            this,
            contract.getId(),
            contract.getBookingId(),
            contract.getTenantId(),
            contract.getRecipientEmail(),
            contract.getRecipientName(),
            bookingQueryService.customerLanguage(contract.getBookingId()),
            trimmedNote,
            sentAt));
    }

    private static void requireStatus(Contract contract, ContractStatus expected, String message) {
        if (contract.getStatus() != expected) {
            throw new ConflictException(
                message + " (this one is " + contract.getStatus().name().toLowerCase(java.util.Locale.ROOT) + ")");
        }
    }

    @Transactional
    public ContractResponse cancel(UUID id, String ip) {
        UUID tenantId = SecurityUtils.requireCurrentTenantId();
        entitlementService.requireCapabilityForCurrentTenant(Capability.CONTRACTS);

        Contract contract = requireOwn(id, tenantId);
        contract.cancel(OffsetDateTime.now(clock));

        auditService.logQuietly("CONTRACT_CANCELLED", "CONTRACT", id,
            tenantId, SecurityUtils.requireCurrentUserId(), ip);
        return ContractResponse.from(contract);
    }

    @Transactional(readOnly = true)
    public List<ContractResponse> listForTenant() {
        UUID tenantId = SecurityUtils.requireCurrentTenantId();
        return contractRepository.findByTenantIdOrderByCreatedAtDesc(tenantId)
            .stream().map(ContractResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<ContractResponse> listForBooking(UUID bookingId) {
        UUID tenantId = SecurityUtils.requireCurrentTenantId();
        return contractRepository.findByBookingIdAndTenantIdOrderByCreatedAtDesc(bookingId, tenantId)
            .stream().map(ContractResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public ContractResponse get(UUID id) {
        return ContractResponse.from(requireOwn(id, SecurityUtils.requireCurrentTenantId()));
    }

    // ── customer side ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ContractResponse> listForCustomer() {
        return contractRepository.findVisibleToCustomer(currentCustomerEmail())
            .stream().map(ContractResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public ContractResponse getForCustomer(UUID id) {
        return ContractResponse.from(requireVisibleToCustomer(id));
    }

    /**
     * Records the customer's signature.
     *
     * <p>Not capability-gated: see the class note. The entity refuses anything
     * that is not a SENT contract, and the optimistic lock on it turns two
     * concurrent submits into one winner and one retry rather than two
     * signatures over the same document.
     */
    @Transactional
    public ContractResponse sign(UUID id, SignContractRequest request, String ip, String userAgent) {
        User user = currentCustomer();
        Contract contract = contractRepository
            .findVisibleToCustomer(id, Normalize.email(user.getEmail()))
            .orElseThrow(() -> new NotFoundException("Contract not found: " + id));

        contract.sign(
            request.typedName().trim(),
            user.getId(),
            ip,
            truncate(userAgent, 500),
            OffsetDateTime.now(clock)
        );

        auditService.logQuietly("CONTRACT_SIGNED", "CONTRACT", id,
            contract.getTenantId(), user.getId(), ip);

        userRepository.findOwnerByTenantId(contract.getTenantId()).ifPresent(owner ->
            eventPublisher.publishEvent(new ContractSignedEvent(
                this,
                contract.getId(),
                contract.getTenantId(),
                contract.getBookingId(),
                contract.getTitle(),
                contract.getSignerName(),
                owner.getEmail()
            )));

        return ContractResponse.from(contract);
    }

    // ── PDF ───────────────────────────────────────────────────────────────────

    /** The photographer's copy. */
    @Transactional(readOnly = true)
    public byte[] renderPdf(UUID id) {
        return pdfRenderer.render(
            ContractPdfTemplate.render(requireOwn(id, SecurityUtils.requireCurrentTenantId())));
    }

    /** The customer's copy — same document, different ownership check. */
    @Transactional(readOnly = true)
    public byte[] renderPdfForCustomer(UUID id) {
        return pdfRenderer.render(ContractPdfTemplate.render(requireVisibleToCustomer(id)));
    }

    /** Filename for either copy, safe to put in a Content-Disposition header. */
    public String pdfFilename(ContractResponse contract) {
        String base = contract.title().replaceAll("[^A-Za-z0-9-_ ]", "").trim();
        if (base.isEmpty()) {
            base = "Vertrag";
        }
        return base.replace(' ', '_') + ".pdf";
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private Contract requireOwn(UUID id, UUID tenantId) {
        return contractRepository.findByIdAndTenantId(id, tenantId)
            .orElseThrow(() -> new NotFoundException("Contract not found: " + id));
    }

    private Contract requireVisibleToCustomer(UUID id) {
        return contractRepository.findVisibleToCustomer(id, currentCustomerEmail())
            .orElseThrow(() -> new NotFoundException("Contract not found: " + id));
    }

    private Booking requireOwnBooking(UUID bookingId, UUID tenantId) {
        Booking booking = bookingRepository.findById(bookingId)
            .orElseThrow(() -> new NotFoundException("Booking not found: " + bookingId));
        if (!tenantId.equals(booking.getTenantId())) {
            // Same answer as a missing row: confirming that an id exists under
            // some other tenant is itself a leak.
            throw new NotFoundException("Booking not found: " + bookingId);
        }
        return booking;
    }

    private User currentCustomer() {
        return userRepository.findById(SecurityUtils.requireCurrentUserId())
            .orElseThrow(() -> new UnauthorizedException("Authentication required"));
    }

    private String currentCustomerEmail() {
        return Normalize.email(currentCustomer().getEmail());
    }

    private static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        return value.trim().isEmpty() ? null : value;
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}
