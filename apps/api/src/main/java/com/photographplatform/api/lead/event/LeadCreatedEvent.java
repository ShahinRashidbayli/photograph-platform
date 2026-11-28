package com.photographplatform.api.lead.event;

import com.photographplatform.api.common.domain.CustomerLanguage;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;
import org.springframework.context.ApplicationEvent;

// final: the constructor rejects a null language, and SpotBugs (CT_CONSTRUCTOR_THROW)
// flags a throwing constructor on any class a subclass could finalize.
public final class LeadCreatedEvent extends ApplicationEvent {

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
    private final LocalDate eventDate;
    private final String eventType;
    private final String message;
    private final Origin origin;
    private final CustomerLanguage language;
    private final String photographerEmail;
    private final CustomerLanguage photographerLanguage;

    /**
     * A lead the Customer sent through the studio's public request form.
     *
     * <p>No studio name: {@code messaging} resolves who is speaking itself, at
     * queue time, the same way for every Customer message.
     *
     * @param details       what the Customer asked for, shown in the "New lead" alert
     * @param language      the form's UI language, which the Customer reads
     * @param ownerEmail    where the "New lead" alert goes
     * @param ownerLanguage the owner's UI language, which the alert is written in
     */
    @SuppressWarnings("checkstyle:ParameterNumber")
    public static LeadCreatedEvent fromPublicForm(Object source, UUID leadId, UUID tenantId, String clientName,
                                                  String clientEmail, String score, Details details,
                                                  CustomerLanguage language, String ownerEmail,
                                                  CustomerLanguage ownerLanguage) {
        return new LeadCreatedEvent(source, leadId, tenantId, clientName, clientEmail, score, details,
            Origin.PUBLIC_FORM, language, ownerEmail, ownerLanguage);
    }

    /**
     * A lead the studio's owner or staff typed in. Nothing writes to the
     * Customer about it, but the language still travels, so a listener added
     * later reads the lead as it was stored.
     */
    @SuppressWarnings("checkstyle:ParameterNumber")
    public static LeadCreatedEvent enteredByStudio(Object source, UUID leadId, UUID tenantId, String clientName,
                                                   String clientEmail, String score, Details details,
                                                   CustomerLanguage language, String enteredByEmail,
                                                   CustomerLanguage enteredByLanguage) {
        return new LeadCreatedEvent(source, leadId, tenantId, clientName, clientEmail, score, details,
            Origin.ENTERED_BY_STUDIO, language, enteredByEmail, enteredByLanguage);
    }

    /**
     * What the Customer asked for, as stored on the lead.
     *
     * @param eventDate the date they gave; the form requires one
     * @param eventType the form's value ({@code WEDDING}, {@code PORTRAIT}…)
     * @param message   free text, may be null
     */
    public record Details(LocalDate eventDate, String eventType, String message) {}

    @SuppressWarnings("checkstyle:ParameterNumber")
    private LeadCreatedEvent(Object source, UUID leadId, UUID tenantId, String clientName, String clientEmail,
                             String score, Details details, Origin origin, CustomerLanguage language,
                             String photographerEmail, CustomerLanguage photographerLanguage) {
        super(source);
        this.leadId = leadId;
        this.tenantId = tenantId;
        this.clientName = clientName;
        this.clientEmail = clientEmail;
        this.score = score;
        this.eventDate = details.eventDate();
        this.eventType = details.eventType();
        this.message = details.message();
        this.origin = origin;
        this.language = Objects.requireNonNull(language, "language");
        this.photographerEmail = photographerEmail;
        this.photographerLanguage = Objects.requireNonNull(photographerLanguage, "photographerLanguage");
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

    public LocalDate getEventDate() {
        return eventDate;
    }

    public String getEventType() {
        return eventType;
    }

    public String getMessage() {
        return message;
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

    /** The language of whoever {@link #getPhotographerEmail()} is: the alert is written in it. */
    public CustomerLanguage getPhotographerLanguage() {
        return photographerLanguage;
    }
}
