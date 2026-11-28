package com.photographplatform.api.auth.service;

import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.common.util.HtmlEscape;
import com.photographplatform.api.notification.dto.EmailType;
import com.photographplatform.api.notification.email.EmailRenderer;
import com.photographplatform.api.notification.email.EmailTemplate;
import com.photographplatform.api.notification.email.RenderedEmail;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** The password-reset link, queued by {@link PasswordResetService}. */
@Component
public class PasswordResetEmail implements EmailRenderer<PasswordResetEmail.Params> {

    /** Stored in queued rows; never rename (see {@link EmailRenderer}). */
    public static final String TEMPLATE = "auth.password-reset";

    /**
     * @param greetingName the user's full name; null or blank greets without one
     * @param rawToken     has to be stored until sent — it is the email. The job
     *                     expires with the token and is deleted once delivered.
     * @param language     the user's; null (a job queued before it existed) is German
     */
    public record Params(String greetingName, String rawToken, CustomerLanguage language) {}

    @Value("${app.web.base-url:http://localhost:3000}")
    private String webBaseUrl;

    @Override
    public String template() {
        return TEMPLATE;
    }

    @Override
    public EmailType type() {
        return EmailType.PASSWORD_RESET;
    }

    @Override
    public Class<Params> paramsType() {
        return Params.class;
    }

    @Override
    public RenderedEmail render(Params params) {
        Copy copy = params.language() == CustomerLanguage.EN ? Copy.EN : Copy.DE;
        String link = webBaseUrl.replaceAll("/+$", "") + "/reset-password?token=" + params.rawToken();
        String html = EmailTemplate.document(
            copy.preheader,
            EmailTemplate.heading(copy.heading)
                + EmailTemplate.greeting(params.language(), params.greetingName())
                + EmailTemplate.paragraph(copy.body)
                + EmailTemplate.button(copy.button, link)
                + EmailTemplate.note(copy.pasteLink + "<br>"
                    + "<span style=\"word-break:break-all;\">" + HtmlEscape.escape(link) + "</span>")
                + EmailTemplate.note(copy.expiry),
            params.language());
        return new RenderedEmail(copy.subject, html);
    }

    private enum Copy {
        DE("Ihr Fotolio-Passwort zurücksetzen",
            "Setzen Sie Ihr Fotolio-Passwort zurück — der Link ist 1 Stunde gültig.",
            "Passwort zurücksetzen",
            "über den Button unten wählen Sie ein neues Passwort.",
            "Neues Passwort wählen",
            "Oder kopieren Sie diesen Link in Ihren Browser:",
            "Der Link ist 1 Stunde gültig und funktioniert nur einmal. Wenn Sie kein neues Passwort "
                + "angefordert haben, können Sie diese E-Mail ignorieren — Ihr Passwort bleibt unverändert."),
        EN("Reset your Fotolio password",
            "Reset your Fotolio password — link expires in 1 hour.",
            "Reset your password",
            "Tap the button below to choose a new password.",
            "Choose a new password",
            "Or paste this link into your browser:",
            "This link expires in 1 hour and can only be used once. If you didn't "
                + "request a password reset, you can safely ignore this email — your password "
                + "stays unchanged.");

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
