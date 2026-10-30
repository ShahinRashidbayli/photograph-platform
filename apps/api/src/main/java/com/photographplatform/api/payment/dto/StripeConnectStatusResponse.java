package com.photographplatform.api.payment.dto;

import java.time.OffsetDateTime;

/**
 * The tenant's Stripe Connect standing, as the settings screen needs it.
 *
 * @param platformConfigured whether the platform itself has Stripe credentials
 *                           at all — false in local/dev, where the whole
 *                           section renders as unavailable rather than broken
 * @param accountId          the connected {@code acct_…}, or null before the
 *                           photographer has started onboarding
 * @param chargesEnabled     Stripe's verdict on whether this account may take
 *                           money right now; the gate on the payment path
 * @param payoutsEnabled     whether Stripe will pay out to their bank yet —
 *                           can lag chargesEnabled while verification finishes
 * @param detailsSubmitted   whether they finished the hosted onboarding form
 * @param commissionBps      the platform's cut on their current plan, in basis
 *                           points, so the UI can state it in the photographer's
 *                           own terms instead of hardcoding "2%"
 */
public record StripeConnectStatusResponse(
    boolean platformConfigured,
    String accountId,
    boolean chargesEnabled,
    boolean payoutsEnabled,
    boolean detailsSubmitted,
    OffsetDateTime onboardedAt,
    String plan,
    int commissionBps
) {
}
