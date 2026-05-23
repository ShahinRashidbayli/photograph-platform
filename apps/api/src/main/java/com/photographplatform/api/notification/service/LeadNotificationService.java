package com.photographplatform.api.notification.service;

import com.photographplatform.api.lead.event.LeadCreatedEvent;
import com.photographplatform.api.notification.dto.EmailMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Notifies the photographer when a new lead lands. Runs alongside
 * {@link AutoReplyService} on the same {@link LeadCreatedEvent} so the
 * customer auto-reply and the photographer alert fire from a single
 * transactional source.
 */
@Service
public class LeadNotificationService {

    private static final Logger LOG = LoggerFactory.getLogger(LeadNotificationService.class);

    @Value("${resend.from-email:noreply@fotoplatform.de}")
    private String fromEmail;

    @Value("${app.web.base-url:http://localhost:3000}")
    private String webBaseUrl;

    private final EmailService emailService;

    public LeadNotificationService(EmailService emailService) {
        this.emailService = emailService;
    }

    @Async
    @EventListener
    public void onLeadCreated(LeadCreatedEvent event) {
        try {
            EmailMessage message = new EmailMessage(
                event.getPhotographerEmail(),
                fromEmail,
                buildSubject(event.getScore(), event.getClientName()),
                buildBody(event)
            );
            emailService.send(message);
        } catch (Exception e) {
            // Notification is best-effort. Lead is already persisted and visible
            // in the dashboard — failure to email shouldn't break the inbound flow.
            LOG.error("Failed to send lead notification for lead {}: {}",
                event.getLeadId(), e.getMessage(), e);
        }
    }

    private String buildSubject(String score, String clientName) {
        String prefix = switch (score) {
            case "HIGH" -> "🟢 New high-value lead";
            case "MED" -> "🟡 New lead";
            default -> "New lead";
        };
        return prefix + " — " + clientName;
    }

    private String buildBody(LeadCreatedEvent event) {
        String scoreBadge = renderBadge(event.getScore());

        String bodyStyle = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"
            + "color:#0F172A;background:#F9FAFB;margin:0;padding:32px 16px;";
        String cardStyle = "max-width:520px;margin:0 auto;background:#FFFFFF;"
            + "border:1px solid #E5E7EB;border-radius:12px;padding:32px;";
        String tdLabel = "padding:8px 0;color:#6B7280;width:120px;";
        String tdValue = "padding:8px 0;font-weight:500;";
        String btnStyle = "display:inline-block;background:#0F172A;color:#FFFFFF;"
            + "padding:12px 24px;border-radius:8px;text-decoration:none;"
            + "font-weight:600;font-size:14px;";

        return """
            <!DOCTYPE html>
            <html lang="en">
            <head><meta charset="UTF-8"></head>
            <body style="%s">
              <div style="%s">
                <div style="margin-bottom:8px;">%s</div>
                <h2 style="margin:8px 0 24px;font-size:20px;font-weight:600;color:#0F172A;">
                  New booking inquiry
                </h2>

                <table style="width:100%%;border-collapse:collapse;font-size:14px;color:#0F172A;">
                  <tr><td style="%s">Name</td><td style="%s">%s</td></tr>
                  <tr><td style="%s">Email</td>
                      <td style="padding:8px 0;"><a href="mailto:%s" style="color:#0F172A;">%s</a></td></tr>
                </table>

                <div style="margin-top:32px;text-align:center;">
                  <a href="%s/leads" style="%s">Open in dashboard →</a>
                </div>

                <p style="margin-top:32px;color:#9CA3AF;font-size:12px;text-align:center;">
                  Lead ID: %s
                </p>
              </div>
            </body>
            </html>
            """.formatted(
                bodyStyle,
                cardStyle,
                scoreBadge,
                tdLabel, tdValue, event.getClientName(),
                tdLabel, event.getClientEmail(), event.getClientEmail(),
                webBaseUrl, btnStyle,
                event.getLeadId()
            );
    }

    private String renderBadge(String score) {
        String style = "padding:3px 10px;border-radius:999px;font-size:12px;"
            + "font-weight:600;letter-spacing:.05em;";
        return switch (score) {
            case "HIGH" -> "<span style=\"background:#DCFCE7;color:#166534;" + style + "\">HIGH</span>";
            case "MED" -> "<span style=\"background:#FEF3C7;color:#92400E;" + style + "\">MED</span>";
            default -> "<span style=\"background:#F3F4F6;color:#374151;" + style + "\">LOW</span>";
        };
    }
}
