package com.photographplatform.api.tenant.domain;

import java.util.Locale;

/**
 * State of Fotolio's own subscription with the photographer.
 *
 * <p>Mirrors Stripe's subscription statuses in our own vocabulary. The mapping
 * is explicit rather than a blind {@code valueOf} on Stripe's string for one
 * reason: a status Stripe adds later must not be able to widen access on its
 * own. {@link #fromStripe(String)} sends anything unrecognised to {@link #NONE}
 * — the least entitled state — so a new provider status degrades to
 * "unsubscribed" and gets noticed, instead of quietly counting as paid.
 *
 * <p>Not to be confused with the Connect account flags on {@link Tenant}
 * ({@code stripeChargesEnabled} and friends), which describe whether the
 * photographer can be paid by <em>their</em> clients.
 */
public enum SubscriptionStatus {

    /** Never subscribed, or the subscription was deleted at Stripe. */
    NONE,

    /** Inside the 14-day trial. */
    TRIALING,

    /** Paid and current. */
    ACTIVE,

    /**
     * Payment failed and Stripe is retrying. Deliberately still counts as
     * entitled ({@link #grantsAccess()}): a declined card is usually an
     * expired card, and locking a photographer out mid-wedding-season over a
     * retry Stripe itself has not given up on would cost far more goodwill
     * than the few days of service costs us. Stripe moves it to UNPAID or
     * CANCELED when it does give up, and those do lock.
     */
    PAST_DUE,

    /** Ended — voluntarily or after Stripe exhausted its retries. */
    CANCELED,

    /** Checkout began and the first payment never completed. */
    INCOMPLETE,

    /** Stripe gave up collecting. */
    UNPAID;

    /**
     * True when this status by itself entitles the tenant to write.
     *
     * <p>An expired trial is not covered here — that is a date comparison the
     * caller combines with this, because TRIALING plus a past {@code
     * trial_ends_at} is precisely the state the read-only lock exists for.
     */
    public boolean grantsAccess() {
        return this == ACTIVE || this == PAST_DUE;
    }

    public static SubscriptionStatus fromStripe(String stripeStatus) {
        if (stripeStatus == null) {
            return NONE;
        }
        return switch (stripeStatus.trim().toLowerCase(Locale.ROOT)) {
            case "trialing" -> TRIALING;
            case "active" -> ACTIVE;
            case "past_due" -> PAST_DUE;
            case "canceled" -> CANCELED;
            case "incomplete", "incomplete_expired" -> INCOMPLETE;
            case "unpaid" -> UNPAID;
            default -> NONE;
        };
    }

    public static SubscriptionStatus from(String raw) {
        if (raw == null) {
            return NONE;
        }
        try {
            return valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException unknown) {
            return NONE;
        }
    }
}
