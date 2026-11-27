package com.photographplatform.api.lead.event;

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
    private final String studioName;
    private final String photographerEmail;

    /**
     * A lead the Customer sent through the studio's public request form.
     *
     * @param studioName the name the Customer knows the studio by, or null when
     *                   the studio has not entered one; never the subdomain
     * @param ownerEmail where the "New lead" alert goes
     */
    public static LeadCreatedEvent fromPublicForm(Object source, UUID leadId, UUID tenantId, String clientName,
                                                  String clientEmail, String score, String studioName,
                                                  String ownerEmail) {
        return new LeadCreatedEvent(source, leadId, tenantId, clientName, clientEmail, score,
            Origin.PUBLIC_FORM, studioName, ownerEmail);
    }

    /**
     * A lead the studio's owner or staff typed in. It takes no studio name,
     * because nothing writes to the Customer about it: with nine positional
     * arguments, a null studio name next to the typist's address was one swap
     * away from signing an email with an address (review on #141).
     */
    public static LeadCreatedEvent enteredByStudio(Object source, UUID leadId, UUID tenantId, String clientName,
                                                   String clientEmail, String score, String enteredByEmail) {
        return new LeadCreatedEvent(source, leadId, tenantId, clientName, clientEmail, score,
            Origin.ENTERED_BY_STUDIO, null, enteredByEmail);
    }

    private LeadCreatedEvent(Object source, UUID leadId, UUID tenantId, String clientName, String clientEmail,
                             String score, Origin origin, String studioName, String photographerEmail) {
        super(source);
        this.leadId = leadId;
        this.tenantId = tenantId;
        this.clientName = clientName;
        this.clientEmail = clientEmail;
        this.score = score;
        this.origin = origin;
        this.studioName = studioName;
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

    public String getStudioName() {
        return studioName;
    }

    public String getPhotographerEmail() {
        return photographerEmail;
    }
}
