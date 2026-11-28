package com.photographplatform.api.auth.service;

import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.common.util.HtmlEscape;
import com.photographplatform.api.notification.dto.EmailType;
import com.photographplatform.api.notification.email.EmailRenderer;
import com.photographplatform.api.notification.email.EmailTemplate;
import com.photographplatform.api.notification.email.RenderedEmail;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** The address confirmation for a new studio account, queued by {@link EmailVerificationService}. */
@Component
public class EmailVerificationEmail implements EmailRenderer<EmailVerificationEmail.Params> {

    /** Stored in queued rows; never rename (see {@link EmailRenderer}). */
    public static final String TEMPLATE = "auth.email-verification";

    /**
     * @param name     the user's full name; null or blank greets without one
     * @param rawToken stored until sent; the job expires with the token
     * @param language the user's; null (a job queued before it existed) is German
     */
    public record Params(String name, String rawToken, CustomerLanguage language) {}

    @Value("${app.web.base-url:http://localhost:3000}")
    private String webBaseUrl;

    @Override
    public String template() {
        return TEMPLATE;
    }

    @Override
    public EmailType type() {
        return EmailType.EMAIL_VERIFICATION;
    }

    @Override
    public Class<Params> paramsType() {
        return Params.class;
    }

    @Override
    public RenderedEmail render(Params params) {
        Copy copy = params.language() == CustomerLanguage.EN ? Copy.EN : Copy.DE;
        String link = webBaseUrl.replaceAll("/+$", "") + "/verify-email?token=" + params.rawToken();
        String html = EmailTemplate.document(
            copy.preheader,
            EmailTemplate.heading(copy.heading)
                + EmailTemplate.greeting(params.language(), params.name())
                + EmailTemplate.paragraph(copy.body)
                + EmailTemplate.button(copy.button, link)
                + EmailTemplate.note(copy.pasteLink + "<br>"
                    + "<span style=\"word-break:break-all;\">" + HtmlEscape.escape(link) + "</span>")
                + EmailTemplate.note(copy.expiry),
            params.language());
        return new RenderedEmail(copy.subject, html);
    }

    private enum Copy {
        DE("Bestätigen Sie Ihre E-Mail-Adresse bei Fotolio",
            "Bestätigen Sie Ihre E-Mail-Adresse, um Ihr Fotolio-Konto zu aktivieren.",
            "E-Mail-Adresse bestätigen",
            "bitte bestätigen Sie, dass diese E-Mail-Adresse Ihnen gehört. Dann können wir Ihnen "
                + "Buchungsbenachrichtigungen, neue Anfragen und Links zum Zurücksetzen des Passworts senden.",
            "E-Mail-Adresse bestätigen",
            "Oder kopieren Sie diesen Link in Ihren Browser:",
            "Der Link ist 24 Stunden gültig. Wenn Sie kein Konto angelegt haben, können Sie diese "
                + "E-Mail ignorieren."),
        EN("Confirm your Fotolio email",
            "Confirm your email to activate your Fotolio account.",
            "Confirm your email",
            "Please confirm this email address belongs to you so we can deliver booking "
                + "notifications, lead alerts and password resets.",
            "Confirm email",
            "Or paste this link into your browser:",
            "This link expires in 24 hours. If you didn't create an account, "
                + "you can safely ignore this email.");

        private final String subject;
        private final String preheader;
        private final String heading;
        private final String body;
        private final String button;
        private final String pasteLink;
        private final String expiry;

        Copy(String subject, String preheader, String heading, String body, String button, String pasteLink,
             String expiry) {
            this.subject = subject;
            this.preheader = preheader;
            this.heading = heading;
            this.body = body;
            this.button = button;
            this.pasteLink = pasteLink;
            this.expiry = expiry;
        }
    }
}
