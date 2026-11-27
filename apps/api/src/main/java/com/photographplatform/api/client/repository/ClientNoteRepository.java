package com.photographplatform.api.client.repository;

import com.photographplatform.api.client.domain.ClientNote;
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

/**
 * The client directory: the studio's bookings grouped by client address, plus
 * the notes written about each client.
 *
 * <p>One person is one {@code lower(btrim(client_email))}, the identity V38
 * already signs customers in by. Every figure is computed on read, so a
 * booking created, edited or cancelled anywhere shows here at once:
 *
 * <ul>
 *   <li>name: from the client's most recently created booking;</li>
 *   <li>bookings: every booking that is not Not happening;</li>
 *   <li>upcoming: those dated {@code :today} or later and not yet completed;</li>
 *   <li>last session: the latest such date up to {@code :today};</li>
 *   <li>spent: succeeded payments on invoices for the client's bookings, any
 *       status, since a payment on a withdrawn invoice carries over (ADR-004);</li>
 *   <li>joined: when their first booking was created.</li>
 * </ul>
 *
 * <p>The id is a hash of tenant and address rather than a stored key, so a
 * client has a stable id from their first booking on without a row to create,
 * and the address itself never travels in a URL. Anonymised bookings ({@code
 * :erasedPattern}) are left out, or each would list as a client of its own.
 * Tenant isolation is RLS's job, on {@code bookings}, {@code invoices}, {@code
 * payments} and {@code client_notes} alike; the joins still carry {@code
 * tenant_id}, because the id is already per tenant and an address shared by
 * two studios must never pick up the other's spend or notes.
 */
public interface ClientNoteRepository extends JpaRepository<ClientNote, UUID> {

    String DIRECTORY = """
        WITH person_bookings AS (
            SELECT b.tenant_id, lower(btrim(b.client_email)) AS email, b.client_name,
                   b.status, b.event_date, b.created_at
            FROM bookings b
            WHERE b.client_email NOT LIKE :erasedPattern
        ),
        directory AS (
            SELECT CAST(md5(CAST(pb.tenant_id AS text) || ':' || pb.email) AS uuid) AS id,
                   pb.tenant_id,
                   pb.email,
                   (array_agg(pb.client_name ORDER BY pb.created_at DESC))[1] AS full_name,
                   COUNT(*) FILTER (WHERE pb.status NOT IN (:notHappening)) AS total_bookings,
                   COUNT(*) FILTER (WHERE pb.event_date >= :today
                                      AND pb.status <> 'COMPLETED'
                                      AND pb.status NOT IN (:notHappening)) AS upcoming_bookings,
                   MAX(pb.event_date) FILTER (WHERE pb.event_date <= :today
                                                AND pb.status NOT IN (:notHappening)) AS last_booking_date,
                   MIN(pb.created_at) AS created_at,
                   MAX(pb.created_at) AS last_activity
            FROM person_bookings pb
            GROUP BY pb.tenant_id, pb.email
        ),
        spend AS (
            SELECT b.tenant_id, lower(btrim(b.client_email)) AS email, SUM(p.amount_cents) AS spent_cents
            FROM payments p
            JOIN invoices i ON i.id = p.invoice_id
            JOIN bookings b ON b.id = i.booking_id
            WHERE p.status = 'SUCCEEDED'
            GROUP BY b.tenant_id, lower(btrim(b.client_email))
        )
        SELECT d.id                                      AS id,
               d.email                                   AS email,
               d.full_name                               AS fullName,
               n.notes                                   AS notes,
               CAST(d.total_bookings AS integer)         AS totalBookings,
               CAST(COALESCE(s.spent_cents, 0) AS bigint) AS totalSpentCents,
               CAST(d.upcoming_bookings AS integer)      AS upcomingBookings,
               d.last_booking_date                       AS lastBookingDate,
               d.created_at                              AS createdAt
        FROM directory d
        LEFT JOIN spend s        ON s.tenant_id = d.tenant_id AND s.email = d.email
        LEFT JOIN client_notes n ON n.tenant_id = d.tenant_id AND n.email = d.email
        """;

    /** The whole directory, most recently booked first. */
    @Query(value = DIRECTORY + " ORDER BY d.last_activity DESC", nativeQuery = true)
    List<ClientView> findDirectory(
        @Param("today") LocalDate today,
        @Param("notHappening") Collection<String> notHappening,
        @Param("erasedPattern") String erasedPattern,
        Limit limit);

    /** One directory entry by its derived id; empty when no booking carries it. */
    @Query(value = DIRECTORY + " WHERE d.id = :id", nativeQuery = true)
    Optional<ClientView> findDirectoryEntry(
        @Param("id") UUID id,
        @Param("today") LocalDate today,
        @Param("notHappening") Collection<String> notHappening,
        @Param("erasedPattern") String erasedPattern);

    Optional<ClientNote> findByEmail(String normalizedEmail);

    interface ClientView {
        UUID getId();
        String getEmail();
        String getFullName();
        String getNotes();
        Integer getTotalBookings();
        Long getTotalSpentCents();
        Integer getUpcomingBookings();
        LocalDate getLastBookingDate();
        Instant getCreatedAt();
    }
}
