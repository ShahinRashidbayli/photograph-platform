package com.photographplatform.api.entitlement.dto;

import com.photographplatform.api.entitlement.domain.Capability;
import com.photographplatform.api.entitlement.domain.TenantAccess;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * What the frontend needs to gate its own UI — the same resolved object the
 * API gates on, so the two cannot disagree about what a tier includes.
 *
 * <p>The UI gate is a courtesy, not the enforcement (PRICING.md §6: "a UI-only
 * gate is a suggestion, not a limit"). It exists so a Starter photographer sees
 * "Contracts — included in Pro" instead of a menu item that 402s on click.
 *
 * @param capabilities capability names the tenant has, as strings the frontend
 *                     matches on; see {@link Capability} for why they are
 *                     effectively a stable API contract
 */
public record EntitlementsResponse(
    String plan,
    List<String> capabilities,
    int galleryRetentionDays,
    int seats,
    int commissionBps,
    boolean writable,
    String lockReason,
    OffsetDateTime trialEndsAt,
    String subscriptionStatus) {

    public static EntitlementsResponse from(TenantAccess access) {
        return new EntitlementsResponse(
            access.entitlements().plan().name(),
            access.entitlements().capabilities().stream().map(Capability::name).sorted().toList(),
            access.entitlements().galleryRetentionDays(),
            access.entitlements().seats(),
            access.entitlements().commissionBps(),
            access.writable(),
            access.lockReason(),
            access.trialEndsAt(),
            access.subscriptionStatus().name());
    }
}
