package com.photographplatform.api.entitlement.domain;

import com.photographplatform.api.tenant.domain.Plan;
import java.util.Collections;
import java.util.EnumSet;
import java.util.Set;

/**
 * What one plan grants — the resolved capability set behind PRICING.md §6.3.
 *
 * <p>This is the single object every gate reads. Before it existed the only
 * branch on a plan anywhere was the commission rate, and PRICING.md warned
 * that without a layer like this "every gate becomes an ad-hoc
 * {@code if (plan === 'PRO')} scattered across the codebase". So feature code
 * must ask this record, never {@code tenant.getPlan()}.
 *
 * <p>Immutable and free of Spring: it is a pure projection of configuration
 * for a plan, which keeps it trivially unit-testable and safe to cache.
 *
 * @param plan                 the tier this was resolved from
 * @param capabilities         on/off features this tier includes
 * @param galleryRetentionDays how long a delivered gallery stays online
 *                             (ADR-001 §2 — 60 / 365 / 730)
 * @param seats                how many photographer logins the tenant may have
 * @param commissionBps        platform cut of collected payments, basis points
 * @param fairUseStorageBytes  unadvertised abuse guard (PRICING.md §7.3)
 */
public record Entitlements(
    Plan plan,
    Set<Capability> capabilities,
    int galleryRetentionDays,
    int seats,
    int commissionBps,
    long fairUseStorageBytes) {

    public Entitlements {
        // Defensive copy into an EnumSet: the record is handed to request
        // threads and cached per plan, so a caller mutating the set it passed
        // in would rewrite entitlements for every tenant on that tier.
        capabilities = capabilities == null || capabilities.isEmpty()
            ? Collections.unmodifiableSet(EnumSet.noneOf(Capability.class))
            : Collections.unmodifiableSet(EnumSet.copyOf(capabilities));
    }

    public boolean has(Capability capability) {
        return capabilities.contains(capability);
    }

    /**
     * True when the platform takes a cut of this tenant's collected payments.
     *
     * <p>"0% commission" is exactly what Pro sells (PRICING.md §4), so this
     * reads as a product fact rather than an arithmetic detail.
     */
    public boolean chargesCommission() {
        return commissionBps > 0;
    }
}
