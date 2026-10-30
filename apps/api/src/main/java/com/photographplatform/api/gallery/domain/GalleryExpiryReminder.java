package com.photographplatform.api.gallery.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

/**
 * Proof that a specific expiry warning was sent to a specific gallery's client.
 *
 * <p>The {@code (gallery_id, days_before)} unique constraint is load-bearing,
 * not bookkeeping: it is what makes the reminder phase idempotent (ADR-001 §4).
 * A re-run, an overlapping sweep, or two instances racing past a lease all try
 * to insert the same row and the second one fails — so a client cannot be
 * emailed three times in one morning about their wedding photos expiring.
 */
@Entity
@Table(name = "gallery_expiry_reminders")
public class GalleryExpiryReminder {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, updatable = false)
    private UUID tenantId;

    @Column(name = "gallery_id", nullable = false, updatable = false)
    private UUID galleryId;

    @Column(name = "days_before", nullable = false, updatable = false)
    private Integer daysBefore;

    @CreationTimestamp
    @Column(name = "sent_at", nullable = false, updatable = false)
    private OffsetDateTime sentAt;

    protected GalleryExpiryReminder() {
    }

    public GalleryExpiryReminder(UUID tenantId, UUID galleryId, int daysBefore) {
        this.tenantId = tenantId;
        this.galleryId = galleryId;
        this.daysBefore = daysBefore;
    }

    public UUID getId() {
        return id;
    }

    public UUID getGalleryId() {
        return galleryId;
    }

    public Integer getDaysBefore() {
        return daysBefore;
    }

    public OffsetDateTime getSentAt() {
        return sentAt;
    }
}
