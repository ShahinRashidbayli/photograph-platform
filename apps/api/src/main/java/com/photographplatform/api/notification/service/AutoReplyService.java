package com.photographplatform.api.notification.service;

import com.photographplatform.api.common.util.HtmlEscape;
import com.photographplatform.api.lead.event.LeadCreatedEvent;
import com.photographplatform.api.notification.dto.EmailMessage;
import com.photographplatform.api.notification.dto.EmailType;
import com.photographplatform.api.notification.email.EmailTemplate;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Sends the customer a warm, on-brand acknowledgement the moment a lead lands
 * (roadmap §4.5.4). Built from {@link EmailTemplate} so it matches every other
 * Fotolio email; the copy is German and varies by lead score — a wedding-tuned
 * variant for HIGH, a budget-fit variant otherwise.
 */
@Service
public class AutoReplyService {

    private static final Logger LOG = LoggerFactory.getLogger(AutoReplyService.class);

    @Value("${app.web.base-url:http://localhost:3000}")
    private String webBaseUrl;

    private final EmailService emailService;

    public AutoReplyService(EmailService emailService) {
        this.emailService = emailService;
    }

    @Async
    @EventListener
    public void onLeadCreated(LeadCreatedEvent event) {
        try {
            String photographer = capitalizeName(event.getPhotographerSubdomain());
            emailService.send(new EmailMessage(
                event.getClientEmail(),
                "Vielen Dank für Ihre Anfrage – " + photographer,
                buildBody(event, photographer),
                EmailType.LEAD_AUTO_REPLY,
                // LeadCreatedEvent does not carry the tenant — see docs/BUGS.md.
                null));
        } catch (Exception e) {
            LOG.error("Failed to send auto-reply for lead {}: {}", event.getLeadId(), e.getMessage(), e);
        }
    }

    private String buildBody(LeadCreatedEvent event, String photographer) {
        // LOW-score leads reuse the mid-tier copy for now; a lighter-touch LOW
        // variant is a follow-up.
        boolean wedding = "HIGH".equals(event.getScore());
        String photographerHtml = HtmlEscape.escape(photographer);

        String name = event.getClientName() == null ? "" : event.getClientName().trim();
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

        String portfolioUrl = webBaseUrl.replaceAll("/+$", "") + "/p/" + event.getPhotographerSubdomain();

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
