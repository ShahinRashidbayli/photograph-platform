package com.photographplatform.api.auth;

import com.photographplatform.api.auth.service.EmailVerificationEmail;
import com.photographplatform.api.auth.service.PasswordResetEmail;
import com.photographplatform.api.auth.service.SignInCodeEmail;
import com.photographplatform.api.auth.service.StaffInvitationEmail;
import com.photographplatform.api.auth.service.StudioSignInCodesEmail;
import com.photographplatform.api.auth.service.StudioSignInCodesEmail.StudioCode;
import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.notification.email.RenderedEmail;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The account and sign-in emails, rendered in German and in English: the
 * user's language for their own account, the sign-in page's for a code (#126).
 */
class AuthEmailLanguageTest {

    private static <T> T withBaseUrl(T renderer) {
        ReflectionTestUtils.setField(renderer, "webBaseUrl", "https://app.fotolio.de");
        return renderer;
    }

    // ── email verification ──

    @Test
    void verificationInGerman() {
        RenderedEmail email = withBaseUrl(new EmailVerificationEmail())
            .render(new EmailVerificationEmail.Params("Anna", "tok", CustomerLanguage.DE));

        assertThat(email.subject()).isEqualTo("Bestätigen Sie Ihre E-Mail-Adresse bei Fotolio");
        assertThat(email.htmlBody())
            .contains("<html lang=\"de\"")
            .contains("Hallo Anna,")
            .contains("E-Mail-Adresse bestätigen")
            .contains("https://app.fotolio.de/verify-email?token=tok")
            .doesNotContain("Confirm");
    }

    @Test
    void verificationInEnglish() {
        RenderedEmail email = withBaseUrl(new EmailVerificationEmail())
            .render(new EmailVerificationEmail.Params("Anna", "tok", CustomerLanguage.EN));

        assertThat(email.subject()).isEqualTo("Confirm your Fotolio email");
        assertThat(email.htmlBody())
            .contains("<html lang=\"en\"")
            .contains("Hi Anna,")
            .contains("Confirm email")
            .doesNotContain("bestätigen");
    }

    @Test
    void verificationWithoutANameGreetsNeutrally() {
        RenderedEmail email = withBaseUrl(new EmailVerificationEmail())
            .render(new EmailVerificationEmail.Params(null, "tok", CustomerLanguage.EN));

        assertThat(email.htmlBody()).contains(">Hi,</p>").doesNotContain("there").doesNotContain("null");
    }

    // ── password reset ──

    @Test
    void passwordResetInGerman() {
        RenderedEmail email = withBaseUrl(new PasswordResetEmail())
            .render(new PasswordResetEmail.Params("Anna", "tok", CustomerLanguage.DE));

        assertThat(email.subject()).isEqualTo("Ihr Fotolio-Passwort zurücksetzen");
        assertThat(email.htmlBody())
            .contains("<html lang=\"de\"")
            .contains("Hallo Anna,")
            .contains("Neues Passwort wählen")
            .contains("https://app.fotolio.de/reset-password?token=tok")
            .doesNotContain("Reset your password");
    }

    @Test
    void passwordResetInEnglish() {
        RenderedEmail email = withBaseUrl(new PasswordResetEmail())
            .render(new PasswordResetEmail.Params("Anna", "tok", CustomerLanguage.EN));

        assertThat(email.subject()).isEqualTo("Reset your Fotolio password");
        assertThat(email.htmlBody())
            .contains("<html lang=\"en\"")
            .contains("Hi Anna,")
            .contains("Choose a new password")
            .doesNotContain("Passwort");
    }

    // ── staff invitation ──

    @Test
    void invitationInGerman() {
        RenderedEmail email = withBaseUrl(new StaffInvitationEmail())
            .render(new StaffInvitationEmail.Params("Studio Lichtblick", "Anna", "tok", CustomerLanguage.DE));

        assertThat(email.subject()).isEqualTo("Einladung zu Studio Lichtblick");
        assertThat(email.htmlBody())
            .contains("<html lang=\"de\"")
            .contains("Studio Lichtblick beitreten")
            .contains("Anna hat Sie eingeladen")
            .contains("Einladung annehmen")
            .doesNotContain("invited");
    }

    @Test
    void invitationInEnglish() {
        RenderedEmail email = withBaseUrl(new StaffInvitationEmail())
            .render(new StaffInvitationEmail.Params("Studio Lichtblick", "Anna", "tok", CustomerLanguage.EN));

        assertThat(email.subject()).isEqualTo("You have been invited to Studio Lichtblick");
        assertThat(email.htmlBody())
            .contains("<html lang=\"en\"")
            .contains("Join Studio Lichtblick")
            .contains("Anna has invited you")
            .contains("Accept invitation")
            .doesNotContain("Einladung");
    }

    // ── sign-in code (subdomain) ──

    @Test
    void signInCodeInGerman() {
        RenderedEmail email = new SignInCodeEmail()
            .render(new SignInCodeEmail.Params("Maria", "004182", 10, CustomerLanguage.DE));

        assertThat(email.subject()).isEqualTo("Ihr Anmeldecode: 004182");
        assertThat(email.htmlBody())
            .contains("<html lang=\"de\"")
            .contains("Hallo Maria,")
            .contains("004182")
            .contains("Der Code ist 10 Minuten gültig")
            .doesNotContain("sign-in");
    }

    @Test
    void signInCodeInEnglish() {
        RenderedEmail email = new SignInCodeEmail()
            .render(new SignInCodeEmail.Params("Maria", "004182", 10, CustomerLanguage.EN));

        assertThat(email.subject()).isEqualTo("Your sign-in code: 004182");
        assertThat(email.htmlBody())
            .contains("<html lang=\"en\"")
            .contains("Hi Maria,")
            .contains("This code expires in 10 minutes")
            .doesNotContain("Anmeldecode");
    }

    @Test
    void signInCodeNeverGreetsTheEmailAddress() {
        RenderedEmail email = new SignInCodeEmail()
            .render(new SignInCodeEmail.Params("kunde.anna@example.test", "004182", 10, CustomerLanguage.DE));

        assertThat(email.htmlBody()).contains(">Hallo,</p>").doesNotContain("kunde.anna");
    }

    // ── sign-in codes (no subdomain) ──

    @Test
    void studioCodesInGerman() {
        RenderedEmail one = new StudioSignInCodesEmail().render(new StudioSignInCodesEmail.Params(
            List.of(new StudioCode("Studio A", "111111")), 10, CustomerLanguage.DE));
        RenderedEmail several = new StudioSignInCodesEmail().render(new StudioSignInCodesEmail.Params(
            List.of(new StudioCode("Studio A", "111111"), new StudioCode("Studio B", "222222")), 10,
            CustomerLanguage.DE));

        assertThat(one.subject()).isEqualTo("Ihr Anmeldecode: 111111");
        assertThat(one.htmlBody()).contains("<html lang=\"de\"").contains("bei Studio A anzumelden");
        assertThat(several.subject()).isEqualTo("Ihre Anmeldecodes");
        assertThat(several.htmlBody()).contains("mehr als einem Fotostudio").contains("222222");
    }

    @Test
    void studioCodesInEnglish() {
        RenderedEmail one = new StudioSignInCodesEmail().render(new StudioSignInCodesEmail.Params(
            List.of(new StudioCode("Studio A", "111111")), 10, CustomerLanguage.EN));

        assertThat(one.subject()).isEqualTo("Your sign-in code: 111111");
        assertThat(one.htmlBody()).contains("<html lang=\"en\"").contains("to sign in to Studio A");
    }

    @Test
    void noStudioInBothLanguages() {
        RenderedEmail de = new StudioSignInCodesEmail()
            .render(new StudioSignInCodesEmail.Params(List.of(), 10, CustomerLanguage.DE));
        RenderedEmail en = new StudioSignInCodesEmail()
            .render(new StudioSignInCodesEmail.Params(List.of(), 10, CustomerLanguage.EN));

        assertThat(de.subject()).isEqualTo("Anmeldung bei Fotolio");
        assertThat(de.htmlBody()).contains("<html lang=\"de\"").contains("Wir haben Ihr Fotostudio nicht gefunden");
        assertThat(en.subject()).isEqualTo("Signing in to Fotolio");
        assertThat(en.htmlBody()).contains("<html lang=\"en\"").contains("We couldn&#39;t find your photographer");
    }

    @Test
    void aJobQueuedBeforeTheLanguageExistedRendersInGerman() {
        RenderedEmail email = new SignInCodeEmail().render(new SignInCodeEmail.Params("Maria", "004182", 10, null));

        assertThat(email.htmlBody()).contains("<html lang=\"de\"").contains("Ihr Anmeldecode");
    }
}
