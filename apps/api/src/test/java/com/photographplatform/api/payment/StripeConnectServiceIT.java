package com.photographplatform.api.payment;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.payment.dto.StripeConnectStatusResponse;
import com.photographplatform.api.payment.service.StripeConnectService;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import com.stripe.model.Account;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * Stripe Connect capability tracking.
 *
 * <p>Scoped to the half of {@link StripeConnectService} that holds decisions
 * rather than plumbing. The account/account-link creation calls are a thin
 * wrapper over the Stripe SDK and need a live test-mode key to say anything;
 * what actually governs behaviour is how a connected account's capabilities
 * are mirrored onto the tenant, and that runs entirely on our side of the
 * wire — {@code applyAccountUpdate} takes an {@link Account} that Stripe
 * handed us, which a test can hand it just as well.
 *
 * <p>This is also the gate {@code PaymentService} consults before it will
 * create a charge at all, so getting the mirror wrong either locks a fully
 * onboarded photographer out of card payments or offers card payments on an
 * account that cannot accept them.
 */
class StripeConnectServiceIT extends IntegrationTestBase {

    @Autowired private StripeConnectService connectService;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private UserRepository userRepository;

    @Test
    void accountUpdateMirrorsCapabilitiesOntoTheTenantItBelongsTo() {
        String accountId = "acct_" + UUID.randomUUID().toString().substring(0, 12);
        UUID tenantId = tenantWithStripeAccount(accountId);

        connectService.applyAccountUpdate(account(accountId, true, true, true));

        Tenant tenant = tenantRepository.findById(tenantId).orElseThrow();
        assertThat(tenant.isStripeChargesEnabled()).isTrue();
        assertThat(tenant.isStripePayoutsEnabled()).isTrue();
        assertThat(tenant.isStripeDetailsSubmitted()).isTrue();
        assertThat(tenant.canAcceptStripePayments()).isTrue();
    }

    /**
     * Onboarding is a thing that happened, not a thing that is currently true.
     * Stripe can revoke {@code charges_enabled} later — pending
     * re-verification, an expired document — and that must not rewrite history
     * by clearing the timestamp, or the settings screen tells a photographer
     * who onboarded months ago that they never started.
     */
    @Test
    void theOnboardingTimestampIsStampedOnceAndSurvivesACapabilityLapse() {
        String accountId = "acct_" + UUID.randomUUID().toString().substring(0, 12);
        UUID tenantId = tenantWithStripeAccount(accountId);

        connectService.applyAccountUpdate(account(accountId, true, true, true));
        OffsetDateTime firstOnboarded =
            tenantRepository.findById(tenantId).orElseThrow().getStripeOnboardedAt();
        assertThat(firstOnboarded).isNotNull();

        // Stripe suspends charges, then restores them.
        connectService.applyAccountUpdate(account(accountId, false, true, true));
        Tenant lapsed = tenantRepository.findById(tenantId).orElseThrow();
        assertThat(lapsed.isStripeChargesEnabled()).isFalse();
        assertThat(lapsed.canAcceptStripePayments()).isFalse();
        assertThat(lapsed.getStripeOnboardedAt()).isEqualTo(firstOnboarded);

        connectService.applyAccountUpdate(account(accountId, true, true, true));
        assertThat(tenantRepository.findById(tenantId).orElseThrow().getStripeOnboardedAt())
            .isEqualTo(firstOnboarded);
    }

    /**
     * The platform's own account emits {@code account.updated} too, as would
     * any connected account created outside this app. Neither is an error —
     * the webhook has to tolerate accounts it doesn't recognise, because it
     * cannot choose which ones Stripe sends it.
     */
    @Test
    void anAccountWeDoNotRecogniseIsIgnoredRatherThanFailing() {
        assertThatCode(() -> connectService.applyAccountUpdate(
            account("acct_neverSeenBefore", true, true, true)))
            .doesNotThrowAnyException();
    }

    @Test
    void aNullAccountIsIgnored() {
        assertThatCode(() -> connectService.applyAccountUpdate(null)).doesNotThrowAnyException();
    }

    /**
     * The commission the status endpoint reports is the one the charge will
     * actually carry, per PRICING.md §4 — "0% commission" is literally what Pro
     * is sold on, so a settings screen quoting 2% to a Pro subscriber is a
     * billing dispute waiting to happen.
     */
    @Test
    void statusReportsThePlansOwnCommission() {
        assertThat(statusForPlan("STARTER").commissionBps()).isEqualTo(200);
        assertThat(statusForPlan("PRO").commissionBps()).isZero();
        assertThat(statusForPlan("STUDIO").commissionBps()).isZero();
    }

    /** An unconnected tenant reports "not connected" rather than failing. */
    @Test
    void statusOfATenantThatHasNeverStartedOnboarding() {
        StripeConnectStatusResponse status = statusForPlan("STARTER");

        assertThat(status.accountId()).isNull();
        assertThat(status.chargesEnabled()).isFalse();
        assertThat(status.detailsSubmitted()).isFalse();
        assertThat(status.onboardedAt()).isNull();
        // No secret key is configured in the test context, so the deployment
        // itself has no Stripe — the frontend uses this to hide the whole
        // Connect section rather than offer a button that cannot work.
        assertThat(status.platformConfigured()).isFalse();
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private static Account account(String id, boolean charges, boolean payouts, boolean details) {
        Account account = new Account();
        account.setId(id);
        account.setChargesEnabled(charges);
        account.setPayoutsEnabled(payouts);
        account.setDetailsSubmitted(details);
        return account;
    }

    private UUID tenantWithStripeAccount(String accountId) {
        Tenant tenant = newTenant();
        tenant.setStripeAccountId(accountId);
        return tenantRepository.save(tenant).getId();
    }

    private Tenant newTenant() {
        return new Tenant(
            "connect-test-" + UUID.randomUUID(),
            "connect-" + UUID.randomUUID() + "@example.test");
    }

    private StripeConnectStatusResponse statusForPlan(String plan) {
        Tenant tenant = newTenant();
        tenant.setPlan(plan);
        UUID tenantId = tenantRepository.save(tenant).getId();
        UUID userId = asTenant(tenantId, () -> userRepository.save(
            new User(tenantId, "u-" + UUID.randomUUID() + "@example.test", "hash", "Anna")).getId());

        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(userId.toString(), null));
        TenantContext.setTenant(tenantId.toString());
        try {
            return connectService.getStatus();
        } finally {
            SecurityContextHolder.clearContext();
            TenantContext.clear();
        }
    }

    private <T> T asTenant(UUID tenantId, java.util.function.Supplier<T> action) {
        TenantContext.setTenant(tenantId.toString());
        try {
            return action.get();
        } finally {
            TenantContext.clear();
        }
    }
}
