package com.photographplatform.api.booking.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.domain.BookingStatus;
import com.photographplatform.api.booking.dto.BookingResponse;
import com.photographplatform.api.booking.dto.CreateBookingRequest;
import com.photographplatform.api.booking.dto.UpdateBookingRequest;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.client.repository.ClientRepository;
import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.common.util.Normalize;
import com.photographplatform.api.resource.domain.BookingResource;
import com.photographplatform.api.resource.repository.BookingResourceRepository;
import com.photographplatform.api.resource.repository.StudioResourceRepository;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Bookings the photographer creates and edits by hand.
 *
 * <p>The other write path — a lead or an inquiry becoming a booking — is
 * {@code BookingConversionService}. They are separate because they answer to
 * different things: this one to a form the photographer filled in, and so to
 * every id on it being theirs; that one to a funnel step, where the contact
 * details are already settled and the operational fields are not asked for yet.
 */
@Service
@Transactional
public class BookingCommandService {

    private final BookingRepository bookingRepository;
    private final ClientRepository clientRepository;
    private final UserRepository userRepository;
    private final StudioResourceRepository studioResourceRepository;
    private final BookingResourceRepository bookingResourceRepository;
    private final BookingPricingResolver pricingResolver;
    private final CustomerAccountResolver customerAccounts;
    private final AuditService auditService;
    private final BookingMapper mapper;

    public BookingCommandService(
        BookingRepository bookingRepository,
        ClientRepository clientRepository,
        UserRepository userRepository,
        StudioResourceRepository studioResourceRepository,
        BookingResourceRepository bookingResourceRepository,
        BookingPricingResolver pricingResolver,
        CustomerAccountResolver customerAccounts,
        AuditService auditService,
        BookingMapper mapper
    ) {
        this.bookingRepository = bookingRepository;
        this.clientRepository = clientRepository;
        this.userRepository = userRepository;
        this.studioResourceRepository = studioResourceRepository;
        this.bookingResourceRepository = bookingResourceRepository;
        this.pricingResolver = pricingResolver;
        this.customerAccounts = customerAccounts;
        this.auditService = auditService;
        this.mapper = mapper;
    }

    /**
     * Create a booking on behalf of the authenticated photographer. The booking
     * is always created in {@code ENQUIRY}; advancing it goes through
     * {@link #changeStatus} so the lifecycle state machine is the single place
     * that validates transitions.
     */
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
        booking.applyPricing(pricingResolver.resolve(
            request.packageId(), request.totalAmountCents(), request.depositAmountCents()));
        booking.setInternalNotes(Normalize.trimToNull(request.internalNotes()));
        booking.assignTo(resolveAssignee(request.assignedUserId(), tenantId));
        booking.setLanguage(CustomerLanguage.fromCodeOrDefault(request.language()));
        booking.linkCustomer(customerAccounts.forEmail(booking.getClientEmail(), tenantId));

        Optional<Set<UUID>> resources = requireOwnResources(request.resourceIds());

        Booking saved = bookingRepository.save(booking);
        // linkResources, not replaceResources: there is nothing yet to replace,
        // and the delete-then-flush that path opens with is two round trips per
        // create against an empty set of rows.
        resources.ifPresent(r -> linkResources(saved.getId(), r));

        auditService.log("BOOKING_CREATED", "BOOKING", saved.getId(), tenantId, actorId, ipAddress);

        return mapper.withLookups(saved);
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
     * transition that never happened. The loser now gets a 409 instead — see
     * {@code BookingConcurrencyIT}.
     */
    public BookingResponse changeStatus(UUID bookingId, String rawNewStatus, String ipAddress) {
        Booking booking = requireOwnBooking(bookingId);

        BookingStatus current = booking.getStatus();
        BookingStatus next = BookingStatus.parse(rawNewStatus);
        // No save(): the entity is managed, so dirty checking writes it, and
        // the version check that makes this safe happens at flush either way.
        // There used to be an explicit call here purely because the unit tests
        // mock the repository and could not otherwise see a write — production
        // code shaped by its test double. BookingConcurrencyIT asserts what the
        // row actually holds afterwards, and what it still holds when the
        // transition is refused, which is what those assertions were reaching
        // for.
        booking.changeStatus(next);

        auditService.logChange(
            "BOOKING_STATUS_CHANGED",
            "BOOKING",
            booking.getId(),
            SecurityUtils.currentTenantId(),
            SecurityUtils.requireCurrentUserId(),
            ipAddress,
            current.name(),
            next.name()
        );

        return mapper.withLookups(booking);
    }

