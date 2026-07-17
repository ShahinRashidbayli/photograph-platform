package com.photographplatform.api.notification.config;

import com.photographplatform.api.notification.config.EmailProperties.Provider;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The point of this validation is that a mail misconfiguration must never be
 * survivable. Sends are best-effort by design ({@code EmailService} swallows
 * failures so an outage can't roll back a booking), which means a provider with
 * no API key would drop every message while every endpoint kept reporting
 * success — customers would silently never receive a magic link. So each test
 * below asserts a *refusal to start*, not a fallback.
 */
class EmailPropertiesTest {

    private static final Provider CONFIGURED =
        new Provider("api-key-value", "https://api.example.com");
    private static final Provider NO_KEY =
        new Provider("  ", "https://api.example.com");

    private static EmailProperties build(String provider, String from,
                                         Provider sendgrid, Provider resend) {
        return new EmailProperties(provider, from, "Fotolio", sendgrid, resend);
    }

    // ── the failures that used to be silent ───────────────────────────────────

    @Test
    @DisplayName("sendgrid without an API key refuses to boot instead of dropping mail")
    void sendgridWithoutKeyFailsFast() {
        assertThatThrownBy(() -> build("sendgrid", "no-reply@fotolio.de", NO_KEY, CONFIGURED))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("SENDGRID_API_KEY")
            .hasMessageContaining("EMAIL_PROVIDER=none");
    }

    @Test
    @DisplayName("resend without an API key refuses to boot")
    void resendWithoutKeyFailsFast() {
        assertThatThrownBy(() -> build("resend", "no-reply@fotolio.de", CONFIGURED, NO_KEY))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("RESEND_API_KEY");
    }

    @Test
    @DisplayName("a real provider with no from-address refuses to boot")
    void missingFromAddressFailsFast() {
        assertThatThrownBy(() -> build("sendgrid", "  ", CONFIGURED, CONFIGURED))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("EMAIL_FROM");
    }

    /**
     * Previously this surfaced as a NoSuchBeanDefinitionException for EmailSender
     * — accurate, but it never mentioned the typo that caused it.
     */
    @Test
    @DisplayName("an unknown provider names itself in the error")
    void unknownProviderFailsWithAnActionableMessage() {
        assertThatThrownBy(() -> build("smtp", "no-reply@fotolio.de", CONFIGURED, CONFIGURED))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("Unknown EMAIL_PROVIDER 'smtp'")
            .hasMessageContaining("sendgrid");
    }

    // ── the configurations that must keep working ─────────────────────────────

    @Test
    @DisplayName("a fully configured provider binds cleanly")
    void configuredProviderIsAccepted() {
        assertThatCode(() -> build("sendgrid", "no-reply@fotolio.de", CONFIGURED, null))
            .doesNotThrowAnyException();
        assertThatCode(() -> build("resend", "no-reply@fotolio.de", null, CONFIGURED))
            .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("EMAIL_PROVIDER=none is allowed — disabling email is explicit, not accidental")
    void noneNeedsNoCredentials() {
        EmailProperties props = build("none", null, null, null);
        assertThat(props.provider()).isEqualTo(EmailProperties.NONE);
    }

    /**
     * The test context binds no {@code app.email.*} at all, so an absent provider
     * has to mean "no-op" — mirroring NoOpEmailSender's {@code matchIfMissing=true}.
     */
    @Test
    @DisplayName("absent config binds to none rather than exploding")
    void absentProviderDefaultsToNone() {
        assertThat(build(null, null, null, null).provider()).isEqualTo(EmailProperties.NONE);
        assertThat(build("   ", null, null, null).provider()).isEqualTo(EmailProperties.NONE);
    }

    @Test
    @DisplayName("provider matching is case- and whitespace-insensitive")
    void providerIsNormalized() {
        assertThat(build("  SendGrid ", "no-reply@fotolio.de", CONFIGURED, null).provider())
            .isEqualTo(EmailProperties.SENDGRID);
    }
}
