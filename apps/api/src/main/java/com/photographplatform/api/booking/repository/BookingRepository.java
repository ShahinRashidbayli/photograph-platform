package com.photographplatform.api.booking.repository;

import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.domain.BookingStatus;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BookingRepository extends JpaRepository<Booking, UUID> {

    /**
     * The studios that have a booking for this address, across tenants.
     *
     * <p>The one query in the application that looks past the tenant a
     * transaction is bound to, and it does so through {@code
     * customer_login_tenants} (V38), which stays under RLS: it runs as the
     * application role and binds each studio in turn. It returns tenant ids
     * only. Its sole caller is sign-in by email, which needs to know which
     * studios to send a code for.
     */
    @Query(value = "SELECT CAST(t AS uuid) FROM customer_login_tenants(:email) AS t", nativeQuery = true)
    List<UUID> findTenantsWithClientEmail(@Param("email") String email);

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

    /**
     * The booking, if it belongs to this tenant.
     *
     * <p>Row-level security already scopes {@code findById} — V11 puts a
     * FORCE'd policy on {@code bookings} keyed on {@code app.tenant_id}, and
     * an unset setting matches nothing, so it fails closed. This exists
     * anyway, for two reasons. It states the authorization rule where a reader
     * of the service can see it, instead of leaving "why is this safe" to be
     * answered by a migration three hundred lines long. And it makes the
     * booking path consistent with the assignee check next to it, which
     * <em>cannot</em> lean on RLS at all: V11 deliberately leaves {@code users}
     * without a policy, so two adjacent lookups in the same method had two
     * different rules and no way to tell which was which.
     */
    Optional<Booking> findByIdAndTenantId(UUID id, UUID tenantId);

    Slice<Booking> findAllBy(Pageable pageable);

    Slice<Booking> findByStatus(BookingStatus status, Pageable pageable);

    /**
     * What else this photographer is already booked for that day.
     *
     * <p>{@link BookingStatus#NOT_HAPPENING} is excluded: a shoot that is not
     * happening cannot clash with one that is, and warning about it would
     * train the photographer to ignore the warning. Passed as a parameter
     * rather than written into the query, so this and the resource-clash
     * query cannot come to disagree about which states those are.
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
          AND b.status NOT IN :notHappening
        ORDER BY b.eventTime ASC NULLS LAST
        """)
    List<Booking> findSameDayForPhotographer(
        @Param("userId") UUID userId,
        @Param("date") LocalDate date,
        @Param("excludeId") UUID excludeId,
        @Param("notHappening") Collection<BookingStatus> notHappening);

    /*
     * ── What a signed-in customer owns ──────────────────────────────────────
     *
     * Keyed on customer_user_id, with an email fallback for rows that have not
     * been linked to an account yet — a booking the photographer took over the
     * phone exists before its customer does, and refusing to show it once they
     * sign up would be a regression, not a fix. See V31.
     *
     * The fallback applies only where the link is absent. That is the whole
     * security property: once a booking names a customer, editing client_email
     * cannot hand it, or its invoices and payments, to somebody else.
     *
     * Case-insensitive because emails are stored lower-cased on write but
     * callers should not depend on that.
     */

    String OWNED_BY_CALLER = """
        (b.customerUserId = :userId
         OR (b.customerUserId IS NULL AND lower(b.clientEmail) = lower(:email)))
        """;

    @Query("SELECT b FROM Booking b WHERE " + OWNED_BY_CALLER)
    Slice<Booking> findOwnedBy(
        @Param("userId") UUID userId, @Param("email") String email, Pageable pageable);

    @Query("SELECT b FROM Booking b WHERE " + OWNED_BY_CALLER + " AND b.status = :status")
    Slice<Booking> findOwnedByAndStatus(
        @Param("userId") UUID userId, @Param("email") String email,
        @Param("status") BookingStatus status, Pageable pageable);

    /**
     * Unpaged — used only to resolve which bookings (and so which invoices) a
     * customer owns. Bounded in practice by one person's own booking history
     * with one photographer, which is a handful of rows, not a listing that
     * needs paging.
     */
    @Query("SELECT b FROM Booking b WHERE " + OWNED_BY_CALLER)
    List<Booking> findOwnedBy(@Param("userId") UUID userId, @Param("email") String email);

    /** Whether this booking is one of {@code userId}'s. */
    @Query("SELECT COUNT(b) > 0 FROM Booking b WHERE b.id = :bookingId AND " + OWNED_BY_CALLER)
    boolean isOwnedBy(
        @Param("bookingId") UUID bookingId,
        @Param("userId") UUID userId,
        @Param("email") String email);

    /**
     * Every booking that belongs to one person, for Art. 17 erasure.
     *
     * <p>The {@link #OWNED_BY_CALLER} rule — the bookings that person sees when
     * they sign in — widened by the directory entries that carry their address.
     * Keeping to that rule matters for the same reason it exists: a booking
     * already linked to somebody else's account is that person's, whatever
     * address is typed into it, so it is never erased on a match of the
     * address alone.
     */
    @Query("""
        SELECT b FROM Booking b
        WHERE b.customerUserId = :userId
           OR (b.customerUserId IS NULL
               AND (lower(b.clientEmail) = :email OR b.clientId IN :clientIds))
        """)
    List<Booking> findForErasure(
        @Param("userId") UUID userId, @Param("email") String email, @Param("clientIds") Collection<UUID> clientIds);
}
