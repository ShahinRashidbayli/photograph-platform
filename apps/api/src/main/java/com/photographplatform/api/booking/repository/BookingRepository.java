package com.photographplatform.api.booking.repository;

import com.photographplatform.api.booking.domain.Booking;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BookingRepository extends JpaRepository<Booking, UUID> {

    /*
     * The list methods return Slice, not Page. A Page runs a second COUNT query
     * to populate totals, and every caller here immediately discarded them: the
     * endpoints answer a JSON array, and the clients page by asking for N rows
     * and stopping when they get fewer than N back. That is exactly what a
     * Slice knows and a Page pays extra for.
     *
     * Ordering comes from the Pageable the service builds, so it is not spelled
     * into the method names as well — two sources for one ORDER BY is one edit
     * away from disagreeing.
     */

    Slice<Booking> findAllBy(Pageable pageable);

    Slice<Booking> findByStatus(String status, Pageable pageable);

    /**
     * What else this photographer is already booked for that day.
     *
     * <p>Cancelled and declined are excluded: a shoot that is not happening
     * cannot clash with one that is, and warning about it would train the
     * photographer to ignore the warning.
     *
     * <p>Tenant scoping comes from RLS on this path — it is a JPA query, and
     * every repository here relies on the same policy.
     *
     * @param excludeId the booking being edited, so it does not clash with
     *                  itself; null when creating a new one, which excludes
     *                  nothing. It used to be a caller-minted {@code
     *                  UUID.randomUUID()} standing in for "no exclusion" — a
     *                  real-looking id that meant the opposite of a real id.
     */
    @Query("""
        SELECT b FROM Booking b
        WHERE b.assignedUserId = :userId
          AND b.eventDate = :date
          AND (:excludeId IS NULL OR b.id <> :excludeId)
          AND b.status NOT IN ('CANCELLED', 'DECLINED')
        ORDER BY b.eventTime ASC NULLS LAST
        """)
    List<Booking> findSameDayForPhotographer(
        @Param("userId") UUID userId,
        @Param("date") LocalDate date,
        @Param("excludeId") UUID excludeId);

    // Customer-facing lookups are keyed on the booking's client_email rather
    // than client_id: a booking may exist before its Client directory row does
    // (e.g. created straight from a lead), and the authenticated customer's
    // identity is their email. Case-insensitive because emails are stored
    // lower-cased on write but callers should not depend on that.
    Slice<Booking> findByClientEmailIgnoreCase(String clientEmail, Pageable pageable);

    Slice<Booking> findByClientEmailIgnoreCaseAndStatus(
        String clientEmail, String status, Pageable pageable);

    /**
     * Unpaged — used only to resolve which bookings (and so which invoices) a
     * customer owns. Bounded in practice by one person's own booking history
     * with one photographer, which is a handful of rows, not a listing that
     * needs paging.
     */
    List<Booking> findByClientEmailIgnoreCase(String clientEmail);
}
