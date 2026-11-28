package com.photographplatform.api.auth.service;

import com.photographplatform.api.common.domain.CustomerLanguage;
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
     * @param language the inviter's: the invitee has no account, and so no
     *                 language, yet. Null (a job queued before it existed) is German.
     */
    public record Params(String studio, String from, String rawToken, CustomerLanguage language) {}

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
        Copy copy = params.language() == CustomerLanguage.EN ? Copy.EN : Copy.DE;
        String link = webBaseUrl.replaceAll("/+$", "") + "/invite?token=" + params.rawToken();
        String studio = params.studio();
        String html = EmailTemplate.document(
            copy.preheader + studio + copy.preheaderEnd,
            EmailTemplate.heading(copy.heading + studio + copy.headingEnd)
                + EmailTemplate.greeting(params.language(), null)
                + EmailTemplate.paragraph(HtmlEscape.escape(params.from()) + copy.body)
                + EmailTemplate.button(copy.button, link)
                + EmailTemplate.note(copy.pasteLink + "<br>"
                    + "<span style=\"word-break:break-all;\">" + HtmlEscape.escape(link) + "</span>")
                + EmailTemplate.note(copy.expiry),
            params.language());
        return new RenderedEmail(copy.subject + studio + copy.subjectEnd, html);
    }

    private enum Copy {
        DE("Einladung zu ", "",
            "Sie wurden zu ", " bei Fotolio eingeladen",
            "", " beitreten",
            " hat Sie eingeladen, im Studio bei Fotolio mitzuarbeiten. Mit der Einladung erhalten Sie "
                + "Zugriff auf die Buchungen, Kunden und Galerien des Studios.",
            "Einladung annehmen",
            "Oder kopieren Sie diesen Link in Ihren Browser:",
            "Die Einladung ist 7 Tage gültig. Wenn Sie sie nicht erwartet haben, können Sie diese "
                + "E-Mail ignorieren."),
        EN("You have been invited to ", "",
            "You have been invited to ", " on Fotolio",
            "Join ", "",
            " has invited you to work in their studio on Fotolio. Accepting gives you "
                + "access to the studio's bookings, clients and galleries.",
            "Accept invitation",
            "Or paste this link into your browser:",
            "This invitation expires in 7 days. If you were not "
                + "expecting it, you can safely ignore this email.");

        private final String subject;
        private final String subjectEnd;
        private final String preheader;
        private final String preheaderEnd;
        private final String heading;
        private final String headingEnd;
        private final String body;
        private final String button;
        private final String pasteLink;
        private final String expiry;

        @SuppressWarnings("checkstyle:ParameterNumber")
        Copy(String subject, String subjectEnd, String preheader, String preheaderEnd, String heading,
             String headingEnd, String body, String button, String pasteLink, String expiry) {
            this.subject = subject;
            this.subjectEnd = subjectEnd;
            this.preheader = preheader;
            this.preheaderEnd = preheaderEnd;
            this.heading = heading;
            this.headingEnd = headingEnd;
            this.body = body;
            this.button = button;
            this.pasteLink = pasteLink;
            this.expiry = expiry;
        }
    }
}
