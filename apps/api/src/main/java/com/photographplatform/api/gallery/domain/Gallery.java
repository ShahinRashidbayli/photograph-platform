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

@Entity
@Table(name = "galleries")
public class Gallery {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, updatable = false)
    private UUID tenantId;

    @Column(name = "booking_id")
    private UUID bookingId;

    @Column(name = "access_token", nullable = false, length = 64)
    private String accessToken;

    @Column(name = "expires_at")
    private OffsetDateTime expiresAt;

    @Column(name = "download_enabled", nullable = false)
    private Boolean downloadEnabled = true;

    @Column(name = "watermark_enabled", nullable = false)
    private Boolean watermarkEnabled = false;

    @Column(name = "view_count", nullable = false)
    private Integer viewCount = 0;

    // ── retention (ADR-001) ────────────────────────────────────────────────

    @Column(name = "delivered_at")
    private OffsetDateTime deliveredAt;

    @Column(name = "retention_days")
    private Integer retentionDays;

    @Column(name = "expiry_state", nullable = false, length = 20)
    private String expiryState = GalleryExpiryState.ACTIVE.name();

    @Column(name = "soft_deleted_at")
    private OffsetDateTime softDeletedAt;

    @Column(name = "purge_after")
    private OffsetDateTime purgeAfter;

    @Column(name = "purged_at")
    private OffsetDateTime purgedAt;

    @Column(name = "extended_at")
    private OffsetDateTime extendedAt;

    @Column(name = "extension_count", nullable = false)
    private Integer extensionCount = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected Gallery() {
    }

    /**
     * A gallery is delivered the moment it is created: the access token is
     * live immediately, so this is the point ADR-001 §2 means by "delivered",
     * and retention starts counting here.
     *
     * <p>{@code expiresAt} is derived from {@code retentionDays}, never passed
     * in. ADR-001 §4 is explicit — "enforce server-side; a client-supplied
     * value must never decide it" — and retention is what the plans actually
     * sell, so accepting a date from the browser would let any tenant grant
     * itself Studio's two years.
     */
    public Gallery(UUID bookingId, OffsetDateTime deliveredAt, int retentionDays,
                   boolean downloadEnabled, boolean watermarkEnabled) {
        this.bookingId = bookingId;
        this.accessToken = generateToken();
        this.deliveredAt = deliveredAt;
        this.retentionDays = retentionDays;
        this.expiresAt = deliveredAt.plusDays(retentionDays);
        this.downloadEnabled = downloadEnabled;
        this.watermarkEnabled = watermarkEnabled;
        this.viewCount = 0;
        this.extensionCount = 0;
        this.expiryState = GalleryExpiryState.ACTIVE.name();
    }

    /**
     * 64-char opaque share token. The column also carries a DB default, but a
     * JPA insert always supplies every column, so the token is generated here
     * rather than relying on the default ever firing.
     */
    private static String generateToken() {
        return UUID.randomUUID().toString().replace("-", "")
            + UUID.randomUUID().toString().replace("-", "");
    }

    public UUID getId() {
        return id;
    }

    public UUID getTenantId() {
        return tenantId;
    }

    public void setTenantId(UUID tenantId) {
        this.tenantId = tenantId;
    }

    public UUID getBookingId() {
        return bookingId;
    }

    public String getAccessToken() {
        return accessToken;
    }

    public OffsetDateTime getExpiresAt() {
        return expiresAt;
    }

    public Boolean getDownloadEnabled() {
        return downloadEnabled;
    }

    public Boolean getWatermarkEnabled() {
        return watermarkEnabled;
    }

    public Integer getViewCount() {
        return viewCount;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setExpiresAt(OffsetDateTime expiresAt) {
        this.expiresAt = expiresAt;
    }

    public void setDownloadEnabled(Boolean downloadEnabled) {
        this.downloadEnabled = downloadEnabled;
    }

    public void setWatermarkEnabled(Boolean watermarkEnabled) {
        this.watermarkEnabled = watermarkEnabled;
    }


    // ── retention behaviour (ADR-001) ──────────────────────────────────────

    public OffsetDateTime getDeliveredAt() {
        return deliveredAt;
    }

    public Integer getRetentionDays() {
        return retentionDays;
    }

    public GalleryExpiryState getExpiryState() {
        return GalleryExpiryState.from(expiryState);
    }

    public OffsetDateTime getSoftDeletedAt() {
        return softDeletedAt;
    }

    public OffsetDateTime getPurgeAfter() {
        return purgeAfter;
    }

    public OffsetDateTime getPurgedAt() {
        return purgedAt;
    }

    public OffsetDateTime getExtendedAt() {
        return extendedAt;
    }

    public Integer getExtensionCount() {
        return extensionCount;
    }

    /**
     * True when a client holding the link may still see the photos.
     *
     * <p>Checks the state AND the date. The state alone is not enough: a
     * gallery is only moved to EXPIRED by a job that runs on a schedule, so
     * between the moment it expires and the moment the sweep reaches it, it is
     * still ACTIVE with a date in the past. Trusting the state there would
     * serve photos past the window the plan sold — for up to a day.
     */
    public boolean isReachable(OffsetDateTime now) {
        return getExpiryState() == GalleryExpiryState.ACTIVE
            && (expiresAt == null || expiresAt.isAfter(now));
    }

    /**
     * Revokes access but keeps the bytes (ADR-001 §4.3).
     *
     * <p>The grace period before {@code purgeAfter} is margin for our own
     * mistakes, not the customer's: if a bad query expires the wrong tenant,
     * this is the window in which that is still fixable.
     */
    public void markExpired(OffsetDateTime now, int graceDays) {
        this.expiryState = GalleryExpiryState.EXPIRED.name();
        this.softDeletedAt = now;
        this.purgeAfter = now.plusDays(graceDays);
    }

    /** Bytes are gone; the row stays as a tombstone. */
    public void markPurged(OffsetDateTime now) {
        this.expiryState = GalleryExpiryState.PURGED.name();
        this.purgedAt = now;
    }

    /**
     * Grants one more full retention window, measured from now (ADR-001 §4.2).
     *
     * <p>Deliberately works on an EXPIRED gallery too. That is the entire
     * value of the grace period: without recovery here, every missed window
     * becomes a support ticket nobody can resolve because the data is already
     * gone. A PURGED gallery cannot be revived — there is nothing left to
     * point at — and {@link #canExtend()} is what callers check first.
     *
     * <p>Measured from now rather than from the old expiry so that extending a
     * gallery that lapsed three weeks ago actually gives the client time to
     * download, instead of restoring it into a window that has already passed.
     *
     * <p>Never moves the expiry earlier. After a downgrade the plan window can
     * be shorter than what a gallery still has left, and resetting to it
     * would cut a two-year gallery to sixty days with one click — and the
     * retention job deletes the photos once that date passes.
     *
     * @return whether anything changed. A live gallery that already runs past
     *     the plan window is left exactly as it was — counting that as an
     *     extension would put one in the history and audit log that never
     *     happened.
     */
    public boolean extend(OffsetDateTime now, int retentionDays) {
        OffsetDateTime renewed = now.plusDays(retentionDays);
        // A null expiry is "never expires" — later than any window, so it stays.
        boolean movesExpiry = expiresAt != null && renewed.isAfter(expiresAt);
        boolean revives = getExpiryState() != GalleryExpiryState.ACTIVE;
        if (!movesExpiry && !revives) {
            return false;
        }
        if (movesExpiry) {
            this.retentionDays = retentionDays;
            this.expiresAt = renewed;
        }
        this.expiryState = GalleryExpiryState.ACTIVE.name();
        this.softDeletedAt = null;
        this.purgeAfter = null;
        this.extendedAt = now;
        this.extensionCount = (this.extensionCount == null ? 0 : this.extensionCount) + 1;
        return true;
    }

    /** Purged galleries have no bytes left to bring back. */
    public boolean canExtend() {
        return getExpiryState() != GalleryExpiryState.PURGED;
    }
}
