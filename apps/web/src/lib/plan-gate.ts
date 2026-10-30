/**
 * Which plan unlocks what — for presentation only.
 *
 * <p><b>The server is authoritative.</b> `EntitlementService` decides what a
 * tenant may actually do, and `GET /api/entitlements` reports it; a screen that
 * wants to know whether *this* tenant has a capability must read
 * {@link useEntitlements}, never this file. What lives here is the other
 * question — "which tier would I have to be on?" — which the entitlements
 * response does not answer, because it describes the plan you have rather than
 * the ones you do not.
 *
 * <p>That makes this a deliberate, narrow duplication of
 * `app.plans.tiers[].capabilities` in `application.yml`. It is safe in the only
 * direction that matters: being wrong here mis-names a tier in an upgrade
 * prompt, and cannot grant access — the API still refuses. The 402 path proves
 * it, since the server sends its own `requiredPlan` in the error body and
 * {@link PlanUpgradeDialog} prefers that over anything computed here.
 */

export type Plan = 'STARTER' | 'PRO' | 'STUDIO';

/** Ascending, so a higher index is a bigger plan. Mirrors `Plan.atLeast`. */
export const PLAN_RANK: readonly Plan[] = ['STARTER', 'PRO', 'STUDIO'] as const;

/**
 * The cheapest plan that grants each capability.
 *
 * <p>Cheapest, not "the plan that has it" — Studio includes everything Pro
 * does, and an upgrade prompt that named Studio for a Pro feature would read as
 * an upsell rather than an answer. The API's own gate picks the cheapest for
 * the same reason (`EntitlementService#cheapestPlanWith`).
 */
export const CAPABILITY_PLAN: Record<string, Plan> = {
  INSTAGRAM_AUTOMATION: 'PRO',
  CONTRACTS: 'PRO',
  ANALYTICS: 'STUDIO',
  WHITE_LABEL_BRANDING: 'STUDIO',
};

/** Extra seats are a quantity rather than a capability, but gate the same way. */
export const SEATS_PLAN: Plan = 'STUDIO';

export function planThatGrants(capability: string): Plan | null {
  return CAPABILITY_PLAN[capability] ?? null;
}

export function isAtLeast(plan: Plan | string | undefined, required: Plan): boolean {
  const have = PLAN_RANK.indexOf((plan ?? 'STARTER') as Plan);
  return have >= 0 && have >= PLAN_RANK.indexOf(required);
}

/**
 * Where every upgrade prompt sends the photographer.
 *
 * <p>One constant rather than the string repeated at each call site: there were
 * four prompts pointing at this section and two more with no destination at
 * all, which is how "upgrade" ends up meaning something different in each
 * corner of the app.
 *
 * <p>It is the Plan panel of Settings. It used to be a `#settings-subscription`
 * fragment on a single very long settings page, which needed a retrying scroll
 * shim to reach and still left the photographer to orient themselves; splitting
 * Settings into routes turned it into a page that simply opens on what they
 * came for.
 */
export const UPGRADE_HREF = '/settings/plan';
