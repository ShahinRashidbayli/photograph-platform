package com.photographplatform.api.notification.service;

import com.photographplatform.api.common.util.HtmlEscape;
import com.photographplatform.api.lead.event.LeadCreatedEvent;
import com.photographplatform.api.notification.dto.EmailType;
import com.photographplatform.api.notification.dto.OutgoingEmail;
import com.photographplatform.api.notification.email.EmailRenderer;
import com.photographplatform.api.notification.email.EmailTemplate;
import com.photographplatform.api.notification.email.RenderedEmail;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Sends the customer a warm, on-brand acknowledgement the moment a lead lands
 * (roadmap §4.5.4). Built from {@link EmailTemplate} so it matches every other
 * Fotolio email; the copy is German and varies by lead score — a wedding-tuned
 * variant for HIGH, a budget-fit variant otherwise.
 *
 * <p>Queued before commit in the lead's transaction, like
 * {@link LeadNotificationService}.
 */
@Service
public class AutoReplyService implements EmailRenderer<AutoReplyService.Params> {

    /** @param photographerSubdomain null for a lead the photographer typed in themselves */
    public record Params(String score, String clientName, String photographerSubdomain) {}

    @Value("${app.web.base-url:http://localhost:3000}")
    private String webBaseUrl;

    private final EmailService emailService;

    public AutoReplyService(EmailService emailService) {
        this.emailService = emailService;
    }

    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT, fallbackExecution = true)
    public void onLeadCreated(LeadCreatedEvent event) {
        emailService.queue(new OutgoingEmail(
            template(),
            event.getClientEmail(),
            event.getTenantId(),
            new Params(event.getScore(), event.getClientName(), event.getPhotographerSubdomain()),
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
        String photographer = capitalizeName(params.photographerSubdomain());
        return new RenderedEmail(
            "Vielen Dank für Ihre Anfrage – " + photographer, buildBody(params, photographer));
    }

    private String buildBody(Params event, String photographer) {
        // LOW-score leads reuse the mid-tier copy for now; a lighter-touch LOW
        // variant is a follow-up.
        boolean wedding = "HIGH".equals(event.score());
        String photographerHtml = HtmlEscape.escape(photographer);

        String name = event.clientName() == null ? "" : event.clientName().trim();
        String greeting = name.isBlank() ? "Hallo," : "Hallo " + HtmlEscape.escape(name) + ",";

        String intro = wedding
            ? "vielen Dank für Ihre Anfrage! Ihre Hochzeit ist uns wichtig, und wir freuen uns, dass Sie "
                + "<strong>" + photographerHtml + "</strong> für die Fotografie in Betracht ziehen."
            : "vielen Dank für Ihre Anfrage! Wir haben mehrere Pakete, die zu Ihrem Budget passen.";

        List<String> packages = wedding
            ? List.of(
                "<strong>Premium-Paket:</strong> 10 Stunden Begleitung mit zwei Fotografen",
                "<strong>Standard-Paket:</strong> 8 Stunden mit einem Fotografen",
                "<strong>Individuell:</strong> Ihr persönliches Paket nach Wunsch")
            : List.of(
                "<strong>Basis:</strong> 4 Stunden ab €399",
                "<strong>Standard:</strong> 6 Stunden ab €699",
                "<strong>Premium:</strong> individuell ab €999");

        String closing = wedding
            ? "Mit über 100 Hochzeiten Erfahrung wissen wir, wie wertvoll jeder Moment ist."
            : "Gerne besprechen wir Ihre Ideen und finden gemeinsam das perfekte Paket für Sie.";

        String portfolioUrl = webBaseUrl.replaceAll("/+$", "") + "/p/" + event.photographerSubdomain();

        return EmailTemplate.document(
            "Vielen Dank für Ihre Anfrage bei " + photographer + ".",
            EmailTemplate.heading("Vielen Dank für Ihre Anfrage")
                + EmailTemplate.paragraph(greeting)
                + EmailTemplate.paragraph(intro)
                + EmailTemplate.callout(wedding ? "Das bieten wir an" : "Unsere Pakete",
                    EmailTemplate.bulletList(packages))
                + EmailTemplate.paragraph(closing)
                + EmailTemplate.button("Portfolio ansehen", portfolioUrl)
                + EmailTemplate.paragraph("Herzliche Grüße,<br><strong>" + photographerHtml + "</strong>"),
            "de");
    }

    /**
     * Turns a tenant subdomain (e.g. "anna-foto") into a human display name
     * ("Anna Foto") for the subject and signature. Falls back to a neutral
     * label when the subdomain is missing.
     */
    private String capitalizeName(String subdomain) {
        if (subdomain == null || subdomain.isBlank()) {
            return "Ihr Fotograf";
        }
        StringBuilder sb = new StringBuilder();
        for (String part : subdomain.trim().split("[-_]")) {
            if (part.isEmpty()) {
                continue;
            }
            if (sb.length() > 0) {
                sb.append(' ');
            }
            sb.append(Character.toUpperCase(part.charAt(0)));
            if (part.length() > 1) {
                sb.append(part.substring(1));
            }
        }
        return sb.length() > 0 ? sb.toString() : "Ihr Fotograf";
    }
}
