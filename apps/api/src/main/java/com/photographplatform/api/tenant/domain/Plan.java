package com.photographplatform.api.tenant.domain;

import java.util.Locale;

/**
 * The three subscription tiers, as decided in {@code docs/PRICING.md} §3.
 *
 * <p>{@code tenants.plan} is a {@code VARCHAR(20)} with a CHECK constraint
 * listing exactly these names, and {@link Tenant} stores it as a String so the
 * column round-trips unchanged. This enum is the typed face of that column:
 * every branch on a plan goes through {@link #from(String)} rather than
 * comparing string literals, which is what PRICING.md §6.3 means by "one place
 * that maps plan to capabilities".
 *
 * <p>Note this enum deliberately carries no capabilities of its own. What a
 * plan *grants* lives in {@code EntitlementProperties} so it stays
 * configuration — the tiers are still a DRAFT (PRICING.md header) and a
 * retention window or seat count must be adjustable without a recompile.
 */
public enum Plan {

    STARTER,
    PRO,
    STUDIO;

    /**
     * Parses a stored plan name, falling back to {@link #STARTER}.
     *
     * <p>The fallback is never "free" and never the most generous tier: an
     * unreadable plan must degrade to the *least* entitled state, or a typo in
     * the column silently hands out Studio. It mirrors
     * {@code PaymentProperties.Commission#bpsForPlan}, which already falls back
     * to the Starter rate for the same reason — an unknown plan that billed 0%
     * would give away the commission.
     */
    public static Plan from(String raw) {
        if (raw == null) {
            return STARTER;
        }
        try {
            return valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException unknownPlan) {
            return STARTER;
        }
    }

    /** True when this tier includes everything {@code other} grants. */
    public boolean atLeast(Plan other) {
        return ordinal() >= other.ordinal();
    }
}
