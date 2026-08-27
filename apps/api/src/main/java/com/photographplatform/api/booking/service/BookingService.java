package com.photographplatform.api.booking.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.domain.BookingStatus;
import com.photographplatform.api.booking.service.BookingMapper.PageLookups;
import com.photographplatform.api.booking.service.BookingPaymentStateResolver.Summary;
import com.photographplatform.api.booking.dto.BookingConflictResponse;
import com.photographplatform.api.booking.dto.BookingResponse;
import com.photographplatform.api.booking.dto.CreateBookingRequest;
import com.photographplatform.api.booking.dto.CustomerBookingResponse;
import com.photographplatform.api.booking.dto.UpdateBookingRequest;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.resource.domain.BookingResource;
import com.photographplatform.api.resource.domain.StudioResource;
import com.photographplatform.api.resource.repository.BookingResourceRepository;
import com.photographplatform.api.resource.repository.StudioResourceRepository;
import com.photographplatform.api.client.repository.ClientRepository;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.exception.UnauthorizedException;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.common.util.Normalize;
import com.photographplatform.api.common.util.Paging;
import com.photographplatform.api.inquiry.domain.InquiryRequest;
import com.photographplatform.api.lead.domain.Lead;
import com.photographplatform.api.lead.dto.ConvertLeadRequest;
import com.photographplatform.api.pricing.domain.Package;
import com.photographplatform.api.pricing.repository.PackageRepository;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BookingService {

    private static final Sort BY_EVENT_DATE = Sort.by("eventDate").ascending();

    private final BookingRepository bookingRepository;
    private final StudioResourceRepository studioResourceRepository;
    private final BookingResourceRepository bookingResourceRepository;
    private final ClientRepository clientRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;
    private final PackageRepository packageRepository;
    private final BookingPaymentStateResolver paymentStateResolver;
    private final BookingMapper mapper;

    public BookingService(
        BookingRepository bookingRepository,
        ClientRepository clientRepository,
        UserRepository userRepository,
        AuditService auditService,
        PackageRepository packageRepository,
        BookingPaymentStateResolver paymentStateResolver,
        StudioResourceRepository studioResourceRepository,
        BookingResourceRepository bookingResourceRepository,
        BookingMapper mapper
    ) {
        this.bookingRepository = bookingRepository;
        this.studioResourceRepository = studioResourceRepository;
        this.bookingResourceRepository = bookingResourceRepository;
        this.clientRepository = clientRepository;
        this.userRepository = userRepository;
        this.auditService = auditService;
        this.packageRepository = packageRepository;
        this.paymentStateResolver = paymentStateResolver;
        this.mapper = mapper;
    }

    /**
     * Photographer-facing list of every booking in the tenant, optionally
     * filtered by status.
     *
     * <p>An unrecognised {@code status} is rejected rather than filtered on:
     * passing it through meant {@code ?status=CONFIRMEDD} answered an empty
     * list, which is indistinguishable from "you have no confirmed bookings"
     * and sends whoever hits it looking for the bug in the wrong place.
     */
    @Transactional(readOnly = true)
    public List<BookingResponse> listForPhotographer(String status, int page, int size) {
        Pageable pageable = Paging.of(page, size, BY_EVENT_DATE);
        List<Booking> bookings = (status != null && !status.isBlank())
            ? bookingRepository.findByStatus(BookingStatus.parse(status).name(), pageable).getContent()
            : bookingRepository.findAllBy(pageable).getContent();

        PageLookups lookups = mapper.forPage(bookings);
        return bookings.stream().map(b -> mapper.toResponse(b, lookups)).toList();
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

        Set<UUID> resources = requireOwnResources(request.resourceIds());

        Booking saved = bookingRepository.save(booking);
        replaceResources(saved.getId(), resources);

        auditService.log(
            "BOOKING_CREATED",
            "BOOKING",
            saved.getId(),
            tenantId,
            actorId,
            ipAddress
        );

        return mapper.withLookups(saved);
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
     *
     * <p>No assignee and no resources: {@link ConvertLeadRequest} carries
     * neither, because the conversion form asks only what the lead could not
     * answer. Both are set afterwards through {@link #updateBooking}, which is
     * the same screen the photographer lands on next.
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

        return mapper.withLookups(saved);
    }

    /**
     * Create a booking from an accepted customer inquiry. Contact details come
     * from the customer's own account, the event basics from the inquiry; the
     * photographer fills the operational fields (time, pricing) on the booking
     * afterwards. Always created in {@code ENQUIRY}, and linked back to the
     * inquiry via {@code inquiryId} so the funnel joins end to end.
     *
     * <p>Pricing goes through {@link #applyPricing} with nothing supplied, the
     * same as every other create path, rather than leaning on the entity's
     * field initialisers. An inquiry carries no price, so the result is 0/0
     * either way — but the rule about which of the three amounts may be set
     * without the others stays in exactly one place, which is the reason
     * {@code applyPricing} exists at all.
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
        applyPricing(booking, null, null, null);
        booking.setStatus(BookingStatus.ENQUIRY.name());

        Booking saved = bookingRepository.save(booking);

        auditService.log("BOOKING_CREATED", "BOOKING", saved.getId(), tenantId, actorId, ipAddress);

        return mapper.withLookups(saved);
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

        Pageable pageable = Paging.of(page, size, BY_EVENT_DATE);
        List<Booking> bookings = (rawStatus != null && !rawStatus.isBlank())
            ? bookingRepository
                .findByClientEmailIgnoreCaseAndStatus(email, BookingStatus.parse(rawStatus).name(), pageable)
                .getContent()
            : bookingRepository.findByClientEmailIgnoreCase(email, pageable).getContent();

        Map<UUID, Summary> paymentStates = paymentStateResolver.resolveAll(
            bookings.stream().map(Booking::getId).toList());
        return bookings.stream()
            .map(b -> mapper.toCustomerResponse(b, paymentStates.get(b.getId())))
            .toList();
    }

    /**
     * Transition a booking to a new status, enforcing the legal lifecycle
     * defined in {@link BookingStatus}. Illegal transitions raise HTTP 409
     * (via {@code ConflictException}); unknown booking IDs raise HTTP 404.
     *
     * <p>The read-validate-write here is only safe because {@code Booking}
     * carries an {@code @Version} (V30): two requests transitioning the same
     * booking at once would otherwise both pass the state machine and the
     * second would overwrite the first, with the machine having validated a
     * transition that never happened. The loser now gets a 409 instead.
     */
    @Transactional
    public BookingResponse changeStatus(UUID bookingId, String rawNewStatus, String ipAddress) {
        Booking booking = bookingRepository.findById(bookingId)
            .orElseThrow(() -> new NotFoundException("Booking not found: " + bookingId));

        BookingStatus current = BookingStatus.parse(booking.getStatus());
        BookingStatus next = BookingStatus.parse(rawNewStatus);
        current.assertCanTransitionTo(next);

        booking.setStatus(next.name());
        // Explicit save on an entity that is already managed: dirty checking
        // would write it regardless. Kept because every unit test here mocks
        // the repository, so this call is the only observable write — dropping
        // it turns "verify(repo, never()).save(...)", the assertion that a
        // rejected transition persists nothing, into a tautology that passes
        // whatever the code does.
        Booking saved = bookingRepository.save(booking);

        UUID actorId = SecurityUtils.requireCurrentUserId();
        UUID tenantId = SecurityUtils.currentTenantId();
        auditService.logChange(
            "BOOKING_STATUS_CHANGED",
            "BOOKING",
            saved.getId(),
            tenantId,
            actorId,
            ipAddress,
            current.name(),
            next.name()
        );

        return mapper.withLookups(saved);
    }

    /**
     * Edit a booking's operational and pricing details. This is what lets a
     * photographer put a price on a booking created from an accepted inquiry
     * (which starts at {@code 0/0}), and correct any field on a manual booking.
     *
     * <p>Status is intentionally out of scope — it moves only through
     * {@link #changeStatus} — and a booking whose status is
     * {@linkplain BookingStatus#isClosedForEdits closed} refuses the edit
     * outright, the way {@code LeadService#updateLead} refuses a terminal lead.
     * Repricing a shoot that was delivered or called off does not describe
     * anything that will happen, and on a completed booking it silently
     * disagrees with the invoice already issued against it.
     *
     * <p>Pricing follows the same {@link #resolvePrice} rule as creation: an
     * explicit total wins, otherwise the linked package price, otherwise 0. A
     * deposit greater than the resolved total is rejected as invalid input.
     */
    @Transactional
    public BookingResponse updateBooking(UUID bookingId, UpdateBookingRequest request, String ipAddress) {
        Booking booking = bookingRepository.findById(bookingId)
            .orElseThrow(() -> new NotFoundException("Booking not found: " + bookingId));

        BookingStatus status = BookingStatus.parse(booking.getStatus());
        if (status.isClosedForEdits()) {
            throw new ConflictException(
                "Cannot edit a " + status.name() + " booking — the shoot is closed.");
        }

        booking.setClientName(request.clientName().trim());
        booking.setClientEmail(Normalize.email(request.clientEmail()));
        booking.setEventDate(request.eventDate());
        booking.setEventTime(request.eventTime());
        booking.setEventType(Normalize.trimToNull(request.eventType()));
        booking.setLocation(Normalize.trimToNull(request.location()));
        applyPricing(booking, request.packageId(), request.totalAmountCents(), request.depositAmountCents());
        booking.setInternalNotes(Normalize.trimToNull(request.internalNotes()));
        booking.setAssignedUserId(resolveAssignee(request.assignedUserId(), booking.getTenantId()));
        Set<UUID> resources = requireOwnResources(request.resourceIds());

        Booking saved = bookingRepository.save(booking);
        replaceResources(saved.getId(), resources);

        auditService.log(
            "BOOKING_UPDATED",
            "BOOKING",
            saved.getId(),
            SecurityUtils.currentTenantId(),
            SecurityUtils.requireCurrentUserId(),
            ipAddress
        );

        return mapper.withLookups(saved);
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
            // Invalid input, not a state conflict: nothing about the booking
            // stands in the way, the payload just contradicts itself. This
            // codebase answers hand-rolled validation with 422 everywhere else
            // (see GlobalExceptionHandler's class javadoc); it used to answer
            // 409 here alone.
            throw new IllegalArgumentException("Deposit cannot exceed the total amount");
        }
        booking.setPackageId(packageId);
        booking.setTotalAmountCents(total);
        booking.setDepositAmountCents(deposit);
    }

    /**
     * Decide what to store in {@code total_amount_cents}, and refuse a {@code
     * packageId} that is not this tenant's.
     *
     * <p>Caller's explicit price always wins: if {@code totalAmountCents} was
     * supplied the photographer is overriding the package default (extra hour,
     * referral discount, custom quote) and that intent must not be silently
     * replaced. Only when no price was supplied do we fall back to the
     * package's {@code price_cents}.
     *
     * <p>The package is looked up <em>whether or not</em> the price is used,
     * which is the whole reason the lookup is unconditional. It used to return
     * early on an explicit total, so {@code package_id} was written without
     * anyone having checked it existed: an unknown id then failed at the
     * foreign key and surfaced as a baffling 409 "Resource already exists",
     * and — worse — another tenant's package id satisfies that foreign key
     * perfectly and was stored without a word. The lookup goes through RLS, so
     * doing it always is also what makes cross-tenant ids a 404.
     */
    private int resolvePrice(UUID packageId, Integer explicitTotalCents) {
        if (packageId == null) {
            return explicitTotalCents != null ? explicitTotalCents : 0;
        }
        Package pkg = packageRepository.findById(packageId)
            .orElseThrow(() -> new NotFoundException("Package not found: " + packageId));
        // Failing closed beats silently zero-pricing a wedding.
        return explicitTotalCents != null ? explicitTotalCents : pkg.getPriceCents();
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

        List<BookingConflictResponse.ResourceClash> resourceClashes =
            resourceIds == null || resourceIds.isEmpty()
                ? List.of()
                : studioResourceRepository
                    .findClashes(resourceIds, eventDate, excludeBookingId).stream()
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
            .findSameDayForPhotographer(assignedUserId, eventDate, excludeBookingId)
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
     * @param resourceIds the already-validated selection from {@link
     *                    #requireOwnResources}; null leaves the existing links
     *                    alone — used by callers that are not editing them —
     *                    and an empty set clears them
     */
    private void replaceResources(UUID bookingId, Set<UUID> resourceIds) {
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
                .map(rid -> new BookingResource(bookingId, rid))
                .toList());
        }
    }

    /**
     * Refuses a resource id that is not this studio's.
     *
     * <p>Checked for the same reason {@link #resolveAssignee} is, and RLS does
     * not cover it: V28 scopes {@code booking_resources} through the
     * <em>booking's</em> tenant, not the resource's, and a foreign key check
     * runs outside row-level security entirely. So another studio's room or
     * lighting kit could be attached to a booking here and would then show up
     * in this tenant's clash warnings as something it does not own. The lookup
     * below does go through RLS, which is what makes a foreign id indisputably
     * absent.
     *
     * <p>Runs before the booking is written, alongside {@link #resolveAssignee}
     * and {@link #resolvePrice}, so a rejected selection leaves nothing behind.
     *
     * @return the de-duplicated selection, or null when the caller is not
     *     editing the links at all
     */
    private Set<UUID> requireOwnResources(List<UUID> resourceIds) {
        if (resourceIds == null) {
            return null;
        }
        Set<UUID> wanted = new LinkedHashSet<>(resourceIds);
        if (wanted.isEmpty()) {
            return wanted;
        }
        Set<UUID> found = studioResourceRepository.findAllById(wanted).stream()
            .map(StudioResource::getId)
            .collect(Collectors.toSet());
        if (found.size() != wanted.size()) {
            UUID missing = wanted.stream().filter(id -> !found.contains(id)).findFirst().orElseThrow();
            throw new NotFoundException("Resource not found: " + missing);
        }
        return wanted;
    }

    /**
     * Validates who a booking is being assigned to.
     *
     * <p>Checked rather than trusted: the id arrives from the client, and
     * without this a studio could assign its bookings to an account in someone
     * else's tenant — which would then appear on that person's schedule, and
     * in a report they had no part in.
     *
     * <p>The manual tenant comparison is not redundant with RLS the way it
     * looks. V11 deliberately leaves {@code users} without a row-level policy
     * ("keep relying on app-level tenant_id filtering"), so {@code
     * userRepository.findById} sees every tenant's users and this method is the
     * only thing standing between the request and someone else's staff. The
     * other id checks on this class — {@code clientRepository.existsById},
     * {@code packageRepository.findById} — hit tables that *do* have policies,
     * which is why they can be a bare lookup.
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
}
