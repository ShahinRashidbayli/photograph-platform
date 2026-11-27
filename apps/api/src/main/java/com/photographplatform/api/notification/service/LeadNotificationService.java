package com.photographplatform.api.notification.service;

import com.photographplatform.api.lead.event.LeadCreatedEvent;
import com.photographplatform.api.notification.dto.EmailType;
import com.photographplatform.api.notification.dto.OutgoingEmail;
import com.photographplatform.api.notification.email.EmailRenderer;
import com.photographplatform.api.notification.email.EmailTemplate;
import com.photographplatform.api.notification.email.EmailTemplate.Tone;
import com.photographplatform.api.notification.email.RenderedEmail;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Notifies the photographer when a new lead lands. Runs alongside
 * {@link AutoReplyService} on the same {@link LeadCreatedEvent} so the
 * customer auto-reply and the photographer alert fire from a single
 * transactional source.
 *
 * <p>Queues before commit, in the lead's own transaction (ADR-005): no lead,
 * no email; a lead, and the email survives a crash.
 */
@Service
public class LeadNotificationService implements EmailRenderer<LeadNotificationService.Params> {

    /** What the alert needs; the lead's name and address are on the event already. */
    public record Params(UUID leadId, String score, String clientName, String clientEmail) {}

    @Value("${app.web.base-url:http://localhost:3000}")
    private String webBaseUrl;

    private final EmailService emailService;

    public LeadNotificationService(EmailService emailService) {
        this.emailService = emailService;
    }

    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT, fallbackExecution = true)
    public void onLeadCreated(LeadCreatedEvent event) {
        // Deny-list, unlike AutoReplyService: alerting the studio is the default,
        // so an origin added later still alerts. The one exception is a lead the
        // studio typed in, which went to the very person who typed it (#103).
        if (event.getOrigin() == LeadCreatedEvent.Origin.ENTERED_BY_STUDIO) {
            return;
        }
        emailService.queue(new OutgoingEmail(
            template(),
            event.getPhotographerEmail(),
            event.getTenantId(),
            new Params(event.getLeadId(), event.getScore(), event.getClientName(), event.getClientEmail()),
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
        return new RenderedEmail(buildSubject(params.score(), params.clientName()), buildBody(params));
    }

    private String buildSubject(String score, String clientName) {
        String prefix = switch (score) {
            case "HIGH" -> "🟢 New high-value lead";
            case "MED" -> "🟡 New lead";
            default -> "New lead";
        };
        return prefix + " — " + clientName;
    }

    private String buildBody(Params event) {
        // Name/email come from the *unauthenticated* public lead form, so they
        // are attacker-controlled — EmailTemplate escapes every value it renders,
        // so they're passed through raw here rather than double-escaped.
        String clientEmail = event.clientEmail();
        return EmailTemplate.document(
            "New " + event.score() + " lead — " + event.clientName(),
            EmailTemplate.badge(event.score(), toneFor(event.score()))
                + EmailTemplate.heading("New booking inquiry")
                + EmailTemplate.infoTable(List.of(
                    new EmailTemplate.Row("Name", event.clientName()),
                    new EmailTemplate.Row("Email", clientEmail, "mailto:" + clientEmail)))
                + EmailTemplate.button("Open in dashboard", webBaseUrl + "/leads")
                + EmailTemplate.note("Lead ID: " + event.leadId()));
    }

    private static Tone toneFor(String score) {
        return switch (score) {
            case "HIGH" -> Tone.SUCCESS;
            case "MED" -> Tone.WARNING;
            default -> Tone.NEUTRAL;
        };
    }
}
