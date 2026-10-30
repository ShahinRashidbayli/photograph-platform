package com.photographplatform.api.notification.service;

import com.photographplatform.api.lead.event.LeadCreatedEvent;
import com.photographplatform.api.notification.dto.EmailMessage;
import com.photographplatform.api.notification.dto.EmailType;
import com.photographplatform.api.notification.email.EmailTemplate;
import com.photographplatform.api.notification.email.EmailTemplate.Tone;
import java.util.List;
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
                buildSubject(event.getScore(), event.getClientName()),
                buildBody(event),
                EmailType.LEAD_NOTIFICATION,
                // LeadCreatedEvent does not carry the tenant — see the follow-up
                // in docs/BUGS.md; a failed send logs tenant=unknown.
                null
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
        // Name/email come from the *unauthenticated* public lead form, so they
        // are attacker-controlled — EmailTemplate escapes every value it renders,
        // so they're passed through raw here rather than double-escaped.
        String clientEmail = event.getClientEmail();
        return EmailTemplate.document(
            "New " + event.getScore() + " lead — " + event.getClientName(),
            EmailTemplate.badge(event.getScore(), toneFor(event.getScore()))
                + EmailTemplate.heading("New booking inquiry")
                + EmailTemplate.infoTable(List.of(
                    new EmailTemplate.Row("Name", event.getClientName()),
                    new EmailTemplate.Row("Email", clientEmail, "mailto:" + clientEmail)))
                + EmailTemplate.button("Open in dashboard", webBaseUrl + "/leads")
                + EmailTemplate.note("Lead ID: " + event.getLeadId()));
    }

    private static Tone toneFor(String score) {
        return switch (score) {
            case "HIGH" -> Tone.SUCCESS;
            case "MED" -> Tone.WARNING;
            default -> Tone.NEUTRAL;
        };
    }
}
