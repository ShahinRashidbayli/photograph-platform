package com.photographplatform.api.notification.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.photographplatform.api.common.util.HtmlEscape;
import com.photographplatform.api.notification.dto.EmailType;
import com.photographplatform.api.notification.email.EmailRenderer;
import com.photographplatform.api.notification.email.EmailTemplate;
import com.photographplatform.api.notification.email.RenderedEmail;
import org.springframework.stereotype.Service;

/**
 * Renders the old German enquiry acknowledgement for rows already in the outbox.
 *
 * <p>Nothing queues it any more: {@code messaging}'s Enquiry received replaced
 * it, in the Customer's language and the studio's name (#127). It stays
 * registered for one release so rows queued before that deploy still render;
 * {@link EmailTemplate}'s Fotolio shell is what those rows were queued to look
 * like. Delete it, and {@link EmailType#LEAD_AUTO_REPLY}, in the release after.
 */
@Deprecated(forRemoval = true)
@Service
public class AutoReplyService implements EmailRenderer<AutoReplyService.Params> {

    /**
     * @param studioName null when the studio has entered no business or legal name
     */
    // Rows queued before #103 also carry `score` and `photographerSubdomain`.
    // Ignoring them lets those rows still render, now without the invented offer.
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Params(String clientName, String studioName) {}

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
        // Trimmed when it was queued; rows queued before #103 carry none.
        String studio = params.studioName();
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
                + EmailTemplate.paragraph(signOff)
                + EmailTemplate.note("Diese Bestätigung wurde automatisch versendet."),
            "de");
    }
}
