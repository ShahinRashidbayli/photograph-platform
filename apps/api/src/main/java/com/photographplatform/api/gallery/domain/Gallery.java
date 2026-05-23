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

    public UUID getId() {
        return id;
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
}
