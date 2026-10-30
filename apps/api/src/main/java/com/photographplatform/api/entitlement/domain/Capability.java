package com.photographplatform.api.entitlement.domain;

/**
 * The boolean, plan-gated features — the ones a tenant either has or does not.
 *
 * <p>Deliberately only the on/off capabilities. The numeric limits (retention
 * window, seat count, commission rate, fair-use cap) are not capabilities and
 * do not belong here: they are compared, not checked, so they live as typed
 * fields on {@link Entitlements} where the arithmetic is visible. Folding them
 * into this enum would force every caller to unpack an {@code int} from a
 * generic capability lookup and lose that.
 *
 * <p>The names are part of the API contract: {@code GET /api/entitlements}
 * serialises them for the frontend, which gates its own navigation on the same
 * set. Renaming one silently un-gates a screen, so treat them as stable.
 */
public enum Capability {

    /** Pro anchor — Instagram DM auto-reply (PRICING.md §3, ROADMAP.md §4.5). */
    INSTAGRAM_AUTOMATION,

    /** Pro — contracts with a simple electronic signature. */
    CONTRACTS,

    /** Studio — revenue and booking analytics. */
    ANALYTICS,

    /** Studio — own logo, colours and branding on client-facing surfaces. */
    WHITE_LABEL_BRANDING
}
