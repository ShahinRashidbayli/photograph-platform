package com.photographplatform.api.entitlement.domain;

import com.photographplatform.api.tenant.domain.SubscriptionStatus;
import java.time.OffsetDateTime;

/**
 * What a specific tenant may do right now: their plan's {@link Entitlements}
 * plus whether writes are currently allowed at all.
 *
 * <p>The two are separate questions and are kept separate here. Entitlements
 * are a pure function of the plan and never change between requests;
 * writability is a function of *time* (trial expiry) and payment state, so it
 * has to be re-derived. Merging them into one flat record would invite caching
 * the expiry decision, which is exactly the bug that lets an expired trial keep
 * writing until the next restart.
 *
 * @param entitlements what the plan grants
 * @param writable     false once the trial has expired without a subscription,
 *                     or the account was suspended/cancelled
 * @param lockReason   why writes are blocked, for the UI to render; null when
 *                     {@code writable}
 */
public record TenantAccess(
    Entitlements entitlements,
    boolean writable,
    String lockReason,
    OffsetDateTime trialEndsAt,
    SubscriptionStatus subscriptionStatus) {

    public boolean has(Capability capability) {
        return entitlements.has(capability);
    }
}
