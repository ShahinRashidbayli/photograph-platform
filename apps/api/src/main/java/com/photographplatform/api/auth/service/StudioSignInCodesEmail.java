package com.photographplatform.api.auth.service;

import com.photographplatform.api.common.util.HtmlEscape;
import com.photographplatform.api.notification.dto.EmailType;
import com.photographplatform.api.notification.email.EmailRenderer;
import com.photographplatform.api.notification.email.EmailTemplate;
import com.photographplatform.api.notification.email.RenderedEmail;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * The answer to a sign-in by address alone, queued by {@link CustomerAuthService}:
 * one code per studio that knows the address, or — when none does — a note
 * saying so. Saying it in the mailbox rather than on the page tells the owner
 * of the address what happened and tells nobody else whether it is anyone's
 * client.
 */
@Component
public class StudioSignInCodesEmail implements EmailRenderer<StudioSignInCodesEmail.Params> {

    /** Stored in queued rows; never rename (see {@link EmailRenderer}). */
    public static final String TEMPLATE = "auth.studio-sign-in-codes";

    /** @param code stored until sent; the job expires with the codes */
    public record StudioCode(String studioName, String code) {}

    /** @param codes empty when no studio has the address on file */
    public record Params(List<StudioCode> codes, long validMinutes) {}

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
        List<StudioCode> codes = params.codes() == null ? List.of() : params.codes();
        return codes.isEmpty() ? noStudio() : withCodes(codes, params.validMinutes());
    }

    /**
     * One email for every studio. With one studio it reads like the subdomain
     * flow's (code in the subject, for the phone's notification); with several,
     * each code stands under the studio it opens.
     */
    private static RenderedEmail withCodes(List<StudioCode> codes, long minutes) {
        StringBuilder blocks = new StringBuilder();
        for (StudioCode entry : codes) {
            if (codes.size() > 1) {
                blocks.append(EmailTemplate.paragraph(
                    "<strong>" + HtmlEscape.escape(entry.studioName()) + "</strong>"));
            }
            blocks.append(SignInCodeEmail.codeBlock(entry.code()));
        }
        String intro = codes.size() == 1
            ? "Enter this code in the tab you already have open to sign in to "
                + HtmlEscape.escape(codes.get(0).studioName()) + ". No password needed."
            : "You are a client of more than one photographer. Each code below signs you in to that "
                + "photographer only — enter the one you want in the tab you already have open.";
        String html = EmailTemplate.document(
            "Your Fotolio sign-in code — expires in " + minutes + " minutes.",
            EmailTemplate.heading(codes.size() == 1 ? "Your sign-in code" : "Your sign-in codes")
                + EmailTemplate.paragraph(intro)
                + blocks
                + EmailTemplate.note("Codes expire in " + minutes
                    + " minutes and can only be used once. If you didn't request this, "
                    + "you can safely ignore this email."));
        String subject = codes.size() == 1
            ? "Your sign-in code: " + codes.get(0).code()
            : "Your sign-in codes";
        return new RenderedEmail(subject, html);
    }

    private static RenderedEmail noStudio() {
        String html = EmailTemplate.document(
            "We couldn't find your photographer.",
            EmailTemplate.heading("We couldn't find your photographer")
                + EmailTemplate.paragraph("Someone asked to sign in to Fotolio with this address, "
                    + "but no photographer has it on file yet.")
                + EmailTemplate.paragraph("Use the address you gave your photographer, or ask them "
                    + "for their sign-in link.")
                + EmailTemplate.note("If this wasn't you, you can safely ignore this email."));
        return new RenderedEmail("Signing in to Fotolio", html);
    }
}
