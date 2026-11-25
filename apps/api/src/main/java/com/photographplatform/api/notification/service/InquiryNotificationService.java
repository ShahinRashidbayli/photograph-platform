package com.photographplatform.api.notification.service;

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
 * path (authenticated customer rather than anonymous form).
 */
@Service
public class InquiryNotificationService implements EmailRenderer<InquiryNotificationService.Params> {

    /** The inquiry as the alert shows it; everything is on the event already. */
    @SuppressWarnings("checkstyle:ParameterNumber")
    public record Params(
        UUID inquiryId,
        String score,
        String customerName,
        String customerEmail,
        String eventType,
        String budgetRange,
        LocalDate proposedDate,
        String location) {}

    private static final DateTimeFormatter DATE_FORMAT =
        DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH);

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
                event.getProposedDate(), event.getLocation()),
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
        return new RenderedEmail(buildSubject(params), buildBody(params));
    }

    private String buildSubject(Params event) {
        String prefix = switch (event.score()) {
            case "HIGH" -> "🟢 New high-value request";
            case "MED" -> "🟡 New request";
            default -> "New request";
        };
        return prefix + " — " + event.customerName();
    }

    private String buildBody(Params event) {
        // EmailTemplate escapes every value it renders, so the customer-supplied
        // fields are passed through raw here rather than double-escaped.
        String email = event.customerEmail();
        return EmailTemplate.document(
            "New " + event.score() + " request — " + event.customerName(),
            EmailTemplate.badge(event.score(), toneFor(event.score()))
                + EmailTemplate.heading("New session request")
                + EmailTemplate.infoTable(List.of(
                    new EmailTemplate.Row("From", event.customerName()),
                    new EmailTemplate.Row("Email", email, "mailto:" + email),
                    new EmailTemplate.Row("Session", prettyEventType(event.eventType())),
                    new EmailTemplate.Row("Budget", prettyBudget(event.budgetRange())),
                    new EmailTemplate.Row("Preferred date",
                        event.proposedDate() == null ? "—" : DATE_FORMAT.format(event.proposedDate())),
                    new EmailTemplate.Row("Location",
                        event.location() == null ? "—" : event.location())))
                + EmailTemplate.button("Open in dashboard", webBaseUrl + "/leads")
                + EmailTemplate.note("Request ID: " + event.inquiryId()));
    }

    private static Tone toneFor(String score) {
        return switch (score) {
            case "HIGH" -> Tone.SUCCESS;
            case "MED" -> Tone.WARNING;
            default -> Tone.NEUTRAL;
        };
    }

    /**
     * The wire enums are the roadmap's German-facing values; the photographer
     * reads an English dashboard, so the email speaks the dashboard's language.
     * Unmapped values fall through raw (EmailTemplate escapes on render).
     */
    private static String prettyEventType(String eventType) {
        return switch (eventType == null ? "" : eventType) {
            case "HOCHZEIT" -> "Wedding";
            case "PORTRAIT" -> "Portrait";
            case "FAMILIE" -> "Family";
            case "EVENT" -> "Event";
            case "ANDERES" -> "Other";
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
}
