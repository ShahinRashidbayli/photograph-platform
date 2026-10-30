package com.photographplatform.api.payment;

import com.photographplatform.api.payment.config.PaymentProperties;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Startup validation for the Stripe credentials.
 *
 * <p>Each case below is a deployment that boots happily and then fails only in
 * front of a paying customer — the settings screen says "Ready", the Pay button
 * works, and the money either never arrives or never gets recorded. That is
 * exactly the shape of bug a boot-time check is for.
 */
class PaymentPropertiesValidationTest {

    private static PaymentProperties props(String secret, String publishable, String webhook) {
        PaymentProperties p = new PaymentProperties();
        p.setSecretKey(secret);
        p.setPublishableKey(publishable);
        p.setWebhookSecret(webhook);
        return p;
    }

    /** Running without Stripe is legitimate — Überweisung needs none of it. */
    @Test
    void blankSecretKeyDisablesStripeWithoutComplaint() {
        assertThatCode(() -> props(null, null, null).validate()).doesNotThrowAnyException();
        assertThatCode(() -> props("  ", null, null).validate()).doesNotThrowAnyException();
    }

    @Test
    void fullyConfiguredStripePasses() {
        assertThatCode(() -> props("sk_test_123", "pk_test_123", "whsec_123").validate())
            .doesNotThrowAnyException();
    }

    /** Restricted keys are a legitimate secret-key form too. */
    @Test
    void restrictedKeyIsAcceptedAsASecretKey() {
        assertThatCode(() -> props("rk_test_123", "pk_test_123", "whsec_123").validate())
            .doesNotThrowAnyException();
    }

    @Test
    void missingPublishableKeyIsRejected() {
        assertThatThrownBy(() -> props("sk_test_123", "", "whsec_123").validate())
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("STRIPE_PUBLISHABLE_KEY");
    }

    /**
     * The costly direction of the classic swap: the publishable key is handed
     * to every browser, so a secret key in that slot leaks it to every visitor.
     */
    @Test
    void secretKeyInThePublishableSlotIsRejected() {
        assertThatThrownBy(() -> props("sk_test_123", "sk_test_123", "whsec_123").validate())
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("pk_");
    }

    @Test
    void publishableKeyInTheSecretSlotIsRejected() {
        assertThatThrownBy(() -> props("pk_test_123", "pk_test_123", "whsec_123").validate())
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("publishable");
    }

    /** No webhook secret means money is collected and no invoice is ever paid. */
    @Test
    void missingWebhookSecretIsRejected() {
        assertThatThrownBy(() -> props("sk_test_123", "pk_test_123", null).validate())
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("STRIPE_WEBHOOK_SECRET");
    }
}
