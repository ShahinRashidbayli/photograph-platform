package com.photographplatform.api.billing.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

/**
 * Which plan the photographer is buying, and how often they want to pay.
 *
 * <p>Note what this does <em>not</em> do: it names a plan, it does not grant
 * one. The tenant's tier is set from the Stripe price on the resulting
 * subscription, so a caller asking for STUDIO here gets a STUDIO checkout, not
 * a STUDIO account.
 */
public record StartCheckoutRequest(
    @NotNull @Pattern(regexp = "STARTER|PRO|STUDIO",
        message = "plan must be STARTER, PRO or STUDIO")
    String plan,

    @Pattern(regexp = "MONTHLY|YEARLY", message = "interval must be MONTHLY or YEARLY")
    String interval
) {}
