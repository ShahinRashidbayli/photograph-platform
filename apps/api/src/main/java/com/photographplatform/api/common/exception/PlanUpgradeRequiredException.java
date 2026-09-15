package com.photographplatform.api.common.exception;

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
 *
 * <h2>Why these are strings and not the enums</h2>
 * They used to be {@code entitlement.domain.Capability} and
 * {@code tenant.domain.Plan}, which made {@code common} depend on two feature
 * modules — the thing {@code ArchitectureTest.commonStaysCommon} exists to
 * prevent. Nothing here needs the enums' behaviour: both values are read once,
 * by {@link GlobalExceptionHandler}, and written straight onto the wire as
 * {@code name()} already was. So the exception carries the wire form, the
 * enum-to-name conversion happens at the throw site inside the module that owns
 * the enum, and {@code common} goes back to depending on nobody.
 *
 * <p>Constructed through the two named factories rather than constructors,
 * because with both fields as {@code String} the old two-arg signatures would
 * be indistinguishable — and "which String is the message" is exactly the kind
 * of thing a caller gets backwards.
 */
public class PlanUpgradeRequiredException extends RuntimeException {

    private final String capability;
    private final String requiredPlan;

    private PlanUpgradeRequiredException(String message, String capability, String requiredPlan) {
        super(message);
        this.capability = capability;
        this.requiredPlan = requiredPlan;
    }

    /**
     * A feature the plan does not include. Pass the {@code Capability} and
     * {@code Plan} names — the caller lives in the module that owns them.
     */
    public static PlanUpgradeRequiredException missingCapability(
        String capability, String requiredPlan) {
        return new PlanUpgradeRequiredException(
            "This feature is not included in your plan.", capability, requiredPlan);
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
    public static PlanUpgradeRequiredException limitReached(
        String message, String requiredPlan) {
        return new PlanUpgradeRequiredException(message, null, requiredPlan);
    }

    /** The {@code Capability} name, or {@code null} for a quantity limit. */
    public String getCapability() {
        return capability;
    }

    /** The {@code Plan} name of the cheapest tier that would allow this. */
    public String getRequiredPlan() {
        return requiredPlan;
    }
}
