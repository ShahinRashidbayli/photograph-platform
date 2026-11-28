package com.photographplatform.api.notification.service;

import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.inquiry.event.InquiryCreatedEvent;
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
 * Alerts the photographer when a signed-in customer submits an inquiry — the
 * "Yeni sorğu: Maria Kellner · HIGH" notification of roadmap §4.5.3 step 7.
 *
 * <p>This is what keeps an inquiry from being a black hole: the photographer's
 * dashboard list is read from {@code GET /api/inquiries}, but the email is what
 * actually pulls them back into the app.
 *
 * <p>Sibling of {@link LeadNotificationService} — same shape, different intake
 * path (authenticated customer rather than anonymous form). Written in the
 * recipient's language (#126).
 */
@Service
public class InquiryNotificationService implements EmailRenderer<InquiryNotificationService.Params> {

    /**
     * The inquiry as the Notification shows it; everything is on the event.
     *
     * @param language the recipient's; null (a job queued before it existed) is German
     */
    @SuppressWarnings("checkstyle:ParameterNumber")
    public record Params(
        UUID inquiryId,
        String score,
        String customerName,
        String customerEmail,
        String eventType,
        String budgetRange,
        LocalDate proposedDate,
        String location,
        CustomerLanguage language) {}

    @Value("${app.web.base-url:http://localhost:3000}")
    private String webBaseUrl;

    private final EmailService emailService;

    public InquiryNotificationService(EmailService emailService) {
        this.emailService = emailService;
    }

    /** Queued before commit, in the inquiry's own transaction (ADR-005). */
    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT, fallbackExecution = true)
    public void onInquiryCreated(InquiryCreatedEvent event) {
        emailService.queue(new OutgoingEmail(
            template(),
            event.getPhotographerEmail(),
            event.getTenantId(),
            new Params(event.getInquiryId(), event.getScore(), event.getCustomerName(),
                event.getCustomerEmail(), event.getEventType(), event.getBudgetRange(),
                event.getProposedDate(), event.getLocation(), event.getPhotographerLanguage()),
            EmailType.INQUIRY_NOTIFICATION + ":" + event.getInquiryId(),
            null));
    }

    @Override
    public String template() {
        return "inquiry.notification";
    }

    @Override
    public EmailType type() {
        return EmailType.INQUIRY_NOTIFICATION;
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

    private static String buildSubject(Copy copy, Params event) {
        String prefix = switch (event.score()) {
            case "HIGH" -> "🟢 " + copy.subjectHigh;
            case "MED" -> "🟡 " + copy.subject;
            default -> copy.subject;
        };
        return prefix + " — " + event.customerName();
    }

    private String buildBody(Copy copy, Params event) {
        // EmailTemplate escapes every value it renders, so the customer-supplied
        // fields are passed through raw here rather than double-escaped.
        String email = event.customerEmail();
        return EmailTemplate.document(
            copy.subject + " — " + event.customerName(),
            EmailTemplate.badge(scoreLabel(copy, event.score()), toneFor(event.score()))
                + EmailTemplate.heading(copy.heading)
                + EmailTemplate.infoTable(List.of(
                    new EmailTemplate.Row(copy.from, event.customerName()),
                    new EmailTemplate.Row(copy.email, email, "mailto:" + email),
                    new EmailTemplate.Row(copy.session, eventTypeLabel(copy, event.eventType())),
                    new EmailTemplate.Row(copy.budget, prettyBudget(event.budgetRange())),
                    new EmailTemplate.Row(copy.preferredDate,
                        event.proposedDate() == null ? "—" : copy.dateFormat.format(event.proposedDate())),
                    new EmailTemplate.Row(copy.location,
                        event.location() == null ? "—" : event.location())))
                + EmailTemplate.button(copy.button, webBaseUrl + "/leads")
                + EmailTemplate.note(copy.requestId + event.inquiryId()),
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

    /**
     * The wire values are the roadmap's German ones; the web app names them
     * per language ({@code requestSession.type.*}), and so does the email.
     * Unmapped values fall through raw (EmailTemplate escapes on render).
     */
    private static String eventTypeLabel(Copy copy, String eventType) {
        boolean en = copy == Copy.EN;
        return switch (eventType == null ? "" : eventType) {
            case "HOCHZEIT" -> en ? "Wedding" : "Hochzeit";
            case "PORTRAIT" -> "Portrait";
            case "FAMILIE" -> en ? "Family" : "Familie";
            case "EVENT" -> "Event";
            case "ANDERES" -> en ? "Other" : "Sonstiges";
            default -> eventType == null ? "" : eventType;
        };
    }

    private static String prettyBudget(String budgetRange) {
        return switch (budgetRange == null ? "" : budgetRange) {
            case "UNDER_500" -> "€200–500";
            case "500_1000" -> "€500–1000";
            case "1000_2000" -> "€1000–2000";
            case "OVER_2000" -> "€2000+";
            default -> budgetRange == null ? "" : budgetRange;
        };
    }

    private enum Copy {
        DE(DateTimeFormatter.ofPattern("d. MMMM yyyy", Locale.GERMAN),
            "Neue Anfrage", "Neue Anfrage mit hoher Priorität", "Neue Shooting-Anfrage",
            "Von", "E-Mail", "Shooting", "Budget", "Wunschtermin", "Ort", "Im Dashboard öffnen",
            "Anfrage-ID: ", "Hohe Priorität", "Mittlere Priorität", "Niedrige Priorität"),
        EN(DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH),
            "New request", "New high-value request", "New session request",
            "From", "Email", "Session", "Budget", "Preferred date", "Location", "Open in dashboard",
            "Request ID: ", "High priority", "Medium priority", "Low priority");

        private final DateTimeFormatter dateFormat;
        private final String subject;
        private final String subjectHigh;
        private final String heading;
        private final String from;
        private final String email;
        private final String session;
        private final String budget;
        private final String preferredDate;
        private final String location;
        private final String button;
        private final String requestId;
        private final String high;
        private final String medium;
        private final String low;

        @SuppressWarnings("checkstyle:ParameterNumber")
        Copy(DateTimeFormatter dateFormat, String subject, String subjectHigh, String heading, String from,
             String email, String session, String budget, String preferredDate, String location, String button,
             String requestId, String high, String medium, String low) {
            this.dateFormat = dateFormat;
            this.subject = subject;
            this.subjectHigh = subjectHigh;
            this.heading = heading;
            this.from = from;
            this.email = email;
            this.session = session;
            this.budget = budget;
            this.preferredDate = preferredDate;
            this.location = location;
            this.button = button;
            this.requestId = requestId;
            this.high = high;
            this.medium = medium;
            this.low = low;
        }
    }
}
