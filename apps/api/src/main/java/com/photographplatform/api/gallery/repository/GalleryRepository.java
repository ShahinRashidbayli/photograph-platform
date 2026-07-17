package com.photographplatform.api.gallery.repository;

import com.photographplatform.api.gallery.domain.Gallery;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GalleryRepository extends JpaRepository<Gallery, UUID> {

    Optional<Gallery> findByAccessToken(String accessToken);

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

    interface GalleryStatsView {
        UUID getId();
        UUID getBookingId();
        String getAccessToken();
        Instant getExpiresAt();
        Boolean getDownloadEnabled();
        Boolean getWatermarkEnabled();
        Integer getViewCount();
        Instant getCreatedAt();
        String getBookingName();
        String getEventType();
        LocalDate getShootDate();
        Long getPhotoCount();
    }
}
