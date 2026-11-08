'use client';

import React from 'react';
import { ComingSoon } from '@/components/ComingSoon';
import { Button, useColors } from '@/components/ui';
import { useTranslation } from '@/lib/i18n';
import { PLAN_TIERS } from '@/lib/plans';
import type { Plan } from '@/lib/plan-gate';

/**
 * The three tiers, side by side, on the Plan panel.
 *
 * <p>It exists because the panel used to answer the upgrade question with
 * nothing. A photographer who clicked "Upgrade to STUDIO" on a locked report
 * landed here and read either a row of bare plan buttons or — on a deployment
 * with no Stripe prices — a single line saying subscriptions were not enabled.
 * Neither told them what Studio is, what it costs, or why they had been sent
 * here. The funnel ended on the screen built to close it.
 *
 * <p>So the comparison renders in every state, and only the action underneath
 * changes: real checkout, the development switch, or nothing at all. Even with
 * no way to buy, a photographer can see what they would be buying and ask —
 * which is strictly more than a dead end.
 *
 * <p>Prices come from `lib/plans`, the same array the public pricing page
 * renders. A signed-in photographer must never be quoted a different number
 * from the one that sold them the plan.
 */
export function PlanComparison({
  currentPlan,
  yearly,
  actionFor,
}: {
  currentPlan: Plan | string;
  /** Show the annual price. The caller owns the toggle, since it also drives checkout. */
  yearly: boolean;
  /** Rendered under each tier. Returning null leaves the card informational. */
  actionFor?: (_plan: Plan) => React.ReactNode;
}) {
  const { t } = useTranslation();
  const c = useColors();

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(212px, 1fr))',
        gap: 12,
        marginBottom: 18,
      }}
    >
      {PLAN_TIERS.map((tier) => {
        const plan = tier.id.toUpperCase() as Plan;
        const current = plan === currentPlan;
        const action = actionFor?.(plan);
        return (
          <div
            key={tier.id}
            style={{
              border: `1px solid ${current ? c.primaryBorder : c.border}`,
              // The current plan is marked by its border and a label, not by a
              // filled background: this is a comparison, and shading one column
              // makes it read as the recommended choice rather than the one you
              // are already on.
              background: current ? c.primaryBg : c.surfaceAlt,
              borderRadius: 12,
              padding: '14px 15px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: '0.95rem', color: c.text }}>
                {tier.tier}
              </span>
              {current && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    color: c.primaryText,
                  }}
                >
                  {t('settings.subscription.yourPlan')}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 600, color: c.text }}>
                €{yearly ? tier.yearly : tier.monthly}
              </span>
              <span style={{ fontSize: '0.8rem', color: c.textMuted }}>
                {t('settings.subscription.perMonth')}
              </span>
            </div>

            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '2px 0 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
                flex: 1,
              }}
            >
              {tier.features.map((feature) => (
                <li
                  key={feature.labelKey}
                  style={{
                    fontSize: '0.8rem',
                    color: c.textMuted,
                    lineHeight: 1.45,
                    display: 'flex',
                    gap: 6,
                  }}
                >
                  <span aria-hidden="true" style={{ color: c.primarySolid }}>
                    ✓
                  </span>
                  <span>
                    {t(feature.labelKey)}
                    {/* The same honesty badge the pricing page carries. A
                        photographer comparing tiers in-app must not be sold
                        something the pricing page marks as unbuilt. */}
                    {feature.soon && <ComingSoon size="sm" style={{ marginLeft: 6 }} />}
                  </span>
                </li>
              ))}
            </ul>

            {action ? <div style={{ marginTop: 4 }}>{action}</div> : null}
          </div>
        );
      })}
    </div>
  );
}

/** Convenience for the common action: a button that is disabled on the current plan. */
export function PlanActionButton({
  plan,
  currentPlan,
  busy,
  onSelect,
  label,
  currentLabel,
}: {
  plan: Plan;
  currentPlan: Plan | string;
  busy: boolean;
  onSelect: (_plan: Plan) => void;
  label: string;
  currentLabel: string;
}) {
  const current = plan === currentPlan;
  return (
    <Button
      size="sm"
      variant={current ? 'secondary' : 'primary'}
      disabled={busy || current}
      onClick={() => onSelect(plan)}
      style={{ width: '100%' }}
    >
      {current ? currentLabel : label}
    </Button>
  );
}
