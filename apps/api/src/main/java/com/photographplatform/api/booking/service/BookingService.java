package com.photographplatform.api.booking.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.domain.BookingStatus;
import com.photographplatform.api.booking.service.BookingPaymentStateResolver.Summary;
import com.photographplatform.api.booking.dto.BookingConflictResponse;
import com.photographplatform.api.booking.dto.BookingResponse;
import com.photographplatform.api.booking.dto.CreateBookingRequest;
import com.photographplatform.api.booking.dto.CustomerBookingResponse;
import com.photographplatform.api.booking.dto.UpdateBookingRequest;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.resource.domain.BookingResource;
import com.photographplatform.api.resource.repository.BookingResourceRepository;
import com.photographplatform.api.resource.repository.StudioResourceRepository;
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
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BookingService {

    private final BookingRepository bookingRepository;
    private final StudioResourceRepository studioResourceRepository;
    private final BookingResourceRepository bookingResourceRepository;
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
        BookingPaymentStateResolver paymentStateResolver,
        StudioResourceRepository studioResourceRepository,
        BookingResourceRepository bookingResourceRepository
    ) {
        this.bookingRepository = bookingRepository;
        this.studioResourceRepository = studioResourceRepository;
        this.bookingResourceRepository = bookingResourceRepository;
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
        // One query for the whole page, not one per row — the same reason
        // payment states are resolved in a batch just above.
        Map<UUID, String> names = assigneeNames(bookings);
        return bookings.stream()
            .map(b -> toResponse(b, paymentStates.get(b.getId()), names))
            .toList();
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
        booking.setAssignedUserId(resolveAssignee(request.assignedUserId(), tenantId));
        booking.setStatus(BookingStatus.ENQUIRY.name());

        Booking saved = bookingRepository.save(booking);
        replaceResources(saved.getId(), request.resourceIds());

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
        booking.setAssignedUserId(resolveAssignee(request.assignedUserId(), booking.getTenantId()));

        Booking saved = bookingRepository.save(booking);
        replaceResources(saved.getId(), request.resourceIds());

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

    /**
     * What else this photographer has on that day.
     *
     * <p>Answers a question the form asks while it is being filled in; it
     * changes nothing and refuses nothing. See {@link BookingConflictResponse}
     * for why this is a warning rather than a constraint, and why it is scoped
     * to the day instead of to overlapping hours.
     */
    @Transactional(readOnly = true)
    public BookingConflictResponse findConflicts(
        UUID assignedUserId, LocalDate eventDate, UUID excludeBookingId,
        List<UUID> resourceIds) {
        if (eventDate == null) {
            // No date yet: nothing can clash.
            return new BookingConflictResponse(List.of(), List.of());
        }
        UUID exclude = excludeBookingId != null ? excludeBookingId : UUID.randomUUID();

        List<BookingConflictResponse.ResourceClash> resourceClashes =
            resourceIds == null || resourceIds.isEmpty()
                ? List.of()
                : studioResourceRepository.findClashes(resourceIds, eventDate, exclude).stream()
                    .map(c -> new BookingConflictResponse.ResourceClash(
                        c.getResourceName(), c.getBookingId(), c.getClientName(),
                        c.getEventTime(), c.getStatus()))
                    .toList();

        if (assignedUserId == null) {
            // Nobody assigned: the photographer half has nothing to answer, but
            // the rooms and kit still do.
            return new BookingConflictResponse(List.of(), resourceClashes);
        }
        List<BookingConflictResponse.Conflict> conflicts = bookingRepository
            .findSameDayForPhotographer(assignedUserId, eventDate, exclude)
            .stream()
            .map(b -> new BookingConflictResponse.Conflict(
                b.getId(), b.getClientName(), b.getEventTime(), b.getStatus()))
            .toList();
        return new BookingConflictResponse(conflicts, resourceClashes);
    }

    /**
     * Rewrites a booking's resource links.
     *
     * <p>Delete-then-insert rather than a diff: the set is a handful of rows,
     * the form always sends its whole selection, and a diff would be more code
     * to get subtly wrong for no measurable gain.
     *
     * @param resourceIds null leaves the existing links alone — used by callers
     *                    that are not editing them; an empty list clears them
     */
    private void replaceResources(UUID bookingId, List<UUID> resourceIds) {
        if (resourceIds == null) {
            return;
        }
        bookingResourceRepository.deleteByBookingId(bookingId);
        // Flush before inserting: the composite primary key means re-adding a
        // resource that was already linked would collide with the row this
        // transaction has queued for deletion but not yet sent.
        bookingResourceRepository.flush();
        if (!resourceIds.isEmpty()) {
            bookingResourceRepository.saveAll(resourceIds.stream()
                .distinct()
                .map(rid -> new BookingResource(bookingId, rid))
                .toList());
        }
    }

    /**
     * Validates who a booking is being assigned to.
     *
     * <p>Checked rather than trusted: the id arrives from the client, and
     * without this a studio could assign its bookings to an account in someone
     * else's tenant — which would then appear on that person's schedule, and
     * in a report they had no part in.
     *
     * @param assignedUserId the requested assignee, or null to clear
     * @return the same id once it is known to be staff in this tenant
     */
    private UUID resolveAssignee(UUID assignedUserId, UUID tenantId) {
        if (assignedUserId == null) {
            return null;
        }
        return userRepository.findById(assignedUserId)
            .filter(u -> u.getTenantId().equals(tenantId))
            // Customers share the tenant but do not shoot bookings.
            .filter(u -> u.getStaffRole() != null)
            .map(User::getId)
            .orElseThrow(() -> new NotFoundException("That photographer is not in your studio"));
    }

    /** Assignee display names, resolved in one query for a whole page. */
    private Map<UUID, String> assigneeNames(List<Booking> bookings) {
        Set<UUID> ids = bookings.stream()
            .map(Booking::getAssignedUserId)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return Map.of();
        }
        return userRepository.findAllById(ids).stream()
            .collect(Collectors.toMap(User::getId,
                u -> u.getFullName() != null && !u.getFullName().isBlank()
                    ? u.getFullName() : u.getEmail()));
    }

    private BookingResponse toResponse(Booking booking) {
        return toResponse(booking, paymentStateResolver.resolve(booking.getId()));
    }

    private BookingResponse toResponse(Booking booking, Summary payment) {
        return toResponse(booking, payment, null);
    }

    /**
     * @param names pre-resolved assignee names for a whole page, or null for a
     *              single booking — which then looks its own up
     */
    private BookingResponse toResponse(Booking booking, Summary payment, Map<UUID, String> names) {
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
            booking.getAssignedUserId(),
            // Guarded because an unassigned booking is the common case and
            // `Map.of()` throws on a null key rather than returning null — which
            // made the whole list 500 for any studio with one unassigned shoot.
            booking.getAssignedUserId() == null
                ? null
                : names != null
                    ? names.get(booking.getAssignedUserId())
                    : assigneeName(booking.getAssignedUserId()),
            bookingResourceRepository.findByBookingId(booking.getId()).stream()
                .map(BookingResource::getResourceId)
                .toList(),
            booking.getCreatedAt()
        );
    }

    /**
     * One assignee's name. Fine for a single booking; a list goes through
     * {@link #assigneeNames} instead so it does not issue one query per row.
     */
    private String assigneeName(UUID userId) {
        if (userId == null) {
            return null;
        }
        return userRepository.findById(userId)
            .map(u -> u.getFullName() != null && !u.getFullName().isBlank()
                ? u.getFullName() : u.getEmail())
            .orElse(null);
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
