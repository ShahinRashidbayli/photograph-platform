package com.photographplatform.api.entitlement;

import com.photographplatform.api.common.exception.AccountReadOnlyException;
import com.photographplatform.api.common.exception.PlanUpgradeRequiredException;
import com.photographplatform.api.entitlement.config.EntitlementProperties;
import com.photographplatform.api.entitlement.domain.Capability;
import com.photographplatform.api.entitlement.domain.TenantAccess;
import com.photographplatform.api.entitlement.service.EntitlementService;
import com.photographplatform.api.payment.config.PaymentProperties;
import com.photographplatform.api.tenant.domain.Plan;
import com.photographplatform.api.tenant.domain.SubscriptionStatus;
import com.photographplatform.api.tenant.domain.Tenant;
import java.io.InputStream;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.yaml.snakeyaml.Yaml;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The plan → capabilities layer PRICING.md §6.3 asks for, and the read-only
 * lock an expired trial leaves behind (§7.7).
 *
 * <p>Both failure modes here are expensive in opposite directions: a gate that
 * wrongly grants gives away a tier, and a lock that wrongly engages stops a
 * paying photographer mid-season. So the tests lean on the boundaries — the
 * exact expiry instant, the statuses that do and do not count as paid, and
 * what an unreadable plan degrades to.
 */
class EntitlementServiceTest {

    private static final OffsetDateTime NOW =
        OffsetDateTime.of(2026, 8, 22, 12, 0, 0, 0, ZoneOffset.UTC);

    private EntitlementService service;

    @BeforeEach
    void setUp() {
        service = newService();
    }

    private EntitlementService newService() {
        EntitlementProperties props = new EntitlementProperties();
        props.setTiers(new java.util.EnumMap<>(java.util.Map.of(
            Plan.STARTER, tier(60, 1, 50, EnumSet.noneOf(Capability.class)),
            Plan.PRO, tier(365, 1, 250, EnumSet.of(Capability.INSTAGRAM_AUTOMATION, Capability.CONTRACTS)),
            Plan.STUDIO, tier(730, 3, 1024, EnumSet.allOf(Capability.class)))));
        props.validate();

        return new EntitlementService(
            props, new PaymentProperties(), null, Clock.fixed(NOW.toInstant(), ZoneOffset.UTC));
    }

    private EntitlementProperties.PlanConfig tier(int days, int seats, int gb, EnumSet<Capability> caps) {
        EntitlementProperties.PlanConfig config = new EntitlementProperties.PlanConfig();
        config.setGalleryRetentionDays(days);
        config.setSeats(seats);
        config.setFairUseStorageGb(gb);
        config.setCapabilities(caps);
        return config;
    }

    private Tenant tenantOn(Plan plan) {
        Tenant tenant = new Tenant("anna-foto", "anna@example.de");
        tenant.setPlan(plan);
        // Mid-trial by default, so tests that are not about the lock are not
        // silently testing the lock.
        tenant.setTrialEndsAt(NOW.plusDays(7));
        return tenant;
    }

    // ── the table itself ────────────────────────────────────────────────

    @Test
    void retentionWindowsMatchTheAdrDecision() {
        // ADR-001 §2 — the numbers the landing page sells.
        assertThat(service.forPlan(Plan.STARTER).galleryRetentionDays()).isEqualTo(60);
        assertThat(service.forPlan(Plan.PRO).galleryRetentionDays()).isEqualTo(365);
        assertThat(service.forPlan(Plan.STUDIO).galleryRetentionDays()).isEqualTo(730);
    }

    @Test
    void commissionIsFoldedInFromThePaymentConfig() {
        // PRICING.md §6.3: "the commission means the rate is an entitlement
        // too". Callers must not have to know it is configured elsewhere.
        assertThat(service.forPlan(Plan.STARTER).commissionBps()).isEqualTo(200);
        assertThat(service.forPlan(Plan.STARTER).chargesCommission()).isTrue();
        assertThat(service.forPlan(Plan.PRO).commissionBps()).isZero();
        assertThat(service.forPlan(Plan.PRO).chargesCommission()).isFalse();
    }

