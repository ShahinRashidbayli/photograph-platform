package com.photographplatform.api.client.repository;

import com.photographplatform.api.client.domain.Client;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ClientRepository extends JpaRepository<Client, UUID> {

    /**
     * One projection row per client + count of currently-upcoming bookings:
     * event today or later, not yet completed, and not Not happening.
     *
     * <p>The Not happening statuses are a parameter, not literals, for the same
     * reason as the clash queries in {@code BookingRepository}: spelled out here
     * as {@code ('COMPLETED', 'CANCELLED')} they had already drifted, and a
     * declined enquiry for next month counted as upcoming. {@code COMPLETED}
     * stays in the SQL because it is this count's own rule, not a status group.
     *
     * The native query relies on RLS (see {@code V11__tenant_rls.sql}) so
     * `clients` and `bookings` resolve to only the calling tenant's rows —
     * RLS applies to native queries the same as JPQL/derived ones.
     */
    @Query(value = """
        SELECT c.id              AS id,
               c.email           AS email,
               c.full_name       AS fullName,
               c.phone           AS phone,
               c.notes           AS notes,
               c.total_bookings  AS totalBookings,
               c.total_spent_cents AS totalSpentCents,
               c.last_booking_date AS lastBookingDate,
               c.created_at      AS createdAt,
               COALESCE((SELECT COUNT(*) FROM bookings b
                         WHERE b.client_id = c.id
                           AND b.event_date >= CURRENT_DATE
                           AND b.status <> 'COMPLETED'
                           AND b.status NOT IN (:notHappening)), 0)
                 AS upcomingBookings
        FROM clients c
        ORDER BY c.created_at DESC
        """, nativeQuery = true)
    List<ClientStatsView> findAllWithStats(
        Limit limit, @Param("notHappening") Collection<String> notHappening);

    /**
     * The same projection for a single client.
     *
     * <p>Exists because returning one updated client used to re-run {@link
     * #findAllWithStats} — the whole tenant's directory, plus its correlated
     * subquery per row — and then filter in memory for one id. It also could
     * not distinguish "no such client" from "found", which is how a notes
     * update on an unknown id ended up answering 200 with an empty body.
     */
    @Query(value = """
        SELECT c.id              AS id,
               c.email           AS email,
               c.full_name       AS fullName,
               c.phone           AS phone,
               c.notes           AS notes,
               c.total_bookings  AS totalBookings,
               c.total_spent_cents AS totalSpentCents,
               c.last_booking_date AS lastBookingDate,
               c.created_at      AS createdAt,
               COALESCE((SELECT COUNT(*) FROM bookings b
                         WHERE b.client_id = c.id
                           AND b.event_date >= CURRENT_DATE
                           AND b.status <> 'COMPLETED'
                           AND b.status NOT IN (:notHappening)), 0)
                 AS upcomingBookings
        FROM clients c
        WHERE c.id = :id
        """, nativeQuery = true)
    Optional<ClientStatsView> findStatsById(
        @Param("id") UUID id, @Param("notHappening") Collection<String> notHappening);

    interface ClientStatsView {
        UUID getId();
        String getEmail();
        String getFullName();
        String getPhone();
        String getNotes();
        Integer getTotalBookings();
        Integer getTotalSpentCents();
        LocalDate getLastBookingDate();
        Instant getCreatedAt();
        Long getUpcomingBookings();
    }

    /** Directory entries for one address, for Art. 17 erasure. Case-insensitive, like the address itself. */
    List<Client> findByEmailIgnoreCase(String email);
}
