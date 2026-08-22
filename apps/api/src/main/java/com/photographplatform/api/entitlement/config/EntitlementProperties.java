package com.photographplatform.api.entitlement.config;

import com.photographplatform.api.entitlement.domain.Capability;
import com.photographplatform.api.tenant.domain.Plan;
import jakarta.annotation.PostConstruct;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * The plan → capabilities table, as configuration.
 *
 * <p>PRICING.md is explicit that its tiers are still a DRAFT and that "every
 * number and every feature placement below" is a proposal to argue with. A
 * retention window or a seat count therefore has to be changeable without a
 * recompile — hence properties rather than constants on {@link Plan}.
 *
 * <p>Deliberately NOT the home of the commission rate. That already lives at
 * {@code app.stripe.commission.*}, is validated by {@code PaymentProperties},
 * and is documented in {@code infra/.env.example} and the deploy guide; moving
 * it would break a documented deployment key to gain nothing. {@code
 * EntitlementService} folds it into {@link
 * com.photographplatform.api.entitlement.domain.Entitlements} so feature code
 * still reads one object, which is what PRICING.md §6.3 actually asks for.
 */
@Component
@ConfigurationProperties(prefix = "app.plans")
public class EntitlementProperties {

    private Map<Plan, PlanConfig> tiers = new EnumMap<>(Plan.class);

    public Map<Plan, PlanConfig> getTiers() {
        return tiers;
    }

    public void setTiers(Map<Plan, PlanConfig> tiers) {
        this.tiers = tiers;
    }

    public PlanConfig forPlan(Plan plan) {
        PlanConfig config = tiers.get(plan);
        if (config == null) {
            throw new IllegalStateException(
                "No entitlements configured for plan " + plan + ". app.plans.tiers must list every plan "
                    + "in the tenants.plan CHECK constraint — see PRICING.md §3.");
        }
        return config;
    }

    /**
     * Refuses to start unless all three tiers are configured.
     *
     * <p>Same fail-fast reasoning as {@code EmailProperties} and {@code
     * PaymentProperties}: a missing tier is invisible until the first tenant on
     * it hits a gate, and then it fails as a 500 on a customer's request rather
     * than at boot on ours. A half-configured entitlement table is also the one
     * failure mode that can silently *grant* access, so it must never boot.
     */
    @PostConstruct
    public void validate() {
        for (Plan plan : Plan.values()) {
            PlanConfig config = tiers.get(plan);
            if (config == null) {
                throw new IllegalStateException(
                    "app.plans.tiers is missing '" + plan.name().toLowerCase() + "'. Every plan in the "
                        + "tenants.plan CHECK constraint needs an entitlement row, or tenants on that "
                        + "plan fail at their first gate instead of at boot.");
            }
            if (config.getGalleryRetentionDays() <= 0) {
                throw new IllegalStateException(
                    "app.plans.tiers." + plan.name().toLowerCase() + ".gallery-retention-days must be "
                        + "positive — a zero or negative window would expire galleries the moment they "
                        + "are delivered (ADR-001 §2).");
            }
            if (config.getSeats() <= 0) {
                throw new IllegalStateException(
                    "app.plans.tiers." + plan.name().toLowerCase() + ".seats must be at least 1 — the "
                        + "owner's own login occupies a seat.");
            }
        }
    }

    /** One tier's row in the table. */
    public static class PlanConfig {

        /**
         * How long a delivered gallery stays online (ADR-001 §2). Measured
         * from delivery, and written onto the gallery at that moment rather
         * than computed at read time — see ADR-001 §4, "set expires_at on
         * write": resolving it lazily would make a plan change silently
         * rewrite the retention of galleries already delivered.
         */
        private int galleryRetentionDays = 60;

        /** Photographer logins allowed, owner included. Studio sells 3. */
        private int seats = 1;

        /**
         * Unadvertised fair-use cap (PRICING.md §7.3), in gigabytes. Sized
         * well above each tier's realistic peak — ADR-001 §1 measures a
         * full-time wedding photographer at ~29 GB inside a 60-day window —
         * so it never binds an honest user and only ever catches abuse.
         */
        private int fairUseStorageGb = 50;

        private Set<Capability> capabilities = EnumSet.noneOf(Capability.class);

        public int getGalleryRetentionDays() {
            return galleryRetentionDays;
        }

        public void setGalleryRetentionDays(int galleryRetentionDays) {
            this.galleryRetentionDays = galleryRetentionDays;
        }

        public int getSeats() {
            return seats;
        }

        public void setSeats(int seats) {
            this.seats = seats;
        }

        public int getFairUseStorageGb() {
            return fairUseStorageGb;
        }

        public void setFairUseStorageGb(int fairUseStorageGb) {
            this.fairUseStorageGb = fairUseStorageGb;
        }

        public Set<Capability> getCapabilities() {
            return capabilities;
        }

        public void setCapabilities(Set<Capability> capabilities) {
            this.capabilities = capabilities == null
                ? EnumSet.noneOf(Capability.class)
                : EnumSet.copyOf(capabilities);
        }

        public long fairUseStorageBytes() {
            return (long) fairUseStorageGb * 1024L * 1024L * 1024L;
        }
    }
}