    @Test
    void starterHasNoGatedFeatures() {
        assertThat(service.forPlan(Plan.STARTER).capabilities()).isEmpty();
    }

    @Test
    void studioSeatsThree() {
        assertThat(service.forPlan(Plan.STUDIO).seats()).isEqualTo(3);
        assertThat(service.forPlan(Plan.STARTER).seats()).isEqualTo(1);
    }

    /**
     * The record defensively copies its capability set. Without it, one caller
     * mutating the set it passed in would rewrite entitlements for every
     * tenant on that tier, since the resolved object is shared.
     */
    @Test
    void resolvedCapabilitiesCannotBeMutatedByCallers() {
        assertThatThrownBy(() -> service.forPlan(Plan.PRO).capabilities().add(Capability.ANALYTICS))
            .isInstanceOf(UnsupportedOperationException.class);
    }

    // ── gates ───────────────────────────────────────────────────────────

    @Test
    void gateNamesTheCheapestPlanThatWouldUnlockTheFeature() {
        assertThatThrownBy(() ->
            service.requireCapability(tenantOn(Plan.STARTER), Capability.CONTRACTS))
            .isInstanceOf(PlanUpgradeRequiredException.class)
            .satisfies(ex -> {
                PlanUpgradeRequiredException upgrade = (PlanUpgradeRequiredException) ex;
                // Contracts exist on Pro AND Studio — the prompt must offer the
                // cheaper one, or it reads as an upsell rather than an answer.
                assertThat(upgrade.getRequiredPlan()).isEqualTo(Plan.PRO.name());
                assertThat(upgrade.getCapability()).isEqualTo(Capability.CONTRACTS.name());
            });
    }

    @Test
    void gatePassesForATierThatIncludesTheFeature() {
        assertThatCode(() -> service.requireCapability(tenantOn(Plan.PRO), Capability.CONTRACTS))
            .doesNotThrowAnyException();
        assertThatCode(() -> service.requireCapability(tenantOn(Plan.STUDIO), Capability.ANALYTICS))
            .doesNotThrowAnyException();
    }

    @Test
    void analyticsIsStudioOnly() {
        assertThat(service.cheapestPlanWith(Capability.ANALYTICS)).isEqualTo(Plan.STUDIO);
        assertThatThrownBy(() -> service.requireCapability(tenantOn(Plan.PRO), Capability.ANALYTICS))
            .isInstanceOf(PlanUpgradeRequiredException.class);
    }

    /**
     * An unreadable plan string must degrade to the LEAST entitled tier. The
     * opposite default would mean a typo in the column hands out Studio, and
     * nothing would ever surface it.
     */
    @Test
    void unknownPlanDegradesToStarter() {
        Tenant tenant = tenantOn(Plan.PRO);
        tenant.setPlan("ENTERPRISE");
        assertThat(service.forTenant(tenant).plan()).isEqualTo(Plan.STARTER);
        assertThatThrownBy(() -> service.requireCapability(tenant, Capability.CONTRACTS))
            .isInstanceOf(PlanUpgradeRequiredException.class);
    }

    // ── the read-only lock ──────────────────────────────────────────────

    @Test
    void insideTheTrialTheTenantCanWrite() {
        TenantAccess access = service.accessFor(tenantOn(Plan.STARTER));
        assertThat(access.writable()).isTrue();
        assertThat(access.lockReason()).isNull();
    }

    @Test
    void anExpiredTrialWithNoSubscriptionLocksWrites() {
        Tenant tenant = tenantOn(Plan.PRO);
        tenant.setTrialEndsAt(NOW.minusSeconds(1));

        TenantAccess access = service.accessFor(tenant);
        assertThat(access.writable()).isFalse();
        assertThat(access.lockReason()).contains("trial has ended");
        assertThatThrownBy(() -> service.requireWritable(tenant))
            .isInstanceOf(AccountReadOnlyException.class);
    }

