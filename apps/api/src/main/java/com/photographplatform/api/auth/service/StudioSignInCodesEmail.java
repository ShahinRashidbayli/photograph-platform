package com.photographplatform.api.auth.service;

import com.photographplatform.api.common.domain.CustomerLanguage;
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

    /**
     * @param codes    empty when no studio has the address on file
     * @param language the sign-in page's, sent with the request; null is German
     */
    public record Params(List<StudioCode> codes, long validMinutes, CustomerLanguage language) {}

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
        CustomerLanguage language = params.language();
        Copy copy = language == CustomerLanguage.EN ? Copy.EN : Copy.DE;
        return codes.isEmpty()
            ? noStudio(copy, language)
            : withCodes(codes, params.validMinutes(), copy, language);
    }

    /**
     * One email for every studio. With one studio it reads like the subdomain
     * flow's (code in the subject, for the phone's notification); with several,
     * each code stands under the studio it opens.
     */
    private static RenderedEmail withCodes(List<StudioCode> codes, long minutes, Copy copy,
                                           CustomerLanguage language) {
        StringBuilder blocks = new StringBuilder();
        for (StudioCode entry : codes) {
            if (codes.size() > 1) {
                blocks.append(EmailTemplate.paragraph(
                    "<strong>" + HtmlEscape.escape(entry.studioName()) + "</strong>"));
            }
            blocks.append(SignInCodeEmail.codeBlock(entry.code()));
        }
        String intro = codes.size() == 1
            ? copy.oneStudio + HtmlEscape.escape(codes.get(0).studioName()) + copy.oneStudioEnd
            : copy.severalStudios;
        String html = EmailTemplate.document(
            copy.preheader + minutes + copy.minutes,
            EmailTemplate.heading(codes.size() == 1 ? copy.headingOne : copy.headingSeveral)
                + EmailTemplate.greeting(language, null)
                + EmailTemplate.paragraph(intro)
                + blocks
                + EmailTemplate.note(copy.expiry + minutes + copy.expiryEnd),
            language);
        String subject = codes.size() == 1
            ? copy.subjectOne + codes.get(0).code()
            : copy.subjectSeveral;
        return new RenderedEmail(subject, html);
    }

    private static RenderedEmail noStudio(Copy copy, CustomerLanguage language) {
        String html = EmailTemplate.document(
            copy.noStudioHeading + ".",
            EmailTemplate.heading(copy.noStudioHeading)
                + EmailTemplate.greeting(language, null)
                + EmailTemplate.paragraph(copy.noStudio)
                + EmailTemplate.paragraph(copy.noStudioAdvice)
                + EmailTemplate.note(copy.notYou),
            language);
        return new RenderedEmail(copy.noStudioSubject, html);
    }

    /**
     * The fixed copy. Without a greeting name: the address may belong to
     * several Customer records, or to none, so there is no one name to use.
     */
    private enum Copy {
        DE("Ihr Anmeldecode: ", "Ihre Anmeldecodes",
            "Ihr Fotolio-Anmeldecode — gültig für ", " Minuten.",
            "Ihr Anmeldecode", "Ihre Anmeldecodes",
            "geben Sie diesen Code in dem Tab ein, den Sie bereits geöffnet haben, um sich bei ",
            " anzumelden. Ein Passwort brauchen Sie nicht.",
            "Sie sind Kundin oder Kunde bei mehr als einem Fotostudio. Jeder Code unten meldet Sie nur "
                + "bei diesem Studio an — geben Sie den gewünschten in dem Tab ein, den Sie bereits "
                + "geöffnet haben.",
            "Die Codes sind ",
            " Minuten gültig und funktionieren nur einmal. Wenn Sie das nicht angefordert haben, können "
                + "Sie diese E-Mail ignorieren.",
            "Anmeldung bei Fotolio",
            "Wir haben Ihr Fotostudio nicht gefunden",
            "jemand wollte sich mit dieser Adresse bei Fotolio anmelden, aber noch kein Fotostudio hat "
                + "sie gespeichert.",
            "Verwenden Sie die Adresse, die Sie Ihrem Fotostudio gegeben haben, oder bitten Sie das "
                + "Studio um seinen Anmeldelink.",
            "Wenn Sie das nicht waren, können Sie diese E-Mail ignorieren."),
        EN("Your sign-in code: ", "Your sign-in codes",
            "Your Fotolio sign-in code — expires in ", " minutes.",
            "Your sign-in code", "Your sign-in codes",
            "Enter this code in the tab you already have open to sign in to ",
            ". No password needed.",
            "You are a client of more than one photographer. Each code below signs you in to that "
                + "photographer only — enter the one you want in the tab you already have open.",
            "Codes expire in ",
            " minutes and can only be used once. If you didn't request this, "
                + "you can safely ignore this email.",
            "Signing in to Fotolio",
            "We couldn't find your photographer",
            "Someone asked to sign in to Fotolio with this address, "
                + "but no photographer has it on file yet.",
            "Use the address you gave your photographer, or ask them "
                + "for their sign-in link.",
            "If this wasn't you, you can safely ignore this email.");

        private final String subjectOne;
        private final String subjectSeveral;
        private final String preheader;
        private final String minutes;
        private final String headingOne;
        private final String headingSeveral;
        private final String oneStudio;
        private final String oneStudioEnd;
        private final String severalStudios;
        private final String expiry;
        private final String expiryEnd;
        private final String noStudioSubject;
        private final String noStudioHeading;
        private final String noStudio;
        private final String noStudioAdvice;
        private final String notYou;

        @SuppressWarnings("checkstyle:ParameterNumber")
        Copy(String subjectOne, String subjectSeveral, String preheader, String minutes, String headingOne,
             String headingSeveral, String oneStudio, String oneStudioEnd, String severalStudios, String expiry,
             String expiryEnd, String noStudioSubject, String noStudioHeading, String noStudio,
             String noStudioAdvice, String notYou) {
            this.subjectOne = subjectOne;
            this.subjectSeveral = subjectSeveral;
            this.preheader = preheader;
            this.minutes = minutes;
            this.headingOne = headingOne;
            this.headingSeveral = headingSeveral;
            this.oneStudio = oneStudio;
            this.oneStudioEnd = oneStudioEnd;
            this.severalStudios = severalStudios;
            this.expiry = expiry;
            this.expiryEnd = expiryEnd;
            this.noStudioSubject = noStudioSubject;
            this.noStudioHeading = noStudioHeading;
            this.noStudio = noStudio;
            this.noStudioAdvice = noStudioAdvice;
            this.notYou = notYou;
        }
    }
}
