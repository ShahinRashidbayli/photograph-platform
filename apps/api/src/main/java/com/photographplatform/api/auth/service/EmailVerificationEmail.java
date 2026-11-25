package com.photographplatform.api.auth.service;

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

    /** @param rawToken stored until sent; the job expires with the token */
    public record Params(String name, String rawToken) {}

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
        String link = webBaseUrl.replaceAll("/+$", "") + "/verify-email?token=" + params.rawToken();
        String html = EmailTemplate.document(
            "Confirm your email to activate your Fotolio account.",
            EmailTemplate.heading("Confirm your email")
                + EmailTemplate.paragraph("Hi " + HtmlEscape.escape(params.name())
                    + ", please confirm this email address belongs to you so we can deliver booking "
                    + "notifications, lead alerts and password resets.")
                + EmailTemplate.button("Confirm email", link)
                + EmailTemplate.note("Or paste this link into your browser:<br>"
                    + "<span style=\"word-break:break-all;\">" + HtmlEscape.escape(link) + "</span>")
                + EmailTemplate.note("This link expires in 24 hours. If you didn't create an account, "
                    + "you can safely ignore this email."));
        return new RenderedEmail("Confirm your Fotolio email", html);
    }
}
