package com.photographplatform.api.common.exception;

import com.photographplatform.api.entitlement.domain.Capability;
import com.photographplatform.api.tenant.domain.Plan;

/**
 * The tenant's plan does not include what they just tried to use.
 *
 * <p>Answered as 402 with a structured {@code code}, following the
 * {@link EmailNotVerifiedException} precedent: the frontend has to tell "you
 * cannot do this" apart from "you cannot do this *yet*, on this plan" — one is
 * a permission error and the other is an upgrade prompt, and rendering the
 * first for the second loses a sale and reads as a bug.
 *
 * <p>Carries the capability and the cheapest plan that grants it so the UI can
 * name the tier instead of saying "upgrade" into the void.
 */
public class PlanUpgradeRequiredException extends RuntimeException {

    private final transient Capability capability;
    private final transient Plan requiredPlan;

    public PlanUpgradeRequiredException(Capability capability, Plan requiredPlan) {
        super("This feature is not included in your plan.");
        this.capability = capability;
        this.requiredPlan = requiredPlan;
    }

    /**
     * For a plan limit that is a quantity rather than a feature — seats being
     * the first: the studio is not missing a capability, it has run out of one
     * it already has.
     *
     * <p>Same status and same code, because it is the same conversation with
     * the customer: "this needs a bigger plan, and here is which". The
     * capability is null, and {@code GlobalExceptionHandler} omits it rather
     * than inventing one, so the frontend can tell the two apart by its
     * absence. The message is passed in because "you have 3 of 3 seats" is
     * worth saying precisely.
     */
    public PlanUpgradeRequiredException(String message, Plan requiredPlan) {
        super(message);
        this.capability = null;
        this.requiredPlan = requiredPlan;
    }

    public Capability getCapability() {
        return capability;
    }

    public Plan getRequiredPlan() {
        return requiredPlan;
    }
}
