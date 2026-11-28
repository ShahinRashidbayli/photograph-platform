package com.photographplatform.api.auth.service;

import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.common.util.HtmlEscape;
import com.photographplatform.api.notification.dto.EmailType;
import com.photographplatform.api.notification.email.EmailRenderer;
import com.photographplatform.api.notification.email.EmailTemplate;
import com.photographplatform.api.notification.email.RenderedEmail;
import org.springframework.stereotype.Component;

/** A customer's sign-in code on a studio's own subdomain, queued by {@link CustomerAuthService}. */
@Component
public class SignInCodeEmail implements EmailRenderer<SignInCodeEmail.Params> {

    /** Stored in queued rows; never rename (see {@link EmailRenderer}). */
    public static final String TEMPLATE = "auth.sign-in-code";

    /**
     * @param greetingName the Customer's name; null or blank greets without one
     * @param code         stored until sent — it is the email. The job expires
     *                     with the code and is deleted once delivered.
     * @param validMinutes how long the code works, for the copy
     * @param language     the sign-in page's, sent with the request; null is German
     */
    public record Params(String greetingName, String code, long validMinutes, CustomerLanguage language) {}

    @Override
    public String template() {
        return TEMPLATE;
    }

    @Override
    public EmailType type() {
        return EmailType.LOGIN_CODE;
    }

    @Override
    public Class<Params> paramsType() {
        return Params.class;
    }

    @Override
    public RenderedEmail render(Params params) {
        Copy copy = params.language() == CustomerLanguage.EN ? Copy.EN : Copy.DE;
        long minutes = params.validMinutes();
        String html = EmailTemplate.document(
            copy.preheader + minutes + copy.minutes,
            EmailTemplate.heading(copy.heading)
                + EmailTemplate.greeting(params.language(), params.greetingName())
                + EmailTemplate.paragraph(copy.body)
                + codeBlock(params.code())
                + EmailTemplate.note(copy.expiry + minutes + copy.expiryEnd),
            params.language());
        return new RenderedEmail(copy.subject + params.code(), html);
    }

    static String codeBlock(String code) {
        // Letter-spaced and oversized because the whole point is that it can be
        // read off a phone at a glance and typed into the tab already open.
        return "<p style=\"font-size:32px;font-weight:700;letter-spacing:8px;"
            + "text-align:center;margin:24px 0;font-family:monospace;\">"
            + HtmlEscape.escape(code) + "</p>";
    }

    private enum Copy {
        DE("Ihr Anmeldecode: ", "Ihr Fotolio-Anmeldecode — gültig für ", " Minuten.", "Ihr Anmeldecode",
            "geben Sie diesen Code in dem Tab ein, den Sie bereits geöffnet haben. Ein Passwort brauchen "
                + "Sie nicht.",
            "Der Code ist ",
            " Minuten gültig und funktioniert nur einmal. Wenn Sie ihn nicht angefordert haben, können Sie "
                + "diese E-Mail ignorieren."),
        EN("Your sign-in code: ", "Your Fotolio sign-in code — expires in ", " minutes.", "Your sign-in code",
            "Enter this code in the tab you already have open. No password needed.",
            "This code expires in ",
            " minutes and can only be used once. If you didn't request it, you can safely ignore this email.");

        private final String subject;
        private final String preheader;
        private final String minutes;
        private final String heading;
        private final String body;
        private final String expiry;
        private final String expiryEnd;

        Copy(String subject, String preheader, String minutes, String heading, String body, String expiry,
             String expiryEnd) {
            this.subject = subject;
            this.preheader = preheader;
            this.minutes = minutes;
            this.heading = heading;
            this.body = body;
            this.expiry = expiry;
            this.expiryEnd = expiryEnd;
        }
    }
}
