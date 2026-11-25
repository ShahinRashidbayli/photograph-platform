package com.photographplatform.api.auth.service;

import com.photographplatform.api.common.util.HtmlEscape;
import com.photographplatform.api.notification.dto.EmailType;
import com.photographplatform.api.notification.email.EmailRenderer;
import com.photographplatform.api.notification.email.EmailTemplate;
import com.photographplatform.api.notification.email.RenderedEmail;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** The invitation for a colleague to join a studio, queued by {@link StaffInvitationService}. */
@Component
public class StaffInvitationEmail implements EmailRenderer<StaffInvitationEmail.Params> {

    /** Stored in queued rows; never rename (see {@link EmailRenderer}). */
    public static final String TEMPLATE = "auth.staff-invitation";

    /**
     * @param studio   the studio's name as the invitee should read it
     * @param from     who invited them
     * @param rawToken stored until sent; the job expires with the invitation
     */
    public record Params(String studio, String from, String rawToken) {}

    @Value("${app.web.base-url:http://localhost:3000}")
    private String webBaseUrl;

    @Override
    public String template() {
        return TEMPLATE;
    }

    @Override
    public EmailType type() {
        return EmailType.STAFF_INVITATION;
    }

    @Override
    public Class<Params> paramsType() {
        return Params.class;
    }

    @Override
    public RenderedEmail render(Params params) {
        String link = webBaseUrl.replaceAll("/+$", "") + "/invite?token=" + params.rawToken();
        String studio = params.studio();
        String html = EmailTemplate.document(
            "You have been invited to " + studio + " on Fotolio",
            EmailTemplate.heading("Join " + HtmlEscape.escape(studio))
                + EmailTemplate.paragraph(HtmlEscape.escape(params.from())
                    + " has invited you to work in their studio on Fotolio. Accepting gives you "
                    + "access to the studio's bookings, clients and galleries.")
                + EmailTemplate.button("Accept invitation", link)
                + EmailTemplate.note("Or paste this link into your browser:<br>"
                    + "<span style=\"word-break:break-all;\">" + HtmlEscape.escape(link) + "</span>")
                + EmailTemplate.note("This invitation expires in 7 days. If you were not "
                    + "expecting it, you can safely ignore this email."));
        return new RenderedEmail("You have been invited to " + studio, html);
    }
}
