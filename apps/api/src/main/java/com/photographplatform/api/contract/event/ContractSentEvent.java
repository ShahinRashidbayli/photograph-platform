package com.photographplatform.api.contract.event;

import com.photographplatform.api.common.domain.CustomerLanguage;
import java.time.Instant;
import java.util.UUID;
import org.springframework.context.ApplicationEvent;

/**
 * The photographer sent a contract to the Customer to sign, or sent it again.
 *
 * <p>Published inside the send's transaction, so a listener that runs before
 * commit queues its message only if the send itself commits (ADR-005). A
 * resend publishes it too, with its own {@code sentAt}: each click is one
 * message.
 *
 * <p>Carries everything the Customer message needs, so the listener does not
 * read the contract back. The personal note travels here and into the outbox
 * params only: it is never stored on the contract, and never audited.
 */
public class ContractSentEvent extends ApplicationEvent {

    private final UUID contractId;
    private final UUID bookingId;
    private final UUID tenantId;
    private final String recipientEmail;
    private final String recipientName;
    private final CustomerLanguage language;
    private final String note;
    private final Instant sentAt;

    /**
     * @param recipientEmail the contract's recipient: the only address the
     *                       portal shows this contract to
     * @param note           the photographer's personal note; null when they wrote none
     * @param sentAt         when the photographer clicked, this time
     */
    @SuppressWarnings("checkstyle:ParameterNumber")
    public ContractSentEvent(Object source, UUID contractId, UUID bookingId, UUID tenantId,
                             String recipientEmail, String recipientName, CustomerLanguage language,
                             String note, Instant sentAt) {
        super(source);
        this.contractId = contractId;
        this.bookingId = bookingId;
        this.tenantId = tenantId;
        this.recipientEmail = recipientEmail;
        this.recipientName = recipientName;
        this.language = language;
        this.note = note;
        this.sentAt = sentAt;
    }

    public UUID getContractId() {
        return contractId;
    }

    public UUID getBookingId() {
        return bookingId;
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

    public String getNote() {
        return note;
    }

    public Instant getSentAt() {
        return sentAt;
    }
}
