'use client';

import React from 'react';
import Link from 'next/link';
import { Button, Card, useColors } from '@/components/ui';
import { useTranslation } from '@/lib/i18n';
import { planThatGrants, UPGRADE_HREF, type Plan } from '@/lib/plan-gate';

/**
 * The one way this app says "your plan does not include this".
 *
 * <p>It replaced four different answers to the same question: reports rendered
 * a locked panel with a working link, Team and Branding rendered a title and a
 * body with **no way to act on them at all**, and the contracts panel rendered
 * nothing — a photographer on Starter could not tell the feature existed. A
 * prompt without a destination is not a prompt; it is a wall with an apology
 * written on it.
 *
 * <p>Always names the tier. "Upgrade" alone asks the reader to go and find out
 * what it would cost them, which is a step most will not take.
 */
export function UpgradeCard({
  capability,
  plan,
  title,
  body,
  compact = false,
}: {
  /** Capability name as the API serialises it; used to name the required tier. */
  capability?: string;
  /** Overrides `capability` when the gate is a quantity (seats) and not a flag. */
  plan?: Plan;
  title: string;
  body: string;
  /** Inline variant for a panel inside a page, rather than a whole page's body. */
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const c = useColors();
  const required = plan ?? (capability ? planThatGrants(capability) : null);

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span aria-hidden="true" style={{ display: 'inline-flex', color: c.textMuted }}>
          <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
            <rect
              x="2.5"
              y="6"
              width="9"
              height="6.5"
              rx="1.2"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <path
              d="M4.75 6V4.25a2.25 2.25 0 0 1 4.5 0V6"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </svg>
        </span>
        <span style={{ fontWeight: 700, fontSize: compact ? '0.92rem' : '1.02rem', color: c.text }}>
          {title}
        </span>
        {required && (
          <span
            style={{
              padding: '2px 9px',
              borderRadius: 999,
              background: c.primaryBg,
              color: c.primaryText,
              border: `1px solid ${c.primaryBorder}`,
              fontSize: '0.7rem',
              fontWeight: 800,
              letterSpacing: '0.06em',
            }}
          >
            {required}
          </span>
        )}
      </div>

      <p style={{ margin: 0, fontSize: '0.88rem', color: c.textMuted, lineHeight: 1.55 }}>{body}</p>

      <div>
        <Link href={UPGRADE_HREF} style={{ textDecoration: 'none' }}>
          <Button size={compact ? 'sm' : 'md'}>
            {required ? t('upgrade.ctaNamed' as never, { plan: required }) : t('upgrade.cta')}
          </Button>
        </Link>
      </div>
    </div>
  );

  // Compact renders bare so it can sit inside a panel that already has a card
  // around it; nesting two cards reads as a modal that failed to open.
  return compact ? (
    <div
      style={{
        border: `1px dashed ${c.border}`,
        borderRadius: 10,
        padding: '14px 16px',
        background: c.surfaceAlt,
      }}
    >
      {content}
    </div>
  ) : (
    <Card>{content}</Card>
  );
}