    /**
     * The boundary itself. {@code isTrialActive} is strictly "after now", so
     * the instant the trial ends is already locked — an off-by-one here either
     * gives a free day or cuts one short, and the second is the one a customer
     * complains about.
     */
    @Test
    void theTrialEndsExactlyAtItsDeadline() {
        Tenant tenant = tenantOn(Plan.STARTER);
        tenant.setTrialEndsAt(NOW);
        assertThat(service.accessFor(tenant).writable()).isFalse();

        tenant.setTrialEndsAt(NOW.plusNanos(1_000_000));
        assertThat(service.accessFor(tenant).writable()).isTrue();
    }

    @Test
    void anActiveSubscriptionOutlivesTheTrial() {
        Tenant tenant = tenantOn(Plan.PRO);
        tenant.setTrialEndsAt(NOW.minusMonths(6));
        tenant.applySubscription("sub_123", SubscriptionStatus.ACTIVE, NOW.plusDays(20));

        assertThat(service.accessFor(tenant).writable()).isTrue();
    }

    /**
     * A declined card is usually an expired card. Stripe is still retrying, so
     * locking the photographer out now would cost far more goodwill than the
     * few days of service costs us — see SubscriptionStatus#PAST_DUE.
     */
    @Test
    void pastDueStillWritesWhileStripeRetries() {
        Tenant tenant = tenantOn(Plan.PRO);
        tenant.setTrialEndsAt(NOW.minusMonths(6));
        tenant.applySubscription("sub_123", SubscriptionStatus.PAST_DUE, NOW.minusDays(2));

        assertThat(service.accessFor(tenant).writable()).isTrue();
    }

    @Test
    void statusesStripeHasGivenUpOnDoLock() {
        for (SubscriptionStatus dead : EnumSet.of(
            SubscriptionStatus.CANCELED, SubscriptionStatus.UNPAID,
            SubscriptionStatus.INCOMPLETE, SubscriptionStatus.NONE)) {

            Tenant tenant = tenantOn(Plan.PRO);
            tenant.setTrialEndsAt(NOW.minusMonths(6));
            tenant.applySubscription("sub_123", dead, NOW.minusDays(2));

            assertThat(service.accessFor(tenant).writable())
                .as("subscription status %s must not grant writes", dead)
                .isFalse();
        }
    }

    /**
     * A tenant whose row carries no trial deadline is not locked. Registration
     * always stamps one and V20 backfilled the rest, so this is the "created
     * some other way" case — and locking someone out on a deadline we never
     * set, never showed them and cannot cite would be indefensible. The lock
     * fails open here deliberately.
     */
    @Test
    void aTenantWithNoRecordedDeadlineIsNotLocked() {
        Tenant tenant = tenantOn(Plan.STARTER);
        tenant.setTrialEndsAt(null);

        TenantAccess access = service.accessFor(tenant);
        assertThat(access.writable()).isTrue();
        assertThat(access.lockReason()).isNull();
    }

    /**
     * But a suspension still locks: that is an explicit administrative act, not
     * an inferred deadline.
     */
    @Test
    void suspensionLocksEvenWithoutADeadline() {
        Tenant tenant = tenantOn(Plan.STARTER);
        tenant.setTrialEndsAt(null);
        tenant.setStatus("SUSPENDED");

        assertThat(service.accessFor(tenant).writable()).isFalse();
    }

    @Test
    void aSuspendedAccountLocksEvenMidTrial() {
        Tenant tenant = tenantOn(Plan.STUDIO);
        tenant.setStatus("SUSPENDED");

        TenantAccess access = service.accessFor(tenant);
        assertThat(access.writable()).isFalse();
        assertThat(access.lockReason()).contains("not active");
    }

    /**
     * The lock stops writes, never reads — a couple holding a delivered gallery
     * link are not party to the photographer's billing, and finding their
     * wedding photos gone over someone else's expired card is the outcome the
     * read-only choice exists to prevent (PRICING.md §7.7).
     */
    @Test
    void aLockedTenantKeepsItsPlanEntitlements() {
        Tenant tenant = tenantOn(Plan.STUDIO);
        tenant.setTrialEndsAt(NOW.minusDays(1));

        TenantAccess access = service.accessFor(tenant);
        assertThat(access.writable()).isFalse();
        assertThat(access.has(Capability.ANALYTICS)).isTrue();
        assertThat(access.entitlements().galleryRetentionDays()).isEqualTo(730);
    }

