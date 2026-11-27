package com.photographplatform.api.inquiry.event;

import com.photographplatform.api.common.domain.CustomerLanguage;
import java.time.Instant;
import java.util.UUID;
import org.springframework.context.ApplicationEvent;

/**
 * Published when the photographer accepts or declines a Customer's request,
 * inside the decision's transaction, so a listener that runs before commit
 * queues its message only if the decision itself commits (ADR-005).
 *
 * <p>Carries everything the Customer message needs, so the listener does not
 * read the inquiry back. The personal note travels here and into the outbox
 * params only: it is never stored on the inquiry, and never audited.
 */
public class InquiryDecidedEvent extends ApplicationEvent {

    private final UUID inquiryId;
    private final UUID tenantId;
    private final String recipientEmail;
    private final String recipientName;
    private final CustomerLanguage language;
    private final boolean accepted;
    private final UUID bookingId;
    private final String note;
    private final Instant sentAt;

    /**
     * @param bookingId the booking the request became; null when declined
     * @param note      the photographer's personal note; null when they wrote none
     * @param sentAt    when the photographer decided
     */
    @SuppressWarnings("checkstyle:ParameterNumber")
    public InquiryDecidedEvent(Object source, UUID inquiryId, UUID tenantId, String recipientEmail,
                               String recipientName, CustomerLanguage language, boolean accepted,
                               UUID bookingId, String note, Instant sentAt) {
        super(source);
        this.inquiryId = inquiryId;
        this.tenantId = tenantId;
        this.recipientEmail = recipientEmail;
        this.recipientName = recipientName;
        this.language = language;
        this.accepted = accepted;
        this.bookingId = bookingId;
        this.note = note;
        this.sentAt = sentAt;
    }

    public UUID getInquiryId() {
        return inquiryId;
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

    public boolean isAccepted() {
        return accepted;
    }

    public UUID getBookingId() {
        return bookingId;
    }

    public String getNote() {
        return note;
    }

    public Instant getSentAt() {
        return sentAt;
    }
}
