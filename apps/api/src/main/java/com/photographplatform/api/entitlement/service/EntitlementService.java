package com.photographplatform.api.entitlement.service;

import com.photographplatform.api.common.exception.AccountReadOnlyException;
import com.photographplatform.api.common.exception.PlanUpgradeRequiredException;
import com.photographplatform.api.common.exception.UnauthorizedException;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.entitlement.config.EntitlementProperties;
import com.photographplatform.api.entitlement.domain.Capability;
import com.photographplatform.api.entitlement.domain.Entitlements;
import com.photographplatform.api.entitlement.domain.TenantAccess;
import com.photographplatform.api.payment.config.PaymentProperties;
import com.photographplatform.api.tenant.domain.Plan;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.EnumMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The one place that answers "may this tenant do this?".
 *
 * <p>PRICING.md §6.3 asks for exactly one plan → capabilities map, read by both
 * API and UI, "without which every gate becomes an ad-hoc
 * {@code if (plan === 'PRO')} scattered across the codebase". This is it: the
 * API gates through {@link #requireCapability}, and the frontend reads the same
 * resolved object from {@code GET /api/entitlements} so the two can never
 * disagree about what a tier includes.
 *
 * <p>Enforcement is server-side by construction — §6 closes with "a UI-only
 * gate is a suggestion, not a limit", and with a commission in play the stakes
 * are money rather than a locked screen.
 */
@Service
public class EntitlementService {

    private final EntitlementProperties properties;
    private final PaymentProperties paymentProperties;
    private final TenantRepository tenantRepository;
    private final Clock clock;

    /**
     * Entitlements are a pure function of configuration, so they are resolved
     * once at startup rather than rebuilt per request. Deliberately only the
     * plan half is cached: writability depends on the clock and on payment
     * state, and caching that is what lets an expired trial keep writing.
     */
    private final Map<Plan, Entitlements> byPlan = new EnumMap<>(Plan.class);

    public EntitlementService(
        EntitlementProperties properties,
        PaymentProperties paymentProperties,
        TenantRepository tenantRepository,
        Clock clock) {
        this.properties = properties;
        this.paymentProperties = paymentProperties;
        this.tenantRepository = tenantRepository;
        this.clock = clock;
        resolveAll();
    }

    /**
     * Resolved in the constructor rather than a lifecycle callback, so the
     * service is never observable in a half-built state and a unit test can
     * construct one without running Spring.
     *
     * <p>Safe with respect to ordering: {@code EntitlementProperties} is a
     * {@code @ConfigurationProperties} bean, so its own {@code @PostConstruct}
     * validation has already run by the time it is injected here.
     */
    private void resolveAll() {
        for (Plan plan : Plan.values()) {
            EntitlementProperties.PlanConfig config = properties.forPlan(plan);
            byPlan.put(plan, new Entitlements(
                plan,
                config.getCapabilities(),
                config.getGalleryRetentionDays(),
                config.getSeats(),
                // The rate stays configured under app.stripe.commission (it is
                // validated and documented there), but it is an entitlement in
                // every other sense — PRICING.md §6.3 is explicit that "the
                // commission means the rate is an entitlement too". Folding it
                // in here means feature code reads one object.
                paymentProperties.getCommission().bpsForPlan(plan.name()),
                config.fairUseStorageBytes()));
        }
    }

    public Entitlements forPlan(Plan plan) {
        Entitlements resolved = byPlan.get(plan);
        if (resolved == null) {
            // Unreachable in practice — EntitlementProperties#validate refuses
            // to boot with a missing tier — but resolving to the least
            // entitled tier beats a NullPointerException at a gate.
            return byPlan.get(Plan.STARTER);
        }
        return resolved;
    }

    public Entitlements forTenant(Tenant tenant) {
        return forPlan(tenant.plan());
    }

    /**
     * The tenant's entitlements plus whether they may write right now.
     *
     * <p>Writes stop when the account is suspended/cancelled, or when the trial
     * has run out and no subscription took over. Reads never stop: a delivered
     * gallery keeps working for the couple holding the link, who are not party
     * to the photographer's billing and would otherwise find their wedding
     * photos gone over someone else's expired card (PRICING.md §7.7).
     */
    public TenantAccess accessFor(Tenant tenant) {
        Entitlements entitlements = forTenant(tenant);
        OffsetDateTime now = OffsetDateTime.now(clock);

        String lockReason = null;
        if (!"ACTIVE".equalsIgnoreCase(tenant.getStatus())) {
            lockReason = "This account is not active. Contact support to restore access.";
        } else if (tenant.getTrialEndsAt() == null) {
            // No deadline was ever recorded, so there is no deadline to have
            // missed. Registration always stamps one and V20 backfilled every
            // existing row, so this is the "created some other way" case —
            // and locking an account out on a date we never set, never showed
            // them, and cannot cite is indefensible. The lock fails open on
            // purpose: a few days of unbilled service is a far cheaper mistake
            // than shutting a working studio out of its own bookings.
            lockReason = null;
        } else if (!tenant.hasActiveSubscription() && !tenant.isTrialActive(now)) {
            lockReason = "Your trial has ended. Choose a plan to continue creating "
                + "bookings, galleries and invoices. Everything you already have stays available.";
        }

        return new TenantAccess(
            entitlements,
            lockReason == null,
            lockReason,
            tenant.getTrialEndsAt(),
            tenant.getSubscriptionStatus());
    }

    @Transactional(readOnly = true)
    public TenantAccess accessForCurrentTenant() {
        return accessFor(loadCurrentTenant());
    }

    /**
     * Gate for a plan-gated feature. Throws rather than returning a boolean so
     * a caller cannot forget to check the result — the failure mode of a
     * boolean gate is silently granting access.
     */
    public void requireCapability(Tenant tenant, Capability capability) {
        if (!forTenant(tenant).has(capability)) {
            throw new PlanUpgradeRequiredException(capability, cheapestPlanWith(capability));
        }
    }

    @Transactional(readOnly = true)
    public void requireCapabilityForCurrentTenant(Capability capability) {
        requireCapability(loadCurrentTenant(), capability);
    }

    /** Gate for any state-changing operation. */
    public void requireWritable(Tenant tenant) {
        TenantAccess access = accessFor(tenant);
        if (!access.writable()) {
            throw new AccountReadOnlyException(access.lockReason());
        }
    }

    @Transactional(readOnly = true)
    public void requireWritableCurrentTenant() {
        requireWritable(loadCurrentTenant());
    }

    /**
     * The cheapest tier that includes {@code capability}, so an upgrade prompt
     * can name a plan instead of saying "upgrade" into the void. Falls back to
     * the top tier for a capability no tier grants — a misconfiguration, but
     * one that should read as "not available on your plan" rather than crash.
     */
    public Plan cheapestPlanWith(Capability capability) {
        for (Plan plan : Plan.values()) {
            if (forPlan(plan).has(capability)) {
                return plan;
            }
        }
        return Plan.STUDIO;
    }

    private Tenant loadCurrentTenant() {
        UUID tenantId = SecurityUtils.requireCurrentTenantId();
        return tenantRepository.findById(tenantId)
            .orElseThrow(() -> new UnauthorizedException("Authentication required"));
    }
}
