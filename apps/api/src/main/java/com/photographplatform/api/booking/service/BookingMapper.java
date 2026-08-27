package com.photographplatform.api.booking.service;

import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.dto.BookingResponse;
import com.photographplatform.api.booking.dto.CustomerBookingResponse;
import com.photographplatform.api.booking.service.BookingPaymentStateResolver.Summary;
import com.photographplatform.api.resource.domain.BookingResource;
import com.photographplatform.api.resource.repository.BookingResourceRepository;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Booking → response mapping, and the batch lookups a whole page of them needs.
 *
 * <p>Split out of {@code BookingService} because the two change for unrelated
 * reasons — the service changes when the booking rules change, this changes
 * when the response shape does — and because the cost of the single-booking
 * mapping was invisible while it sat inline. {@link #withLookups} is named for
 * what it does: three queries per call. A page goes through {@link #forPage}
 * instead, which does three for the whole page. Anyone reaching for the
 * single-booking form inside a loop now has to type the reason it is wrong.
 */
@Component
public class BookingMapper {

    private final UserRepository userRepository;
    private final BookingResourceRepository bookingResourceRepository;
    private final BookingPaymentStateResolver paymentStateResolver;

    public BookingMapper(
        UserRepository userRepository,
        BookingResourceRepository bookingResourceRepository,
        BookingPaymentStateResolver paymentStateResolver
    ) {
        this.userRepository = userRepository;
        this.bookingResourceRepository = bookingResourceRepository;
        this.paymentStateResolver = paymentStateResolver;
    }

    /**
     * Everything a page of bookings needs to render, resolved in three queries
     * regardless of how many rows there are.
     */
    public record PageLookups(
        Map<UUID, Summary> payments,
        Map<UUID, String> assigneeNames,
        Map<UUID, List<UUID>> resourceIds) {
    }

    /** One booking, at the cost of three queries. Never call this per row. */
    public BookingResponse withLookups(Booking booking) {
        return toResponse(
            booking,
            paymentStateResolver.resolve(booking.getId()),
            assigneeName(booking.getAssignedUserId()),
            bookingResourceRepository.findByBookingId(booking.getId()).stream()
                .map(BookingResource::getResourceId)
                .toList());
    }

    /** Batch lookups for a whole page. */
    public PageLookups forPage(List<Booking> bookings) {
        if (bookings.isEmpty()) {
            return new PageLookups(Map.of(), Map.of(), Map.of());
        }
        List<UUID> bookingIds = bookings.stream().map(Booking::getId).toList();
        return new PageLookups(
            paymentStateResolver.resolveAll(bookingIds),
            assigneeNames(bookings),
            resourceIdsFor(bookingIds));
    }

    public BookingResponse toResponse(Booking booking, PageLookups lookups) {
        UUID assignee = booking.getAssignedUserId();
        return toResponse(
            booking,
            // resolveAll contracts to hold an entry per requested id, including
            // NOT_INVOICED for bookings with no invoice at all — see the test
            // that pins it. getOrDefault anyway, because a null here would 500
            // the whole list over one row.
            lookups.payments().getOrDefault(booking.getId(), Summary.none()),
            assignee == null ? null : lookups.assigneeNames().get(assignee),
            lookups.resourceIds().getOrDefault(booking.getId(), List.of()));
    }

    public CustomerBookingResponse toCustomerResponse(Booking booking, Summary payment) {
        Summary p = payment != null ? payment : Summary.none();
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
            p.state().name(),
            p.paidCents(),
            booking.getCreatedAt()
        );
    }

    private BookingResponse toResponse(
        Booking booking, Summary payment, String assigneeName, List<UUID> resourceIds) {
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
            assigneeName,
            resourceIds,
            booking.getCreatedAt()
        );
    }

    /**
     * Resource links for a whole page, in one query.
     *
     * <p>Bookings with none are absent from the map rather than present with an
     * empty list; the caller defaults, which keeps this a straight groupBy.
     */
    private Map<UUID, List<UUID>> resourceIdsFor(List<UUID> bookingIds) {
        return bookingResourceRepository.findByBookingIdIn(bookingIds).stream()
            .collect(Collectors.groupingBy(
                BookingResource::getBookingId,
                Collectors.mapping(BookingResource::getResourceId, Collectors.toList())));
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
            .collect(Collectors.toMap(User::getId, BookingMapper::displayName));
    }

    private String assigneeName(UUID userId) {
        if (userId == null) {
            return null;
        }
        return userRepository.findById(userId).map(BookingMapper::displayName).orElse(null);
    }

    private static String displayName(User user) {
        return user.getFullName() != null && !user.getFullName().isBlank()
            ? user.getFullName()
            : user.getEmail();
    }
}
