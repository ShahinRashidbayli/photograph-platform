package com.photographplatform.api.client.repository;

import com.photographplatform.api.client.domain.Client;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ClientRepository extends JpaRepository<Client, UUID> {

    /**
     * One projection row per client + count of currently-upcoming bookings
     * (event in the future and status not COMPLETED/CANCELLED).
     *
     * The native query relies on the per-request tenant search_path so
     * `clients` and `bookings` resolve to the calling tenant's schema.
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
                           AND b.status NOT IN ('COMPLETED', 'CANCELLED')), 0)
                 AS upcomingBookings
        FROM clients c
        ORDER BY c.created_at DESC
        """, nativeQuery = true)
    List<ClientStatsView> findAllWithStats();

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
}
