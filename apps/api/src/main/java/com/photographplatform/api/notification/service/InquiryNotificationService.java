package com.photographplatform.api.notification.service;

import com.photographplatform.api.inquiry.event.InquiryCreatedEvent;
import com.photographplatform.api.notification.dto.EmailMessage;
import com.photographplatform.api.notification.email.EmailTemplate;
import com.photographplatform.api.notification.email.EmailTemplate.Tone;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

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
public class InquiryNotificationService {

    private static final Logger LOG = LoggerFactory.getLogger(InquiryNotificationService.class);

    private static final DateTimeFormatter DATE_FORMAT =
        DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH);

    @Value("${app.web.base-url:http://localhost:3000}")
    private String webBaseUrl;

    private final EmailService emailService;

    public InquiryNotificationService(EmailService emailService) {
        this.emailService = emailService;
    }

    @Async
    @EventListener
    public void onInquiryCreated(InquiryCreatedEvent event) {
        try {
            emailService.send(new EmailMessage(
                event.getPhotographerEmail(),
                buildSubject(event),
                buildBody(event)
            ));
        } catch (Exception e) {
            // Best-effort, exactly like the lead alert: the inquiry is already
            // committed and visible at /api/inquiries, so a mail failure must
            // not surface to the customer as a failed submission.
            LOG.error("Failed to send inquiry notification for inquiry {}: {}",
                event.getInquiryId(), e.getMessage(), e);
        }
    }

    private String buildSubject(InquiryCreatedEvent event) {
        String prefix = switch (event.getScore()) {
            case "HIGH" -> "🟢 New high-value request";
            case "MED" -> "🟡 New request";
            default -> "New request";
        };
        return prefix + " — " + event.getCustomerName();
    }

    private String buildBody(InquiryCreatedEvent event) {
        // EmailTemplate escapes every value it renders, so the customer-supplied
        // fields are passed through raw here rather than double-escaped.
        String email = event.getCustomerEmail();
        return EmailTemplate.document(
            "New " + event.getScore() + " request — " + event.getCustomerName(),
            EmailTemplate.badge(event.getScore(), toneFor(event.getScore()))
                + EmailTemplate.heading("New session request")
                + EmailTemplate.infoTable(List.of(
                    new EmailTemplate.Row("From", event.getCustomerName()),
                    new EmailTemplate.Row("Email", email, "mailto:" + email),
                    new EmailTemplate.Row("Session", prettyEventType(event.getEventType())),
                    new EmailTemplate.Row("Budget", prettyBudget(event.getBudgetRange())),
                    new EmailTemplate.Row("Preferred date",
                        event.getProposedDate() == null ? "—" : DATE_FORMAT.format(event.getProposedDate())),
                    new EmailTemplate.Row("Location",
                        event.getLocation() == null ? "—" : event.getLocation())))
                + EmailTemplate.button("Open in dashboard", webBaseUrl + "/leads")
                + EmailTemplate.note("Request ID: " + event.getInquiryId()));
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
