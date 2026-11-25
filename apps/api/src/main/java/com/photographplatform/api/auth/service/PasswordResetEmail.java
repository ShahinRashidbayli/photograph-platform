package com.photographplatform.api.auth.service;

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
     * @param rawToken has to be stored until sent — it is the email. The job
     *                 expires with the token and is deleted once delivered.
     */
    public record Params(String greetingName, String rawToken) {}

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
        String link = webBaseUrl.replaceAll("/+$", "") + "/reset-password?token=" + params.rawToken();
        String html = EmailTemplate.document(
            "Reset your Fotolio password — link expires in 1 hour.",
            EmailTemplate.heading("Reset your password")
                + EmailTemplate.paragraph("Hi " + HtmlEscape.escape(params.greetingName())
                    + ", tap the button below to choose a new password.")
                + EmailTemplate.button("Choose a new password", link)
                + EmailTemplate.note("Or paste this link into your browser:<br>"
                    + "<span style=\"word-break:break-all;\">" + HtmlEscape.escape(link) + "</span>")
                + EmailTemplate.note("This link expires in 1 hour and can only be used once. If you didn't "
                    + "request a password reset, you can safely ignore this email — your password "
                    + "stays unchanged."));
        return new RenderedEmail("Reset your Fotolio password", html);
    }
}