    // ── configuration guards ────────────────────────────────────────────

    @Test
    void bootFailsWhenATierIsMissing() {
        EntitlementProperties props = new EntitlementProperties();
        props.setTiers(new java.util.EnumMap<>(java.util.Map.of(
            Plan.STARTER, tier(60, 1, 50, EnumSet.noneOf(Capability.class)))));

        assertThatThrownBy(props::validate)
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("pro");
    }

    /**
     * A zero-day window would expire every gallery the moment it is delivered.
     * Given the job on the other end deletes a client's wedding photos, this
     * must fail at boot rather than at 03:00 on a schedule.
     */
    @Test
    void bootFailsOnANonPositiveRetentionWindow() {
        EntitlementProperties props = new EntitlementProperties();
        props.setTiers(new java.util.EnumMap<>(java.util.Map.of(
            Plan.STARTER, tier(0, 1, 50, EnumSet.noneOf(Capability.class)),
            Plan.PRO, tier(365, 1, 250, EnumSet.noneOf(Capability.class)),
            Plan.STUDIO, tier(730, 3, 1024, EnumSet.noneOf(Capability.class)))));

        assertThatThrownBy(props::validate)
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("gallery-retention-days");
    }

    /**
     * The guard that keeps {@link Capability} meaning one thing.
     *
     * <p>A value no tier grants is not plan-gated, and the likely reason it got
     * here is that someone needed somewhere to put "this studio also rents out
     * its space" — a tenant offering, which is declared rather than bought
     * (ADR-003 §5). Caught at boot rather than in review, because the cost of
     * missing it is that {@code GET /api/entitlements} quietly starts answering
     * two different questions.
     */
    @Test
    void bootFailsWhenACapabilityIsGrantedByNoTier() {
        EntitlementProperties props = new EntitlementProperties();
        props.setTiers(new java.util.EnumMap<>(java.util.Map.of(
            Plan.STARTER, tier(60, 1, 50, EnumSet.noneOf(Capability.class)),
            Plan.PRO, tier(365, 1, 250, EnumSet.of(Capability.CONTRACTS)),
            Plan.STUDIO, tier(730, 3, 1024, EnumSet.of(Capability.CONTRACTS)))));

        assertThatThrownBy(props::validate)
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("ANALYTICS")
            .hasMessageContaining("offering");
    }

    /**
     * The same guard, run against the table that actually ships.
     *
     * <p>The check above proves {@code validate()} catches it; this proves the
     * shipped {@code application.yml} passes it. Worth its own test because
     * {@code validate()} only runs at boot: without this, adding a
     * {@code Capability} and forgetting the yml is green locally and fails on
     * deploy instead of in {@code mvn test}.
     */
    @Test
    @SuppressWarnings("unchecked")
    void everyCapabilityInTheShippedTableIsGranted() throws Exception {
        Map<String, Object> yaml;
        try (InputStream in = getClass().getResourceAsStream("/application.yml")) {
            assertThat(in).as("application.yml on the test classpath").isNotNull();
            yaml = new Yaml().load(in);
        }
        Map<String, Object> tiers = (Map<String, Object>)
            ((Map<String, Object>) ((Map<String, Object>) yaml.get("app")).get("plans")).get("tiers");

        Set<String> granted = new java.util.HashSet<>();
        for (Object tier : tiers.values()) {
            Object capabilities = ((Map<String, Object>) tier).get("capabilities");
            if (capabilities instanceof java.util.List<?> list) {
                list.forEach(c -> granted.add(String.valueOf(c)));
            }
        }

        assertThat(granted)
            .as("app.plans.tiers.*.capabilities in application.yml")
            .containsAll(EnumSet.allOf(Capability.class).stream().map(Enum::name).toList());
    }

    @Test
    void fairUseCapConvertsToBytes() {
        assertThat(service.forPlan(Plan.STARTER).fairUseStorageBytes())
            .isEqualTo(50L * 1024 * 1024 * 1024);
    }
}
