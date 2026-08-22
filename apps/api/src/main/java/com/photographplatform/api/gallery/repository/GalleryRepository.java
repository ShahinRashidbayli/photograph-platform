package com.photographplatform.api.gallery.repository;

import com.photographplatform.api.gallery.domain.Gallery;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GalleryRepository extends JpaRepository<Gallery, UUID> {

    Optional<Gallery> findByAccessToken(String accessToken);

    /**
     * Atomically bumps a gallery's view counter.
     *
     * <p>Replaces a read-modify-write through the entity
     * ({@code incrementViewCount()} then {@code save()}), which was both
     * slower and wrong: two visitors loading the same gallery concurrently
     * each read the old count and each wrote {@code old + 1}, so one of the
     * views was silently lost. Doing the arithmetic in SQL makes the update
     * atomic under Postgres' row lock, and touches one column instead of
     * flushing the whole dirty-checked entity on what is otherwise a pure
     * read path.
     */
    @Modifying
    @Query("UPDATE Gallery g SET g.viewCount = g.viewCount + 1 WHERE g.id = :id")
    void incrementViewCount(@Param("id") UUID id);

    /**
     * One row per gallery joined with its parent booking and a count of
     * delivery photos. Native query so we can mix LEFT JOIN aggregation
     * with the gallery row in a single round-trip.
     */
    @Query(value = """
        SELECT g.id              AS id,
               g.booking_id      AS bookingId,
               g.access_token    AS accessToken,
               g.expires_at      AS expiresAt,
               g.download_enabled AS downloadEnabled,
               g.watermark_enabled AS watermarkEnabled,
               g.view_count      AS viewCount,
               g.created_at      AS createdAt,
               g.expiry_state    AS expiryState,
               g.retention_days  AS retentionDays,
               g.purge_after     AS purgeAfter,
               g.extension_count AS extensionCount,
               b.client_name     AS bookingName,
               b.event_type      AS eventType,
               b.event_date      AS shootDate,
               COALESCE((SELECT COUNT(*) FROM delivery_photos dp
                         WHERE dp.gallery_id = g.id), 0) AS photoCount
        FROM galleries g
        LEFT JOIN bookings b ON b.id = g.booking_id
        ORDER BY g.created_at DESC
        """, nativeQuery = true)
    List<GalleryStatsView> findAllWithStats();

    /** Same projection as {@link #findAllWithStats()} for a single gallery. */
    @Query(value = """
        SELECT g.id              AS id,
               g.booking_id      AS bookingId,
               g.access_token    AS accessToken,
               g.expires_at      AS expiresAt,
               g.download_enabled AS downloadEnabled,
               g.watermark_enabled AS watermarkEnabled,
               g.view_count      AS viewCount,
               g.created_at      AS createdAt,
               g.expiry_state    AS expiryState,
               g.retention_days  AS retentionDays,
               g.purge_after     AS purgeAfter,
               g.extension_count AS extensionCount,
               b.client_name     AS bookingName,
               b.event_type      AS eventType,
               b.event_date      AS shootDate,
               COALESCE((SELECT COUNT(*) FROM delivery_photos dp
                         WHERE dp.gallery_id = g.id), 0) AS photoCount
        FROM galleries g
        LEFT JOIN bookings b ON b.id = g.booking_id
        WHERE g.id = :id
        """, nativeQuery = true)
    Optional<GalleryStatsView> findStatsById(@Param("id") UUID id);

    // ── retention sweep (ADR-001) ─────────────────────────────────────────
    // No explicit tenant predicate on any of these: they run inside
    // TenantJobRunner with app.tenant_id bound, and the RLS policies from V11
    // scope them. Adding a redundant filter would suggest RLS is optional here,
    // which is exactly the assumption that lets a future query leak across
    // tenants.

    /**
     * ACTIVE galleries whose expiry falls inside the warning horizon, oldest
     * deadline first so the most urgent client is warned even if the per-run
     * cap truncates the batch.
     */
    @Query("""
        SELECT g FROM Gallery g
         WHERE g.expiryState = 'ACTIVE'
           AND g.expiresAt IS NOT NULL
           AND g.expiresAt > :now
           AND g.expiresAt <= :horizon
         ORDER BY g.expiresAt ASC
        """)
    List<Gallery> findDueForReminder(
        @Param("now") OffsetDateTime now,
        @Param("horizon") OffsetDateTime horizon,
        Pageable page);

    /** ACTIVE galleries whose window has run out. */
    @Query("""
        SELECT g FROM Gallery g
         WHERE g.expiryState = 'ACTIVE'
           AND g.expiresAt IS NOT NULL
           AND g.expiresAt <= :now
         ORDER BY g.expiresAt ASC
        """)
    List<Gallery> findDueForExpiry(@Param("now") OffsetDateTime now, Pageable page);

    /**
     * EXPIRED galleries whose grace period has run out — the only rows the
     * destructive phase is ever allowed to look at.
     */
    @Query("""
        SELECT g FROM Gallery g
         WHERE g.expiryState = 'EXPIRED'
           AND g.purgeAfter IS NOT NULL
           AND g.purgeAfter <= :now
         ORDER BY g.purgeAfter ASC
        """)
    List<Gallery> findDueForPurge(@Param("now") OffsetDateTime now, Pageable page);

    interface GalleryStatsView {
        UUID getId();
        UUID getBookingId();
        String getAccessToken();
        Instant getExpiresAt();
        Boolean getDownloadEnabled();
        Boolean getWatermarkEnabled();
        Integer getViewCount();
        Instant getCreatedAt();
        String getExpiryState();
        Integer getRetentionDays();
        Instant getPurgeAfter();
        Integer getExtensionCount();
        String getBookingName();
        String getEventType();
        LocalDate getShootDate();
        Long getPhotoCount();
    }
}
