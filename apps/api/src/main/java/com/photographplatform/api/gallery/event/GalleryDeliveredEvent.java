package com.photographplatform.api.gallery.event;

import com.photographplatform.api.common.domain.CustomerLanguage;
import java.time.Instant;
import java.util.UUID;
import org.springframework.context.ApplicationEvent;

/**
 * The photographer sent a gallery to the Customer ("An Kunden senden"), or
 * sent it again.
 *
 * <p>Published inside the send's transaction, so a listener that runs before
 * commit queues its message only if the send itself commits (ADR-005). Every
 * send publishes it with its own {@code sentAt}: each click is one message.
 *
 * <p>Carries everything the Customer message needs, so the listener does not
 * read the gallery back. The personal note travels here and into the outbox
 * params only: it is never stored on the gallery, and never audited.
 */
public class GalleryDeliveredEvent extends ApplicationEvent {

    private final UUID galleryId;
    private final UUID tenantId;
    private final String recipientEmail;
    private final String recipientName;
    private final CustomerLanguage language;
    private final String personalNote;
    private final Instant sentAt;
    private final String subdomain;
    private final String accessToken;

    /**
     * @param recipientEmail the booking's Customer address
     * @param personalNote   the photographer's Personal note; null when they wrote none
     * @param sentAt         when the photographer clicked, this time
     * @param subdomain      the studio's, for the public gallery link
     * @param accessToken    the gallery's capability token, for the same link
     */
    @SuppressWarnings("checkstyle:ParameterNumber")
    public GalleryDeliveredEvent(Object source, UUID galleryId, UUID tenantId,
                                 String recipientEmail, String recipientName, CustomerLanguage language,
                                 String personalNote, Instant sentAt, String subdomain, String accessToken) {
        super(source);
        this.galleryId = galleryId;
        this.tenantId = tenantId;
        this.recipientEmail = recipientEmail;
        this.recipientName = recipientName;
        this.language = language;
        this.personalNote = personalNote;
        this.sentAt = sentAt;
        this.subdomain = subdomain;
        this.accessToken = accessToken;
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

    public String getPersonalNote() {
        return personalNote;
    }

    public Instant getSentAt() {
        return sentAt;
    }

    public String getSubdomain() {
        return subdomain;
    }

    public String getAccessToken() {
        return accessToken;
    }
}
