package com.photographplatform.api.billing.dto;

import java.time.OffsetDateTime;

/**
 * What the settings screen needs to explain a photographer's billing state.
 *
 * @param subscriptionConfigured false when this deployment has no Stripe
 *                               prices at all — the UI then hides the plan
 *                               buttons instead of offering a checkout that
 *                               would 409
 * @param manageable             true once there is a Stripe customer to open
 *                               the billing portal for; before the first
 *                               checkout there is nothing to manage
 * @param writable               mirrors the read-only lock, so the settings
 *                               page can explain a lock the rest of the app is
 *                               already enforcing
 */
public record BillingStatusResponse(
    String plan,
    String subscriptionStatus,
    OffsetDateTime trialEndsAt,
    OffsetDateTime currentPeriodEnd,
    boolean subscriptionConfigured,
    boolean manageable,
    boolean writable,
    String lockReason
) {}
