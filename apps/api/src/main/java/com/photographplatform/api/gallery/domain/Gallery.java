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

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected Gallery() {
    }

    public Gallery(UUID bookingId, OffsetDateTime expiresAt,
                   boolean downloadEnabled, boolean watermarkEnabled) {
        this.bookingId = bookingId;
        this.accessToken = generateToken();
        this.expiresAt = expiresAt;
        this.downloadEnabled = downloadEnabled;
        this.watermarkEnabled = watermarkEnabled;
        this.viewCount = 0;
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

}
