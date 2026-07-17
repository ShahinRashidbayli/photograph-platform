package com.photographplatform.api.notification.service;

import com.photographplatform.api.lead.event.LeadCreatedEvent;
import com.photographplatform.api.notification.dto.EmailMessage;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.core.io.ClassPathResource;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
public class AutoReplyService {

    private static final Logger LOG = LoggerFactory.getLogger(AutoReplyService.class);

    private final EmailService emailService;

    // The auto-reply bodies are static marketing HTML, so they live as classpath
    // resources rather than inline text blocks. Loaded once at construction —
    // there's no reason to re-read the file on every lead. {{clientName}} and
    // {{photographer}} are the only substitutions.
    private final String highTemplate = load("templates/auto-reply-high.html");
    private final String medTemplate = load("templates/auto-reply-med.html");

    public AutoReplyService(EmailService emailService) {
        this.emailService = emailService;
    }

    @Async
    @EventListener
    public void onLeadCreated(LeadCreatedEvent event) {
        try {
            String photographer = capitalizeName(event.getPhotographerSubdomain());
            // LOW-score leads reuse the mid-tier template for now — a dedicated,
            // lighter-touch LOW template is a follow-up.
            String template = "HIGH".equals(event.getScore()) ? highTemplate : medTemplate;
            String htmlBody = template
                .replace("{{clientName}}", event.getClientName() == null ? "" : event.getClientName())
                .replace("{{photographer}}", photographer);

            emailService.send(new EmailMessage(
                event.getClientEmail(),
                "Vielen Dank für Ihre Anfrage - " + photographer,
                htmlBody
            ));
        } catch (Exception e) {
            LOG.error("Failed to send auto-reply for lead {}: {}", event.getLeadId(), e.getMessage(), e);
        }
    }

    /**
     * Turns a tenant subdomain (e.g. "anna-foto") into a human display name
     * ("Anna Foto") for the auto-reply subject and footer. Falls back to a
     * neutral label when the subdomain is missing.
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

    private static String load(String path) {
        try {
            return new String(new ClassPathResource(path).getInputStream().readAllBytes(),
                StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to load email template: " + path, e);
        }
    }
}