    /**
     * Edit a booking's operational and pricing details. This is what lets a
     * photographer put a price on a booking created from an accepted inquiry
     * (which starts unpriced), and correct any field on a manual booking.
     *
     * <p>Status is intentionally out of scope — it moves only through
     * {@link #changeStatus} — and a booking that is no longer
     * {@linkplain Booking#isEditable editable} refuses the edit outright, the
     * way {@code LeadService#updateLead} refuses a terminal lead.
     */
    public BookingResponse updateBooking(
        UUID bookingId, UpdateBookingRequest request, String ipAddress) {
        Booking booking = requireOwnBooking(bookingId);

        if (!booking.isEditable()) {
            throw new ConflictException(
                "Cannot edit a " + booking.getStatus() + " booking — the shoot is closed.");
        }

        String previousEmail = booking.getClientEmail();
        booking.setClientName(request.clientName().trim());
        booking.setClientEmail(Normalize.email(request.clientEmail()));
        if (booking.getCustomerUserId() == null) {
            // Still unlinked, so the address is what decides who sees this.
            // Link it if the new one now has an account — after which the
            // address stops deciding anything.
            booking.linkCustomer(
                customerAccounts.forEmail(booking.getClientEmail(), booking.getTenantId()));
        }
        booking.setEventDate(request.eventDate());
        booking.setEventTime(request.eventTime());
        booking.setEventType(Normalize.trimToNull(request.eventType()));
        booking.setLocation(Normalize.trimToNull(request.location()));
        booking.applyPricing(pricingResolver.resolve(
            request.packageId(), statedTotal(request, booking), request.depositAmountCents()));
        booking.setInternalNotes(Normalize.trimToNull(request.internalNotes()));
        booking.assignTo(resolveAssignee(request.assignedUserId(), booking.getTenantId()));
        if (request.language() != null) {
            booking.setLanguage(CustomerLanguage.fromCode(request.language()));
        }

        Optional<Set<UUID>> resources = requireOwnResources(request.resourceIds());
        resources.ifPresent(r -> replaceResources(booking.getId(), r));

        UUID tenantId = SecurityUtils.currentTenantId();
        UUID actorId = SecurityUtils.requireCurrentUserId();
        if (!previousEmail.equalsIgnoreCase(booking.getClientEmail())) {
            // Its own audit row, with both addresses. On an unlinked booking
            // this still decides who can see it, its invoices and its payments
            // — and recorded as a plain BOOKING_UPDATED there was nothing in
            // the trail to tell that apart from a corrected typo.
            auditService.logChange(
                "BOOKING_CLIENT_EMAIL_CHANGED", "BOOKING", booking.getId(), tenantId, actorId,
                ipAddress, previousEmail, booking.getClientEmail());
        }
        auditService.log("BOOKING_UPDATED", "BOOKING", booking.getId(), tenantId, actorId, ipAddress);

        return mapper.withLookups(booking);
    }

