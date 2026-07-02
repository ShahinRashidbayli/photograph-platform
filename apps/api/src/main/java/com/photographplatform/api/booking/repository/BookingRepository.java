package com.photographplatform.api.booking.repository;

import com.photographplatform.api.booking.domain.Booking;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BookingRepository extends JpaRepository<Booking, UUID> {
    Page<Booking> findByStatus(String status, Pageable pageable);

    Page<Booking> findByOrderByEventDateAsc(Pageable pageable);

    Page<Booking> findByClientIdOrderByEventDateAsc(UUID clientId, Pageable pageable);

    Page<Booking> findByClientIdAndStatus(UUID clientId, String status, Pageable pageable);

    /**
     * Calendar-feed query. Either bound is optional so an unbounded sweep is
     * still possible, but the common path — FullCalendar passing the visible
     * window's {@code from}/{@code to} on every nav — pushes the date filter
     * into the database instead of fetching every row and filtering in Java.
     * Without this, the calendar response scales linearly with total booking
     * history; with it, only the rendered window is loaded.
     */
    @Query(
        "SELECT b FROM Booking b "
        + "WHERE (:from IS NULL OR b.eventDate >= :from) "
        + "  AND (:to   IS NULL OR b.eventDate <= :to) "
        + "ORDER BY b.eventDate ASC"
    )
    List<Booking> findCalendarFeed(
        @Param("from") LocalDate from,
        @Param("to") LocalDate to
    );

    // Customer-facing lookups are keyed on the booking's client_email rather
    // than client_id: a booking may exist before its Client directory row does
    // (e.g. created straight from a lead), and the authenticated customer's
    // identity is their email. Case-insensitive because emails are stored
    // lower-cased on write but callers should not depend on that.
    Page<Booking> findByClientEmailIgnoreCaseOrderByEventDateAsc(String clientEmail, Pageable pageable);

    Page<Booking> findByClientEmailIgnoreCaseAndStatus(String clientEmail, String status, Pageable pageable);
}
