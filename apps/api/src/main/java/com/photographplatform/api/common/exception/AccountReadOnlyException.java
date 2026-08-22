package com.photographplatform.api.common.exception;

/**
 * The tenant may read everything they have, but may not create or change
 * anything right now — the state an expired trial or a lapsed subscription
 * leaves an account in (PRICING.md §7.7).
 *
 * <p>Read-only rather than suspended is a deliberate product decision: a
 * suspended account would also cut off *clients* holding a delivered gallery
 * link, who never agreed to anything and would simply find their wedding
 * photos gone. So writes stop, delivery keeps working, and nothing is
 * destroyed while the photographer decides.
 *
 * <p>402 with a distinct {@code code} for the same reason as
 * {@link PlanUpgradeRequiredException}: the frontend has to render "your trial
 * ended" rather than a generic permission failure.
 */
public class AccountReadOnlyException extends RuntimeException {

    public AccountReadOnlyException(String message) {
        super(message);
    }
}
