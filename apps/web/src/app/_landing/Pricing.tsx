'use client';

import Link from 'next/link';
import { useRef, useState, type KeyboardEvent } from 'react';
import { ComingSoon } from '@/components/ComingSoon';
import { Icon } from '@/components/Icon';
import { useTranslation } from '@/lib/i18n';
import { PLAN_TIERS } from '@/lib/plans';

/**
 * The plans, from `PLAN_TIERS` — the same array the in-app Plan panel reads, so
 * the price that sold a plan and the price shown after signing up cannot drift.
 */
export function Pricing() {
  const { t, format } = useTranslation();
  const [yearly, setYearly] = useState(false);
  const monthlyRef = useRef<HTMLButtonElement>(null);
  const yearlyRef = useRef<HTMLButtonElement>(null);

  // Two options, so every arrow simply flips to the other one.
  const onPeriodKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const next = !yearly;
    setYearly(next);
    (next ? yearlyRef : monthlyRef).current?.focus();
  };

  /** The € on the side the locale puts it: "€19" in English, "19 €" in German. */
  const price = (euros: string) => {
    const { symbol, value, symbolFirst } = format.eurParts(Number(euros) * 100);
    return (
      <div className="lp-price">
        {symbolFirst && <b>{symbol}</b>}
        <b>{value}</b>
        {/* A trailing € gets a word space: at display size the flex gap alone
            reads as "19€", which German typesetting does not write. */}
        {!symbolFirst && <b style={{ marginLeft: '0.12em' }}>{symbol}</b>}
        <span>{t('landing.pricing.perMonth')}</span>
      </div>
    );
  };

  return (
    <section
      id="pricing"
      className="lp-section lp-band"
      data-tone="theme"
      aria-labelledby="lp-pricing-title"
    >
      <div className="lp-wrap">
        <div className="lp-head-row">
          <div>
            <h2 id="lp-pricing-title" className="lp-h2">
              {t('landing.pricing.title')}
            </h2>
            <p className="lp-lede" style={{ marginTop: 16, fontSize: '1.1rem' }}>
              {t('landing.pricing.sub')}
            </p>
          </div>
          <div className="lp-period">
            {/* `radiogroup`, not `tablist`: two values of one setting, no panels.
                The radio pattern: one tab stop (the checked option), and the
                arrow keys both move and select. */}
            <div
              className="lp-switch"
              role="radiogroup"
              aria-label={t('landing.aria.billingPeriod')}
              onKeyDown={onPeriodKey}
            >
              <button
                ref={monthlyRef}
                type="button"
                role="radio"
                aria-checked={!yearly}
                tabIndex={yearly ? -1 : 0}
                onClick={() => setYearly(false)}
              >
                {t('landing.pricing.monthly')}
              </button>
              <button
                ref={yearlyRef}
                type="button"
                role="radio"
                aria-checked={yearly}
                tabIndex={yearly ? 0 : -1}
                onClick={() => setYearly(true)}
              >
                {t('landing.pricing.yearly')}
              </button>
            </div>
            {/* PAngV: the VAT basis sits with the figures it qualifies. */}
            <p className="lp-vat">{t('landing.pricing.vatNote')}</p>
          </div>
        </div>

        <div className="lp-plans">
          {PLAN_TIERS.map((plan) => (
            <div key={plan.id} className="lp-plan" data-highlighted={plan.highlighted}>
              <div className="lp-plan-head">
                <h3 className="lp-plan-name">{plan.tier}</h3>
                {plan.highlighted && (
                  <span className="lp-plan-flag">{t('landing.pricing.recommended')}</span>
                )}
              </div>
              {price(yearly ? plan.yearly : plan.monthly)}
              <div className="lp-billed">
                {yearly ? t('landing.pricing.billedYearly') : t('landing.pricing.billedMonthly')}
              </div>
              {/* Carries the plan to registration, so the signup is the one picked. */}
              <Link
                href={`/register?plan=${plan.id}`}
                className={`lp-btn lp-btn-block ${plan.highlighted ? 'lp-btn-ink' : 'lp-btn-line'}`}
              >
                {t('landing.pricing.choose', { plan: plan.tier })}
              </Link>
              <ul>
                {plan.features.map((feat) => (
                  <li key={feat.labelKey} className={feat.soon ? 'lp-soon' : undefined}>
                    {feat.soon ? (
                      <span className="lp-plan-dash" aria-hidden="true">
                        ○
                      </span>
                    ) : (
                      <Icon name="check" size={14} strokeWidth={2.4} />
                    )}
                    <span>
                      {t(feat.labelKey)}
                      {feat.footnote && <sup>*</sup>}
                    </span>
                    {feat.soon && <ComingSoon size="sm" />}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="lp-footnote">{t('landing.pricing.feeNote')}</p>
      </div>
    </section>
  );
}
