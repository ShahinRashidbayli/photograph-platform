package com.photographplatform.api.notification.service;

import com.photographplatform.api.lead.event.LeadCreatedEvent;
import com.photographplatform.api.notification.dto.EmailMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
public class AutoReplyService {

    private static final Logger LOG = LoggerFactory.getLogger(AutoReplyService.class);

    @Value("${resend.from-email:noreply@fotoplatform.de}")
    private String fromEmail;

    private final EmailService emailService;

    public AutoReplyService(EmailService emailService) {
        this.emailService = emailService;
    }

    @Async
    @EventListener
    public void onLeadCreated(LeadCreatedEvent event) {
        try {
            String subject = buildSubject(event.getPhotographerSubdomain());
            String htmlBody = buildTemplate(event.getScore(), event.getClientName(),
                event.getPhotographerSubdomain());

            EmailMessage message = new EmailMessage(
                event.getClientEmail(),
                fromEmail,
                subject,
                htmlBody
            );

            emailService.send(message);
        } catch (Exception e) {
            LOG.error("Failed to send auto-reply for lead {}: {}", event.getLeadId(), e.getMessage(), e);
        }
    }

    private String buildSubject(String photographerSubdomain) {
        return "Vielen Dank für Ihre Anfrage - " + capitalizeName(photographerSubdomain);
    }

    private String buildTemplate(String score, String clientName, String photographerSubdomain) {
        String photographerTitle = capitalizeName(photographerSubdomain);

        if ("HIGH".equals(score)) {
            return buildHighTemplate(clientName, photographerTitle);
        } else if ("MED".equals(score)) {
            return buildMedTemplate(clientName, photographerTitle);
        } else {
            return buildLowTemplate(clientName, photographerTitle);
        }
    }

    private String buildHighTemplate(String clientName, String photographerTitle) {
        return """
            <!DOCTYPE html>
            <html lang="de">
            <head><meta charset="UTF-8"></head>
            <body style="font-family: Arial, sans-serif; color: #333;">
                <h2>Hallo %s,</h2>
                <p>vielen Dank für Ihre Anfrage! Ihre Hochzeit ist uns sehr wichtig, und wir freuen uns,
                dass Sie %s für die Fotografie in Betracht ziehen.</p>
                <p><strong>Das bieten wir an:</strong></p>
                <ul>
                    <li><strong>Premium-Paket:</strong> 10 Stunden Coverage mit zwei Fotografen</li>
                    <li><strong>Standard-Paket:</strong> 8 Stunden mit einem Fotografen</li>
                    <li><strong>Customize:</strong> Ihr persönliches Paket nach Wunsch</li>
                </ul>
                <p>Mit über 100 Hochzeiten Erfahrung verstehen wir, wie wichtig jeder Moment ist.</p>
                <p><a href="https://fotoplatform.de/contact" style="background-color: #007bff; color: white;
                padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                Jetzt unverbindlich anfragen
                </a></p>
                <p>Herzliche Grüße,<br/>%s</p>
            </body>
            </html>
            """.formatted(clientName, photographerTitle, photographerTitle);
    }

    private String buildMedTemplate(String clientName, String photographerTitle) {
        return """
            <!DOCTYPE html>
            <html lang="de">
            <head><meta charset="UTF-8"></head>
            <body style="font-family: Arial, sans-serif; color: #333;">
                <h2>Hallo %s,</h2>
                <p>danke für Ihre Anfrage! Wir haben mehrere Pakete, die zu Ihrem Budget passen.</p>
                <p><strong>Unsere Pakete:</strong></p>
                <ul>
                    <li>Basis: 4 Stunden ab €399</li>
                    <li>Standard: 6 Stunden ab €699</li>
                    <li>Premium: Custom ab €999</li>
                </ul>
                <p>Gerne besprechen wir Ihre Ideen.</p>
                <p><a href="https://fotoplatform.de/contact" style="background-color: #28a745; color: white;
                padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                Kontakt aufnehmen
                </a></p>
                <p>Viele Grüße,<br/>%s</p>
            </body>
            </html>
            """.formatted(clientName, photographerTitle);
    }

    private String buildLowTemplate(String clientName, String photographerTitle) {
        return """
            <!DOCTYPE html>
            <html lang="de">
            <head><meta charset="UTF-8"></head>
            <body style="font-family: Arial, sans-serif; color: #333;">
                <h2>Hallo %s,</h2>
                <p>danke für Ihre Anfrage! Wir melden uns in Kürze bei Ihnen.</p>
                <p>Beste Grüße,<br/>%s</p>
            </body>
            </html>
            """.formatted(clientName, photographerTitle);
    }

    private String capitalizeName(String name) {
        if (name == null || name.isEmpty()) {
            return "Fotograf";
        }
        return name.replace("-", " ").substring(0, 1).toUpperCase() +
               name.replace("-", " ").substring(1).toLowerCase();
    }
}
