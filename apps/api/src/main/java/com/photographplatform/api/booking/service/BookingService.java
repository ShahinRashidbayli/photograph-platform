package com.photographplatform.api.booking.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.domain.BookingStatus;
import com.photographplatform.api.booking.service.BookingPaymentStateResolver.Summary;
import com.photographplatform.api.booking.dto.BookingResponse;
import com.photographplatform.api.booking.dto.CreateBookingRequest;
import com.photographplatform.api.booking.dto.CustomerBookingResponse;
import com.photographplatform.api.booking.dto.UpdateBookingRequest;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.client.repository.ClientRepository;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.exception.UnauthorizedException;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.common.util.Normalize;
import com.photographplatform.api.inquiry.domain.InquiryRequest;
import com.photographplatform.api.lead.domain.Lead;
import com.photographplatform.api.lead.dto.ConvertLeadRequest;
import com.photographplatform.api.pricing.domain.Package;
import com.photographplatform.api.pricing.repository.PackageRepository;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BookingService {

    private final BookingRepository bookingRepository;
    private final ClientRepository clientRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;
    private final PackageRepository packageRepository;
    private final BookingPaymentStateResolver paymentStateResolver;

    public BookingService(
        BookingRepository bookingRepository,
        ClientRepository clientRepository,
        UserRepository userRepository,
        AuditService auditService,
        PackageRepository packageRepository,
        BookingPaymentStateResolver paymentStateResolver
    ) {
        this.bookingRepository = bookingRepository;
        this.clientRepository = clientRepository;
        this.userRepository = userRepository;
        this.auditService = auditService;
        this.packageRepository = packageRepository;
        this.paymentStateResolver = paymentStateResolver;
    }

    /**
     * Photographer-facing list of every booking in the tenant, optionally
     * filtered by status. Moved from BookingController to keep repository
     * access inside the service layer.
     */
    @Transactional(readOnly = true)
    public List<BookingResponse> listForPhotographer(String status, int page, int size) {
        var pageable = PageRequest.of(page, size, Sort.by("eventDate").ascending());
        List<Booking> bookings = (status != null && !status.isEmpty())
            ? bookingRepository.findByStatus(status, pageable).getContent()
            : bookingRepository.findByOrderByEventDateAsc(pageable).getContent();

        Map<UUID, Summary> paymentStates = paymentStateResolver.resolveAll(
            bookings.stream().map(Booking::getId).toList());
        return bookings.stream().map(b -> toResponse(b, paymentStates.get(b.getId()))).toList();
    }

    /**
     * Create a booking on behalf of the authenticated photographer. The booking
     * is always created in {@code ENQUIRY}; advancing it goes through
     * {@link #changeStatus} so the lifecycle state machine is the single place
     * that validates transitions.
     */
    @Transactional
    public BookingResponse createBooking(CreateBookingRequest request, String ipAddress) {
        UUID actorId = SecurityUtils.requireCurrentUserId();
        UUID tenantId = SecurityUtils.currentTenantId();

        // If the caller linked the booking to a directory client, make sure it
        // exists in *this* tenant (RLS scopes the lookup) — fail with 404
        // rather than persisting a dangling reference.
        if (request.clientId() != null && !clientRepository.existsById(request.clientId())) {
            throw new NotFoundException("Client not found: " + request.clientId());
        }

        Booking booking = new Booking(
            request.clientName().trim(),
            Normalize.email(request.clientEmail()),
            request.eventDate()
        );
        booking.setTenantId(tenantId);
        booking.setClientId(request.clientId());
        booking.setEventTime(request.eventTime());
        booking.setEventType(Normalize.trimToNull(request.eventType()));
        booking.setLocation(Normalize.trimToNull(request.location()));
        applyPricing(booking, request.packageId(), request.totalAmountCents(), request.depositAmountCents());
        booking.setInternalNotes(Normalize.trimToNull(request.internalNotes()));
        booking.setStatus(BookingStatus.ENQUIRY.name());

        Booking saved = bookingRepository.save(booking);

        auditService.log(
            "BOOKING_CREATED",
            "BOOKING",
            saved.getId(),
            tenantId,
            actorId,
            ipAddress
        );

        return toResponse(saved);
    }

    /**
     * Create a booking from an existing lead. Used by the lead-conversion
     * endpoint: the contact + event basics come from the lead, the
     * photographer fills in the operational fields (time, location, pricing)
     * via {@link ConvertLeadRequest}. The booking is linked back to the lead
     * through {@code leadId} so the audit trail and reporting can join them.
     *
     * <p>Always created in {@code ENQUIRY} for the same reason as the manual
     * create path: lifecycle changes must go through {@link #changeStatus}.
     */
    @Transactional
    public BookingResponse createFromLead(Lead lead, ConvertLeadRequest overrides, String ipAddress) {
        UUID actorId = SecurityUtils.requireCurrentUserId();
        UUID tenantId = SecurityUtils.currentTenantId();

        Booking booking = new Booking(
            lead.getName().trim(),
            Normalize.email(lead.getEmail()),
            lead.getEventDate()
        );
        booking.setTenantId(tenantId);
        booking.setLeadId(lead.getId());
        booking.setEventType(Normalize.trimToNull(lead.getEventType()));
        booking.setEventTime(overrides.eventTime());
        booking.setLocation(Normalize.trimToNull(overrides.location()));
        applyPricing(booking, overrides.packageId(), overrides.totalAmountCents(), overrides.depositAmountCents());
        booking.setInternalNotes(Normalize.trimToNull(overrides.internalNotes()));
        booking.setStatus(BookingStatus.ENQUIRY.name());

        Booking saved = bookingRepository.save(booking);

        auditService.log(
            "BOOKING_CREATED",
            "BOOKING",
            saved.getId(),
            tenantId,
            actorId,
            ipAddress
        );

        return toResponse(saved);
    }

    /**
     * Create a booking from an accepted customer inquiry. Contact details come
     * from the customer's own account, the event basics from the inquiry; the
     * photographer fills the operational fields (time, pricing) on the booking
     * afterwards. Always created in {@code ENQUIRY}, and linked back to the
     * inquiry via {@code inquiryId} so the funnel joins end to end.
     */
    @Transactional
    public BookingResponse createFromInquiry(InquiryRequest inquiry, User customer, String ipAddress) {
        UUID actorId = SecurityUtils.requireCurrentUserId();
        UUID tenantId = SecurityUtils.currentTenantId();

        String name = (customer.getFullName() == null || customer.getFullName().isBlank())
            ? customer.getEmail()
            : customer.getFullName();
        Booking booking = new Booking(
            name.trim(),
            Normalize.email(customer.getEmail()),
            inquiry.getProposedDate()
        );
        booking.setTenantId(tenantId);
        booking.setInquiryId(inquiry.getId());
        booking.setEventType(Normalize.trimToNull(inquiry.getEventType()));
        booking.setLocation(Normalize.trimToNull(inquiry.getLocation()));
        booking.setStatus(BookingStatus.ENQUIRY.name());

        Booking saved = bookingRepository.save(booking);

        auditService.log("BOOKING_CREATED", "BOOKING", saved.getId(), tenantId, actorId, ipAddress);

        return toResponse(saved);
    }

    /**
     * List the bookings owned by the currently authenticated customer.
     *
     * <p>The caller's identity is resolved from the JWT (not a request
     * parameter) and matched against the booking's {@code client_email}: this
     * is what closes the IDOR where a customer could read another customer's
     * bookings by supplying an arbitrary {@code clientId}. The result is mapped
     * to {@link CustomerBookingResponse}, which excludes the photographer's
     * internal notes.
     */
    @Transactional(readOnly = true)
    public List<CustomerBookingResponse> getOwnBookings(String rawStatus, int page, int size) {
        User user = userRepository.findById(SecurityUtils.requireCurrentUserId())
            .orElseThrow(() -> new UnauthorizedException("Authentication required"));
        String email = user.getEmail();

        Pageable pageable = PageRequest.of(page, size, Sort.by("eventDate").ascending());
        Page<Booking> result = (rawStatus != null && !rawStatus.isBlank())
            ? bookingRepository.findByClientEmailIgnoreCaseAndStatus(email, rawStatus, pageable)
            : bookingRepository.findByClientEmailIgnoreCaseOrderByEventDateAsc(email, pageable);

        List<Booking> bookings = result.getContent();
        Map<UUID, Summary> paymentStates = paymentStateResolver.resolveAll(
            bookings.stream().map(Booking::getId).toList());
        return bookings.stream().map(b -> toCustomerResponse(b, paymentStates.get(b.getId()))).toList();
    }

    /**
     * Transition a booking to a new status, enforcing the legal lifecycle
     * defined in {@link BookingStatus}. Illegal transitions raise HTTP 409
     * (via {@code ConflictException}); unknown booking IDs raise HTTP 404.
     */
    @Transactional
    public BookingResponse changeStatus(UUID bookingId, String rawNewStatus, String ipAddress) {
        Booking booking = bookingRepository.findById(bookingId)
            .orElseThrow(() -> new NotFoundException("Booking not found: " + bookingId));

        BookingStatus current = BookingStatus.parse(booking.getStatus());
        BookingStatus next = BookingStatus.parse(rawNewStatus);
        current.assertCanTransitionTo(next);

        booking.setStatus(next.name());
        Booking saved = bookingRepository.save(booking);

        UUID actorId = SecurityUtils.requireCurrentUserId();
        UUID tenantId = SecurityUtils.currentTenantId();
        auditService.log(
            "BOOKING_STATUS_CHANGED",
            "BOOKING",
            saved.getId(),
            tenantId,
            actorId,
            ipAddress,
            current.name(),
            next.name()
        );

        return toResponse(saved);
    }

    /**
     * Edit a booking's operational and pricing details. This is what lets a
     * photographer put a price on a booking created from an accepted inquiry
     * (which starts at {@code 0/0}), and correct any field on a manual booking.
     *
     * <p>Status is intentionally out of scope — it moves only through
     * {@link #changeStatus}. Pricing follows the same {@link #resolvePrice}
     * rule as creation: an explicit total wins, otherwise the linked package
     * price, otherwise 0. A deposit greater than the resolved total is rejected
     * (409) rather than silently stored as a negative balance.
     */
    @Transactional
    public BookingResponse updateBooking(UUID bookingId, UpdateBookingRequest request, String ipAddress) {
        Booking booking = bookingRepository.findById(bookingId)
            .orElseThrow(() -> new NotFoundException("Booking not found: " + bookingId));

        booking.setClientName(request.clientName().trim());
        booking.setClientEmail(Normalize.email(request.clientEmail()));
        booking.setEventDate(request.eventDate());
        booking.setEventTime(request.eventTime());
        booking.setEventType(Normalize.trimToNull(request.eventType()));
        booking.setLocation(Normalize.trimToNull(request.location()));
        applyPricing(booking, request.packageId(), request.totalAmountCents(), request.depositAmountCents());
        booking.setInternalNotes(Normalize.trimToNull(request.internalNotes()));

        Booking saved = bookingRepository.save(booking);

        auditService.log(
            "BOOKING_UPDATED",
            "BOOKING",
            saved.getId(),
            SecurityUtils.currentTenantId(),
            SecurityUtils.requireCurrentUserId(),
            ipAddress
        );

        return toResponse(saved);
    }

    /**
     * Set {@code package_id}, {@code total_amount_cents} and {@code
     * deposit_amount_cents} together, because they are only valid together: a
     * deposit larger than the total is a negative outstanding balance, which
     * {@link BookingPaymentStateResolver} and the invoice totals both read as
     * money the photographer owes the client.
     *
     * <p>Shared by every write path. The rule previously lived only in {@link
     * #updateBooking}, so a booking could be *created* with deposit > total and
     * then be rejected on the first edit that touched nothing but the location.
     */
    private void applyPricing(Booking booking, UUID packageId, Integer totalCents, Integer depositCents) {
        int total = resolvePrice(packageId, totalCents);
        int deposit = depositCents != null ? depositCents : 0;
        if (deposit > total) {
            throw new ConflictException("Deposit cannot exceed the total amount");
        }
        booking.setPackageId(packageId);
        booking.setTotalAmountCents(total);
        booking.setDepositAmountCents(deposit);
    }

    /**
     * Decide what to store in {@code total_amount_cents}.
     *
     * <p>Caller's explicit price always wins: if {@code totalAmountCents} was
     * supplied the photographer is overriding the package default (extra hour,
     * referral discount, custom quote) and that intent must not be silently
     * replaced. Only when no price was supplied AND a package is linked do we
     * fall back to the package's {@code price_cents}. An unknown {@code
     * packageId} surfaces as 404 — failing closed beats silently zero-pricing
     * a wedding.
     */
    private int resolvePrice(UUID packageId, Integer explicitTotalCents) {
        if (explicitTotalCents != null) {
            return explicitTotalCents;
        }
        if (packageId == null) {
            return 0;
        }
        Package pkg = packageRepository.findById(packageId)
            .orElseThrow(() -> new NotFoundException("Package not found: " + packageId));
        return pkg.getPriceCents();
    }

    private BookingResponse toResponse(Booking booking) {
        return toResponse(booking, paymentStateResolver.resolve(booking.getId()));
    }

    private BookingResponse toResponse(Booking booking, Summary payment) {
        return new BookingResponse(
            booking.getId(),
            booking.getClientName(),
            booking.getClientEmail(),
            booking.getEventDate(),
            booking.getEventTime(),
            booking.getEventType(),
            booking.getLocation(),
            booking.getPackageId(),
            booking.getTotalAmountCents(),
            booking.getDepositAmountCents(),
            booking.getStatus(),
            payment.state().name(),
            payment.paidCents(),
            booking.getInternalNotes(),
            booking.getCreatedAt()
        );
    }

    private CustomerBookingResponse toCustomerResponse(Booking booking, Summary payment) {
        return new CustomerBookingResponse(
            booking.getId(),
            booking.getClientName(),
            booking.getClientEmail(),
            booking.getEventDate(),
            booking.getEventTime(),
            booking.getEventType(),
            booking.getLocation(),
            booking.getPackageId(),
            booking.getTotalAmountCents(),
            booking.getDepositAmountCents(),
            booking.getStatus(),
            payment.state().name(),
            payment.paidCents(),
            booking.getCreatedAt()
        );
    }
}