    /**
     * What the edit says the total should be, treating "nothing stated" as
     * "leave it".
     *
     * <p>A null total means different things on the two paths, and conflating
     * them lost money. On create there is nothing to preserve, so no package
     * and no price is a booking nobody has quoted yet: zero. On edit the same
     * pair used to zero a booking that already had a price — and the form
     * sends exactly that pair whenever the price field is blank and no package
     * is picked (see {@code CreateBookingModal}, which sends {@code null} so
     * the package price can apply). A CONFIRMED shoot with an issued invoice
     * and a paid deposit would come back priced at 0, its deposit then larger
     * than its total, which is the negative balance {@link
     * com.photographplatform.api.booking.domain.BookingPricing} exists to
     * refuse — reached by the one path that could not check for it.
     *
     * <p>So null is "I am not stating a price", not "the price is nothing".
     * Zeroing a booking on purpose means sending 0, which says so.
     */
    private Integer statedTotal(UpdateBookingRequest request, Booking booking) {
        if (request.totalAmountCents() != null || request.packageId() != null) {
            return request.totalAmountCents();
        }
        return booking.getTotalAmountCents();
    }

    // ── the three ownership checks ───────────────────────────────────────────

    /**
     * The booking, or a 404 — never another tenant's.
     *
     * <p>Scoped in the query rather than left to row-level security. RLS does
     * cover it (see {@code BookingRepository#findByIdAndTenantId}), but a
     * mutation that can move money and cancel a shoot should say what it is
     * allowed to touch, in the same place a reader looks to find out.
     */
    private Booking requireOwnBooking(UUID bookingId) {
        return bookingRepository
            .findByIdAndTenantId(bookingId, SecurityUtils.requireCurrentTenantId())
            .orElseThrow(() -> new NotFoundException("Booking not found: " + bookingId));
    }

    /**
     * Validates who a booking is being assigned to.
     *
     * <p>The manual tenant comparison is not redundant with RLS the way it
     * looks. V11 deliberately leaves {@code users} without a row-level policy
     * ("keep relying on app-level tenant_id filtering"), so {@code findById}
     * sees every tenant's users and this method is the only thing standing
     * between the request and someone else's staff. Without it a studio could
     * assign its bookings to an account in another tenant, which would then
     * appear on that person's schedule and in a report they had no part in.
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

    /**
     * Refuses a resource id that is not this studio's.
     *
     * <p>RLS does not cover this one: V28 scopes {@code booking_resources}
     * through the <em>booking's</em> tenant, not the resource's, and a foreign
     * key check runs outside row-level security entirely. So another studio's
     * room or lighting kit could be attached to a booking here and would then
     * show up in this tenant's clash warnings as something it does not own. The
     * lookup below does go through RLS, which is what makes a foreign id
     * indisputably absent.
     *
     * <p>Runs before the booking is written, alongside the other two checks, so
     * a rejected selection leaves nothing behind.
     *
     * @return the de-duplicated selection, or empty when the caller is not
     *     editing the links at all — which is a different thing from an empty
     *     selection, and was a nullable {@code Set} that every caller had to
     *     remember to check
     */
    private Optional<Set<UUID>> requireOwnResources(List<UUID> resourceIds) {
        if (resourceIds == null) {
            return Optional.empty();
        }
        Set<UUID> wanted = new LinkedHashSet<>(resourceIds);
        if (wanted.isEmpty()) {
            return Optional.of(wanted);
        }
        Set<UUID> found = studioResourceRepository.findExistingIds(wanted);
        if (!found.containsAll(wanted)) {
            UUID missing = wanted.stream()
                .filter(id -> !found.contains(id)).findFirst().orElseThrow();
            throw new NotFoundException("Resource not found: " + missing);
        }
        return Optional.of(wanted);
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
        bookingResourceRepository.deleteByBookingId(bookingId);
        // Flush before inserting: the composite primary key means re-adding a
        // resource that was already linked would collide with the row this
        // transaction has queued for deletion but not yet sent. Covered by
        // BookingConcurrencyIT.
        bookingResourceRepository.flush();
        linkResources(bookingId, resourceIds);
    }

    private void linkResources(UUID bookingId, Set<UUID> resourceIds) {
        if (resourceIds.isEmpty()) {
            return;
        }
        bookingResourceRepository.saveAll(resourceIds.stream()
            .map(rid -> new BookingResource(bookingId, rid))
            .toList());
    }
}
