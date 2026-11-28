package com.photographplatform.api.notification.service;

import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.common.util.HtmlEscape;
import com.photographplatform.api.lead.event.LeadCreatedEvent;
import com.photographplatform.api.notification.dto.EmailType;
import com.photographplatform.api.notification.dto.OutgoingEmail;
import com.photographplatform.api.notification.email.EmailRenderer;
import com.photographplatform.api.notification.email.EmailTemplate;
import com.photographplatform.api.notification.email.EmailTemplate.Tone;
import com.photographplatform.api.notification.email.RenderedEmail;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Notifies the photographer when a new lead lands. Runs alongside
 * {@code messaging}'s Enquiry received on the same {@link LeadCreatedEvent},
 * so the Customer's acknowledgement and the photographer's alert fire from a
 * single transactional source.
 *
 * <p>Queues before commit, in the lead's own transaction (ADR-005): no lead,
 * no email; a lead, and the email survives a crash.
 *
 * <p>Carries what the Customer asked for (date, type, message), so the
 * photographer can triage from the inbox, and is written in the recipient's
 * language (#126).
 */
@Service
public class LeadNotificationService implements EmailRenderer<LeadNotificationService.Params> {

    /**
     * What the alert needs; all of it is on the event.
     *
     * @param eventType the form's value ({@code WEDDING}…); an unknown one is shown as is
     * @param message   the Customer's free text, may be null
     * @param language  the recipient's; null (a job queued before it existed) is German
     */
    @SuppressWarnings("checkstyle:ParameterNumber")
    public record Params(UUID leadId, String score, String clientName, String clientEmail, LocalDate eventDate,
                         String eventType, String message, CustomerLanguage language) {}

    @Value("${app.web.base-url:http://localhost:3000}")
    private String webBaseUrl;

    private final EmailService emailService;

    public LeadNotificationService(EmailService emailService) {
        this.emailService = emailService;
    }

    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT, fallbackExecution = true)
    public void onLeadCreated(LeadCreatedEvent event) {
        // Deny-list, unlike Enquiry received: alerting the studio is the default,
        // so an origin added later still alerts. The one exception is a lead the
        // studio typed in, which went to the very person who typed it (#103).
        if (event.getOrigin() == LeadCreatedEvent.Origin.ENTERED_BY_STUDIO) {
            return;
        }
        emailService.queue(new OutgoingEmail(
            template(),
            event.getPhotographerEmail(),
            event.getTenantId(),
            new Params(event.getLeadId(), event.getScore(), event.getClientName(), event.getClientEmail(),
                event.getEventDate(), event.getEventType(), event.getMessage(), event.getPhotographerLanguage()),
            EmailType.LEAD_NOTIFICATION + ":" + event.getLeadId(),
            null));
    }

    @Override
    public String template() {
        return "lead.notification";
    }

    @Override
    public EmailType type() {
        return EmailType.LEAD_NOTIFICATION;
    }

    @Override
    public Class<Params> paramsType() {
        return Params.class;
    }

    @Override
    public RenderedEmail render(Params params) {
        Copy copy = params.language() == CustomerLanguage.EN ? Copy.EN : Copy.DE;
        return new RenderedEmail(buildSubject(copy, params), buildBody(copy, params));
    }

    private static String buildSubject(Copy copy, Params params) {
        String prefix = switch (params.score()) {
            case "HIGH" -> "🟢 " + copy.subjectHigh;
            case "MED" -> "🟡 " + copy.subject;
            default -> copy.subject;
        };
        return prefix + " — " + params.clientName();
    }

    private String buildBody(Copy copy, Params event) {
        // Name, email and message come from the *unauthenticated* public lead
        // form, so they are attacker-controlled. EmailTemplate escapes every
        // value it renders, so they're passed through raw here rather than
        // double-escaped; the message alone is escaped here, because a
        // callout takes HTML.
        String clientEmail = event.clientEmail();
        List<EmailTemplate.Row> rows = List.of(
            new EmailTemplate.Row(copy.name, event.clientName()),
            new EmailTemplate.Row(copy.email, clientEmail, "mailto:" + clientEmail),
            new EmailTemplate.Row(copy.eventType, eventTypeLabel(copy, event.eventType())),
            new EmailTemplate.Row(copy.eventDate,
                event.eventDate() == null ? "—" : copy.dateFormat.format(event.eventDate())));
        String message = event.message() == null ? "" : event.message().strip();
        return EmailTemplate.document(
            copy.subject + " — " + event.clientName(),
            EmailTemplate.badge(scoreLabel(copy, event.score()), toneFor(event.score()))
                + EmailTemplate.heading(copy.heading)
                + EmailTemplate.infoTable(rows)
                + (message.isEmpty() ? ""
                    : EmailTemplate.callout(copy.message, EmailTemplate.paragraph(
                        HtmlEscape.escape(message).replaceAll("\\R", "<br>"))))
                + EmailTemplate.button(copy.button, webBaseUrl + "/leads")
                + EmailTemplate.note(copy.leadId + event.leadId()),
            event.language());
    }

    private static Tone toneFor(String score) {
        return switch (score) {
            case "HIGH" -> Tone.SUCCESS;
            case "MED" -> Tone.WARNING;
            default -> Tone.NEUTRAL;
        };
    }

    private static String scoreLabel(Copy copy, String score) {
        return switch (score) {
            case "HIGH" -> copy.high;
            case "MED" -> copy.medium;
            case "LOW" -> copy.low;
            default -> score;
        };
    }

    /** The web app's names for the request form's types ({@code leadEvent.*}). */
    private static String eventTypeLabel(Copy copy, String eventType) {
        boolean en = copy == Copy.EN;
        return switch (eventType == null ? "" : eventType) {
            case "WEDDING" -> en ? "Wedding" : "Hochzeit";
            case "ENGAGEMENT" -> en ? "Engagement" : "Verlobung";
            case "PORTRAIT" -> "Portrait";
            case "FAMILY" -> en ? "Family" : "Familie";
            case "NEWBORN" -> en ? "Newborn" : "Neugeborene";
            case "CORPORATE" -> en ? "Corporate" : "Business";
            case "OTHER" -> en ? "Other" : "Sonstiges";
            case "" -> "—";
            default -> eventType;
        };
    }

    private enum Copy {
        DE(DateTimeFormatter.ofPattern("d. MMMM yyyy", Locale.GERMAN),
            "Neuer Lead", "Neuer Lead mit hoher Priorität", "Neue Buchungsanfrage",
            "Name", "E-Mail", "Art", "Datum", "Nachricht", "Im Dashboard öffnen", "Lead-ID: ",
            "Hohe Priorität", "Mittlere Priorität", "Niedrige Priorität"),
        EN(DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH),
            "New lead", "New high-value lead", "New booking inquiry",
            "Name", "Email", "Type", "Date", "Message", "Open in dashboard", "Lead ID: ",
            "High priority", "Medium priority", "Low priority");

        private final DateTimeFormatter dateFormat;
        private final String subject;
        private final String subjectHigh;
        private final String heading;
        private final String name;
        private final String email;
        private final String eventType;
        private final String eventDate;
        private final String message;
        private final String button;
        private final String leadId;
        private final String high;
        private final String medium;
        private final String low;

        @SuppressWarnings("checkstyle:ParameterNumber")
        Copy(DateTimeFormatter dateFormat, String subject, String subjectHigh, String heading, String name,
             String email, String eventType, String eventDate, String message, String button, String leadId,
             String high, String medium, String low) {
            this.dateFormat = dateFormat;
            this.subject = subject;
            this.subjectHigh = subjectHigh;
            this.heading = heading;
            this.name = name;
            this.email = email;
            this.eventType = eventType;
            this.eventDate = eventDate;
            this.message = message;
            this.button = button;
            this.leadId = leadId;
            this.high = high;
            this.medium = medium;
            this.low = low;
        }
    }
}
