import { CAPABILITY_PLAN, isAtLeast, PLAN_RANK, planThatGrants, UPGRADE_HREF } from './plan-gate';

/**
 * `plan-gate` is a copy of `app.plans.tiers[].capabilities` from the API's
 * `application.yml`. A copy drifts, so the mapping is pinned here rather than
 * left to be noticed when an upgrade prompt names the wrong tier — which is a
 * quiet failure, since the prompt still renders and still links somewhere.
 *
 * <p>When a capability moves between tiers, this test is meant to fail. Update
 * it against the YAML, not the other way round: the server is authoritative.
 */
describe('capability → cheapest plan that grants it', () => {
  it('matches the API tier config', () => {
    // application.yml: pro grants INSTAGRAM_AUTOMATION + CONTRACTS; studio adds
    // ANALYTICS + WHITE_LABEL_BRANDING.
    expect(CAPABILITY_PLAN).toEqual({
      INSTAGRAM_AUTOMATION: 'PRO',
      CONTRACTS: 'PRO',
      ANALYTICS: 'STUDIO',
      WHITE_LABEL_BRANDING: 'STUDIO',
    });
  });

  it('names the cheapest tier, not merely one that has it', () => {
    // Studio includes everything Pro does. Naming Studio for a Pro feature
    // reads as an upsell rather than an answer, so the cheapest wins — the
    // same rule EntitlementService#cheapestPlanWith applies server-side.
    expect(planThatGrants('CONTRACTS')).toBe('PRO');
    expect(planThatGrants('INSTAGRAM_AUTOMATION')).toBe('PRO');
  });

  it('returns null for a capability it does not know', () => {
    // A capability added on the server before this file catches up must render
    // a prompt with no tier name, never crash and never guess a tier.
    expect(planThatGrants('SOMETHING_NEW')).toBeNull();
  });
});

describe('plan ranking', () => {
  it('orders the tiers cheapest first', () => {
    expect(PLAN_RANK).toEqual(['STARTER', 'PRO', 'STUDIO']);
  });

  it('treats a bigger plan as satisfying a smaller requirement', () => {
    expect(isAtLeast('STUDIO', 'PRO')).toBe(true);
    expect(isAtLeast('PRO', 'PRO')).toBe(true);
    expect(isAtLeast('STARTER', 'PRO')).toBe(false);
  });

  it('degrades an unknown or missing plan to the least entitled answer', () => {
    // Mirrors Plan.from() on the API, which falls back to STARTER rather than
    // to the most generous tier — a typo must not hand out Studio.
    expect(isAtLeast(undefined, 'PRO')).toBe(false);
    expect(isAtLeast('ENTERPRISE', 'PRO')).toBe(false);
  });
});

describe('upgrade destination', () => {
  it('points at the Plan panel, not a fragment on a long page', () => {
    // Was '/settings#settings-subscription' until Settings became routed. A
    // fragment could not be reached without a scroll shim and still landed the
    // photographer mid-page; the route opens on what they came for. If this
    // ever goes back to a '#', the shim has to come back with it.
    expect(UPGRADE_HREF).toBe('/settings/plan');
    expect(UPGRADE_HREF).not.toContain('#');
  });
});
