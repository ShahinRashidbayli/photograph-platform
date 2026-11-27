package com.photographplatform.api.gallery.event;

import com.photographplatform.api.common.domain.CustomerLanguage;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.context.ApplicationEvent;

/**
 * A gallery crossed one of its expiry warning thresholds (15, 5 and 1 days
 * before it comes down) and its Customer has to be told (ADR-001 §4.1).
 *
 * <p>Published by the retention job inside the tenant's transaction, in the
 * same transaction as the reminder row that stops a second warning: a run
 * that rolls back warns nobody and records nothing.
 */
public class GalleryExpiringEvent extends ApplicationEvent {

    private final UUID galleryId;
    private final UUID tenantId;
    private final String recipientEmail;
    private final String recipientName;
    private final CustomerLanguage language;
    private final String subdomain;
    private final String accessToken;
    private final OffsetDateTime expiresAt;
    private final int daysLeft;

    /**
     * @param expiresAt when the gallery comes down; the warning is dropped
     *                  rather than delivered after it
     * @param daysLeft  which warning this is, in whole days before expiry
     */
    @SuppressWarnings("checkstyle:ParameterNumber")
    public GalleryExpiringEvent(Object source, UUID galleryId, UUID tenantId,
                                String recipientEmail, String recipientName, CustomerLanguage language,
                                String subdomain, String accessToken, OffsetDateTime expiresAt, int daysLeft) {
        super(source);
        this.galleryId = galleryId;
        this.tenantId = tenantId;
        this.recipientEmail = recipientEmail;
        this.recipientName = recipientName;
        this.language = language;
        this.subdomain = subdomain;
        this.accessToken = accessToken;
        this.expiresAt = expiresAt;
        this.daysLeft = daysLeft;
    }

    public UUID getGalleryId() {
        return galleryId;
    }

    public UUID getTenantId() {
        return tenantId;
    }

    public String getRecipientEmail() {
        return recipientEmail;
    }

    public String getRecipientName() {
        return recipientName;
    }

    public CustomerLanguage getLanguage() {
        return language;
    }

    public String getSubdomain() {
        return subdomain;
    }

    public String getAccessToken() {
        return accessToken;
    }

    public OffsetDateTime getExpiresAt() {
        return expiresAt;
    }

    public int getDaysLeft() {
        return daysLeft;
    }
}
