package com.photographplatform.api.lead.event;

import com.photographplatform.api.common.domain.CustomerLanguage;
import java.util.Objects;
import java.util.UUID;
import org.springframework.context.ApplicationEvent;

public class LeadCreatedEvent extends ApplicationEvent {

    /**
     * Where the lead came from. Listeners that write to the Customer must
     * ignore {@link #ENTERED_BY_STUDIO}: the studio typed in a conversation
     * it already had, and an automatic reply to it read like a form letter,
     * with an empty studio name and a {@code /p/null} link (#103).
     */
    public enum Origin {
        /** Sent by the Customer through the studio's public request form. */
        PUBLIC_FORM,
        /** Typed in by the studio's owner or staff. */
        ENTERED_BY_STUDIO
    }

    private final UUID leadId;
    private final UUID tenantId;
    private final String clientName;
    private final String clientEmail;
    private final String score;
    private final Origin origin;
    private final CustomerLanguage language;
    private final String photographerEmail;

    /**
     * A lead the Customer sent through the studio's public request form.
     *
     * <p>No studio name: {@code messaging} resolves who is speaking itself, at
     * queue time, the same way for every Customer message.
     *
     * @param language   the form's UI language, which the Customer reads
     * @param ownerEmail where the "New lead" alert goes
     */
    public static LeadCreatedEvent fromPublicForm(Object source, UUID leadId, UUID tenantId, String clientName,
                                                  String clientEmail, String score, CustomerLanguage language,
                                                  String ownerEmail) {
        return new LeadCreatedEvent(source, leadId, tenantId, clientName, clientEmail, score,
            Origin.PUBLIC_FORM, language, ownerEmail);
    }

    /**
     * A lead the studio's owner or staff typed in. Nothing writes to the
     * Customer about it, but the language still travels, so a listener added
     * later reads the lead as it was stored.
     */
    public static LeadCreatedEvent enteredByStudio(Object source, UUID leadId, UUID tenantId, String clientName,
                                                   String clientEmail, String score, CustomerLanguage language,
                                                   String enteredByEmail) {
        return new LeadCreatedEvent(source, leadId, tenantId, clientName, clientEmail, score,
            Origin.ENTERED_BY_STUDIO, language, enteredByEmail);
    }

    private LeadCreatedEvent(Object source, UUID leadId, UUID tenantId, String clientName, String clientEmail,
                             String score, Origin origin, CustomerLanguage language, String photographerEmail) {
        super(source);
        this.leadId = leadId;
        this.tenantId = tenantId;
        this.clientName = clientName;
        this.clientEmail = clientEmail;
        this.score = score;
        this.origin = origin;
        this.language = Objects.requireNonNull(language, "language");
        this.photographerEmail = photographerEmail;
    }

    public UUID getLeadId() {
        return leadId;
    }

    public UUID getTenantId() {
        return tenantId;
    }

    public String getClientName() {
        return clientName;
    }

    public String getClientEmail() {
        return clientEmail;
    }

    public String getScore() {
        return score;
    }

    public Origin getOrigin() {
        return origin;
    }

    public CustomerLanguage getLanguage() {
        return language;
    }

    public String getPhotographerEmail() {
        return photographerEmail;
    }
}
