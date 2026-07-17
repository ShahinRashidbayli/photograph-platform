package com.photographplatform.api.notification.service;

import com.photographplatform.api.common.util.HtmlEscape;
import com.photographplatform.api.inquiry.event.InquiryCreatedEvent;
import com.photographplatform.api.notification.dto.EmailMessage;
import java.time.format.DateTimeFormatter;
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
        String bodyStyle = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"
            + "color:#0F172A;background:#F9FAFB;margin:0;padding:32px 16px;";
        String cardStyle = "max-width:520px;margin:0 auto;background:#FFFFFF;"
            + "border:1px solid #E5E7EB;border-radius:12px;padding:32px;";
        String tdLabel = "padding:8px 0;color:#6B7280;width:130px;vertical-align:top;";
        String tdValue = "padding:8px 0;font-weight:500;";
        String btnStyle = "display:inline-block;background:#0F172A;color:#FFFFFF;"
            + "padding:12px 24px;border-radius:8px;text-decoration:none;"
            + "font-weight:600;font-size:14px;";

        String email = HtmlEscape.escape(event.getCustomerEmail());

        return """
            <!DOCTYPE html>
            <html lang="en">
            <head><meta charset="UTF-8"></head>
            <body style="%s">
              <div style="%s">
                <div style="margin-bottom:8px;">%s</div>
                <h2 style="margin:8px 0 24px;font-size:20px;font-weight:600;color:#0F172A;">
                  New session request
                </h2>

                <table style="width:100%%;border-collapse:collapse;font-size:14px;color:#0F172A;">
                  <tr><td style="%s">From</td><td style="%s">%s</td></tr>
                  <tr><td style="%s">Email</td>
                      <td style="padding:8px 0;"><a href="mailto:%s" style="color:#0F172A;">%s</a></td></tr>
                  <tr><td style="%s">Session</td><td style="%s">%s</td></tr>
                  <tr><td style="%s">Budget</td><td style="%s">%s</td></tr>
                  <tr><td style="%s">Preferred date</td><td style="%s">%s</td></tr>
                  <tr><td style="%s">Location</td><td style="%s">%s</td></tr>
                </table>

                <div style="margin-top:32px;text-align:center;">
                  <a href="%s/bookings" style="%s">Open in dashboard →</a>
                </div>

                <p style="margin-top:32px;color:#9CA3AF;font-size:12px;text-align:center;">
                  Request ID: %s
                </p>
              </div>
            </body>
            </html>
            """.formatted(
                bodyStyle,
                cardStyle,
                renderBadge(event.getScore()),
                tdLabel, tdValue, HtmlEscape.escape(event.getCustomerName()),
                tdLabel, email, email,
                tdLabel, tdValue, prettyEventType(event.getEventType()),
                tdLabel, tdValue, prettyBudget(event.getBudgetRange()),
                tdLabel, tdValue,
                event.getProposedDate() == null ? "—" : DATE_FORMAT.format(event.getProposedDate()),
                tdLabel, tdValue,
                event.getLocation() == null ? "—" : HtmlEscape.escape(event.getLocation()),
                webBaseUrl, btnStyle,
                event.getInquiryId()
            );
    }

    /**
     * The wire enums are the roadmap's German-facing values; the photographer
     * reads an English dashboard, so the email speaks the dashboard's language.
     */
    private static String prettyEventType(String eventType) {
        return switch (eventType == null ? "" : eventType) {
            case "HOCHZEIT" -> "Wedding";
            case "PORTRAIT" -> "Portrait";
            case "FAMILIE" -> "Family";
            case "EVENT" -> "Event";
            case "ANDERES" -> "Other";
            default -> HtmlEscape.escape(eventType);
        };
    }

    private static String prettyBudget(String budgetRange) {
        return switch (budgetRange == null ? "" : budgetRange) {
            case "UNDER_500" -> "€200–500";
            case "500_1000" -> "€500–1000";
            case "1000_2000" -> "€1000–2000";
            case "OVER_2000" -> "€2000+";
            default -> HtmlEscape.escape(budgetRange);
        };
    }

    private static String renderBadge(String score) {
        String style = "padding:3px 10px;border-radius:999px;font-size:12px;"
            + "font-weight:600;letter-spacing:.05em;";
        return switch (score) {
            case "HIGH" -> "<span style=\"background:#DCFCE7;color:#166534;" + style + "\">HIGH</span>";
            case "MED" -> "<span style=\"background:#FEF3C7;color:#92400E;" + style + "\">MED</span>";
            default -> "<span style=\"background:#F3F4F6;color:#374151;" + style + "\">LOW</span>";
        };
    }
}
