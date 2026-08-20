package com.photographplatform.api.tenant;

import com.photographplatform.api.tenant.domain.Tenant;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@code hasBillingProfile()} is the gate on issuing any invoice, so it is
 * the codified form of §14 UStG's issuer requirements. The tax-number half
 * (Abs. 4 Nr. 2) used to be commented out because nothing could set those
 * fields; these tests pin it now that the settings endpoint collects them.
 */
class TenantBillingProfileTest {

    private static Tenant tenantWithAddress() {
        Tenant tenant = new Tenant("anna-foto", "anna@example.test");
        tenant.setBusinessName("Anna Fotografie");
        tenant.setAddressLine1("Musterstraße 1");
        tenant.setPostalCode("10115");
        tenant.setCity("Berlin");
        return tenant;
    }

    @Test
    void addressAloneIsNotEnough() {
        assertThat(tenantWithAddress().hasBillingProfile()).isFalse();
    }

    @Test
    void steuernummerSatisfiesTheTaxIdentifierRequirement() {
        Tenant tenant = tenantWithAddress();
        tenant.setTaxId("21/815/08150");
        assertThat(tenant.hasBillingProfile()).isTrue();
    }

    @Test
    void umsatzsteuerIdAlsoSatisfiesIt() {
        Tenant tenant = tenantWithAddress();
        tenant.setVatId("DE123456789");
        assertThat(tenant.hasBillingProfile()).isTrue();
    }

    @Test
    void blankStringsDoNotCountAsPresent() {
        Tenant tenant = tenantWithAddress();
        tenant.setTaxId("   ");
        tenant.setVatId("");
        assertThat(tenant.hasTaxIdentifier()).isFalse();
        assertThat(tenant.hasBillingProfile()).isFalse();
    }

    @Test
    void missingAddressFieldFailsEvenWithATaxNumber() {
        Tenant tenant = tenantWithAddress();
        tenant.setTaxId("21/815/08150");
        tenant.setCity("  ");
        assertThat(tenant.hasBillingProfile()).isFalse();
    }

    // ── Stripe Connect capability mirror ──────────────────────────────────

    @Test
    void cannotAcceptPaymentsUntilStripeSaysChargesAreEnabled() {
        Tenant tenant = tenantWithAddress();
        assertThat(tenant.canAcceptStripePayments()).isFalse();

        // Onboarding started: the account exists long before it can charge.
        tenant.setStripeAccountId("acct_123");
        tenant.applyStripeCapabilities(false, false, true);
        assertThat(tenant.canAcceptStripePayments()).isFalse();

        tenant.applyStripeCapabilities(true, true, true);
        assertThat(tenant.canAcceptStripePayments()).isTrue();
    }

    /**
     * Stripe can revoke {@code charges_enabled} later — pending
     * re-verification, say. That stops new charges, but it must not rewrite
     * history by clearing the moment onboarding was completed.
     */
    @Test
    void onboardedAtIsStampedOnceAndSurvivesACapabilityLapse() {
        Tenant tenant = tenantWithAddress();
        tenant.setStripeAccountId("acct_123");
        tenant.applyStripeCapabilities(true, true, true);
        var onboardedAt = tenant.getStripeOnboardedAt();
        assertThat(onboardedAt).isNotNull();

        tenant.applyStripeCapabilities(false, false, true);
        assertThat(tenant.canAcceptStripePayments()).isFalse();
        assertThat(tenant.getStripeOnboardedAt()).isEqualTo(onboardedAt);

        tenant.applyStripeCapabilities(true, true, true);
        assertThat(tenant.getStripeOnboardedAt()).isEqualTo(onboardedAt);
    }
}
