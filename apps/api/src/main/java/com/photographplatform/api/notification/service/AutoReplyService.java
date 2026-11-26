package com.photographplatform.api.notification.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.photographplatform.api.common.util.HtmlEscape;
import com.photographplatform.api.common.util.Normalize;
import com.photographplatform.api.lead.event.LeadCreatedEvent;
import com.photographplatform.api.notification.dto.EmailType;
import com.photographplatform.api.notification.dto.OutgoingEmail;
import com.photographplatform.api.notification.email.EmailRenderer;
import com.photographplatform.api.notification.email.EmailTemplate;
import com.photographplatform.api.notification.email.RenderedEmail;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Tells the Customer, in the studio's name, that their enquiry arrived
 * (roadmap §4.5.4). German, addressed with "Sie".
 *
 * <p>It promises nothing. It used to list packages, prices and "über 100
 * Hochzeiten Erfahrung" that no studio had entered, switched every HIGH-score
 * lead to wedding copy, and signed with a name made from the subdomain (#103).
 * What the studio offers is for the studio to say in its own reply.
 *
 * <p>Only for leads from the public request form; a lead the studio typed in
 * gets nothing. Queued before commit in the lead's transaction, like
 * {@link LeadNotificationService}.
 */
@Service
public class AutoReplyService implements EmailRenderer<AutoReplyService.Params> {

    /**
     * @param studioName null when the studio has entered no business or legal name
     */
    // Rows queued before #103 also carry `score` and `photographerSubdomain`.
    // Ignoring them lets those rows still render, now without the invented offer.
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Params(String clientName, String studioName) {}

    private final EmailService emailService;

    public AutoReplyService(EmailService emailService) {
        this.emailService = emailService;
    }

    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT, fallbackExecution = true)
    public void onLeadCreated(LeadCreatedEvent event) {
        // Allow-list: writing to a Customer is opt-in, so an origin added later
        // sends nothing until someone decides it should.
        if (event.getOrigin() != LeadCreatedEvent.Origin.PUBLIC_FORM) {
            return;
        }
        emailService.queue(new OutgoingEmail(
            template(),
            event.getClientEmail(),
            event.getTenantId(),
            new Params(event.getClientName(), event.getStudioName()),
            EmailType.LEAD_AUTO_REPLY + ":" + event.getLeadId(),
            null));
    }

    @Override
    public String template() {
        return "lead.auto-reply";
    }

    @Override
    public EmailType type() {
        return EmailType.LEAD_AUTO_REPLY;
    }

    @Override
    public Class<Params> paramsType() {
        return Params.class;
    }

    @Override
    public RenderedEmail render(Params params) {
        String studio = Normalize.trimToNull(params.studioName());
        String subject = studio == null ? "Ihre Anfrage ist eingegangen" : "Ihre Anfrage bei " + studio;
        return new RenderedEmail(subject, buildBody(params.clientName(), studio));
    }

    private static String buildBody(String clientName, String studio) {
        String name = clientName == null ? "" : clientName.trim();
        String greeting = name.isBlank() ? "Hallo," : "Hallo " + HtmlEscape.escape(name) + ",";

        String received = studio == null
            ? "vielen Dank für Ihre Anfrage. Sie ist bei uns eingegangen."
            : "vielen Dank für Ihre Anfrage. Sie ist bei <strong>" + HtmlEscape.escape(studio)
                + "</strong> eingegangen.";

        String signOff = studio == null
            ? "Herzliche Grüße"
            : "Herzliche Grüße<br><strong>" + HtmlEscape.escape(studio) + "</strong>";

        return EmailTemplate.document(
            "Vielen Dank für Ihre Anfrage.",
            EmailTemplate.heading("Vielen Dank für Ihre Anfrage")
                + EmailTemplate.paragraph(greeting)
                + EmailTemplate.paragraph(received)
                + EmailTemplate.paragraph("Wir lesen sie und melden uns persönlich bei Ihnen.")
                + EmailTemplate.paragraph(signOff)
                + EmailTemplate.note("Diese Bestätigung wurde automatisch versendet."),
            "de");
    }
}
