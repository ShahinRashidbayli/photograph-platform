package com.photographplatform.api.booking.service;

import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.domain.BookingStatus;
import com.photographplatform.api.booking.dto.BookingConflictResponse;
import com.photographplatform.api.booking.dto.BookingResponse;
import com.photographplatform.api.booking.dto.CustomerBookingResponse;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.booking.service.BookingMapper.PageLookups;
import com.photographplatform.api.common.exception.UnauthorizedException;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.common.util.Normalize;
import com.photographplatform.api.common.util.Paging;
import com.photographplatform.api.invoice.domain.BookingSettlement;
import com.photographplatform.api.invoice.service.Settlement;
import com.photographplatform.api.resource.repository.StudioResourceRepository;
import java.time.LocalDate;
import java.time.Month;
import java.time.Year;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Everything the booking module answers without changing anything.
 *
 * <p>Split from the write side because the two share almost nothing: reads care
 * about paging, filters and batching lookups so a page costs a fixed number of
 * queries, while writes care about validation, the lifecycle and audit. Held
 * together they made one class where the interesting question — "can this be
 * written, and by whom" — was buried among mapping and pagination.
 */
@Service
@Transactional(readOnly = true)
public class BookingQueryService {

    /**
     * Ordered by {@code eventDate}, then by id.
     *
     * <p>The tie-breaker is not decoration. Postgres promises no order among
     * rows a sort cannot separate, and a studio's bookings cluster hard on a
     * date — a Saturday in June is not two bookings, it is twenty. Without a
     * second key the same row can appear on two pages and another on none,
     * which the clients here read as duplicated and missing bookings rather
     * than as an unstable sort.
     */
    private static final Sort BY_EVENT_DATE =
        Sort.by(Sort.Order.asc("eventDate"), Sort.Order.asc("id"));

    private final BookingRepository bookingRepository;
    private final StudioResourceRepository studioResourceRepository;
    private final UserRepository userRepository;
    private final Settlement settlement;
    private final BookingMapper mapper;

    public BookingQueryService(
        BookingRepository bookingRepository,
        StudioResourceRepository studioResourceRepository,
        UserRepository userRepository,
        Settlement settlement,
        BookingMapper mapper
    ) {
        this.bookingRepository = bookingRepository;
        this.studioResourceRepository = studioResourceRepository;
        this.userRepository = userRepository;
        this.settlement = settlement;
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
    public List<BookingResponse> listForPhotographer(String status, int page, int size) {
        Pageable pageable = Paging.of(page, size, BY_EVENT_DATE);
        List<Booking> bookings = (status != null && !status.isBlank())
            ? bookingRepository.findByStatus(BookingStatus.parse(status), pageable).getContent()
            : bookingRepository.findAllBy(pageable).getContent();

        PageLookups lookups = mapper.forPage(bookings);
        return bookings.stream().map(b -> mapper.toResponse(b, lookups)).toList();
    }

    /**
     * The studios that have booked this address — for a client signing in by
     * email before any studio is known. Tenant ids only; see {@link
     * BookingRepository#findTenantsWithClientEmail}.
     */
    public List<UUID> tenantsWithClientEmail(String email) {
        return bookingRepository.findTenantsWithClientEmail(email);
    }

    /**
     * Booked (GLOSSARY.md): the quoted value of the tenant's Billable bookings
     * with an event in {@code year}. Booking owns this figure because it owns
     * which statuses are Billable (ADR-004 §4); the dashboard used to add it
     * up in the browser from its own status list.
     */
    public long bookedCents(UUID tenantId, int year) {
        Year y = Year.of(year);
        return bookingRepository.sumTotalAmountCents(
            tenantId, BookingStatus.BILLABLE, y.atDay(1), y.atMonth(Month.DECEMBER).atEndOfMonth());
    }

    /**
     * List the bookings owned by the currently authenticated customer.
     *
     * <p>The caller's identity is resolved from the JWT, never from a request
     * parameter — that is what closes the IDOR where a customer could read
     * another customer's bookings by supplying an arbitrary {@code clientId}.
     * Ownership itself is {@code customer_user_id}, falling back to the email
     * match only for bookings that have no account linked yet; see {@code
     * BookingRepository#OWNED_BY_CALLER}. The result is mapped to {@link
     * CustomerBookingResponse}, which excludes the photographer's internal
     * notes.
     */
    public List<CustomerBookingResponse> getOwnBookings(String rawStatus, int page, int size) {
        User user = userRepository.findById(SecurityUtils.requireCurrentUserId())
            .orElseThrow(() -> new UnauthorizedException("Authentication required"));
        // Normalised on both sides. Bookings store the address through
        // Normalize.email on the way in; comparing a raw one against it would
        // answer an empty list rather than an error, which is the same failure
        // an unparsed status filter used to have.
        String email = Normalize.email(user.getEmail());

        Pageable pageable = Paging.of(page, size, BY_EVENT_DATE);
        List<Booking> bookings = (rawStatus != null && !rawStatus.isBlank())
            ? bookingRepository
                .findOwnedByAndStatus(
                    user.getId(), email, BookingStatus.parse(rawStatus), pageable)
                .getContent()
            : bookingRepository.findOwnedBy(user.getId(), email, pageable).getContent();

        Map<UUID, BookingSettlement> settlements = settlement.ofBookings(
            bookings.stream().map(Booking::getId).toList());
        return bookings.stream()
            .map(b -> mapper.toCustomerResponse(b, settlements.get(b.getId())))
            .toList();
    }

    /**
     * What else this photographer has on that day, and what else is holding the
     * rooms and kit they picked.
     *
     * <p>Answers a question the form asks while it is being filled in; it
     * changes nothing and refuses nothing. See {@link BookingConflictResponse}
     * for why this is a warning rather than a constraint, and why it is scoped
     * to the day instead of to overlapping hours.
     */
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
                    .findClashes(resourceIds, eventDate, excludeBookingId, BookingStatus.NOT_HAPPENING)
                    .stream()
                    .map(c -> new BookingConflictResponse.ResourceClash(
                        c.getResourceName(), c.getBookingId(), c.getClientName(),
                        c.getEventTime(), c.getStatus().name()))
                    .toList();

        if (assignedUserId == null) {
            // Nobody assigned: the photographer half has nothing to answer, but
            // the rooms and kit still do.
            return new BookingConflictResponse(List.of(), resourceClashes);
        }
        List<BookingConflictResponse.Conflict> conflicts = bookingRepository
            .findSameDayForPhotographer(
                assignedUserId, eventDate, excludeBookingId, BookingStatus.NOT_HAPPENING)
            .stream()
            .map(b -> new BookingConflictResponse.Conflict(
                b.getId(), b.getClientName(), b.getEventTime(), b.getStatus().name()))
            .toList();
        return new BookingConflictResponse(conflicts, resourceClashes);
    }
}
