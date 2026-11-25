package com.photographplatform.api.auth.service;

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
     * @param code         stored until sent — it is the email. The job expires
     *                     with the code and is deleted once delivered.
     * @param validMinutes how long the code works, for the copy
     */
    public record Params(String greetingName, String code, long validMinutes) {}

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
        long minutes = params.validMinutes();
        String html = EmailTemplate.document(
            "Your Fotolio sign-in code — expires in " + minutes + " minutes.",
            EmailTemplate.heading("Your sign-in code")
                + EmailTemplate.paragraph("Hi " + HtmlEscape.escape(params.greetingName())
                    + ", enter this code in the tab you already have open. "
                    + "No password needed.")
                + codeBlock(params.code())
                + EmailTemplate.note("This code expires in " + minutes
                    + " minutes and can only be used once. If you didn't request it, "
                    + "you can safely ignore this email."));
        return new RenderedEmail("Your sign-in code: " + params.code(), html);
    }

    static String codeBlock(String code) {
        // Letter-spaced and oversized because the whole point is that it can be
        // read off a phone at a glance and typed into the tab already open.
        return "<p style=\"font-size:32px;font-weight:700;letter-spacing:8px;"
            + "text-align:center;margin:24px 0;font-family:monospace;\">"
            + HtmlEscape.escape(code) + "</p>";
    }
}
