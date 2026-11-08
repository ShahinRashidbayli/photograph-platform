'use client';

import { getColors } from '@/lib/design-tokens';
import { useTranslation } from '@/lib/i18n';
import { useThemeStore } from '@/store/themeStore';
import type { CSSProperties } from 'react';

/**
 * ComingSoon — the single source of truth for the "not shipped yet" badge.
 *
 * We advertise the full product vision (contracts, Stripe payments, GoBD
 * invoices, analytics …) but only some of it is live today. Rather than hide
 * the roadmap or fake the features, we label the unbuilt ones honestly with
 * this amber pill. One component so the wording, colour and shape stay
 * identical on the landing page, the pricing table and the dashboard sidebar.
 *
 *   • `sm`  — compact "Soon" for tight rows (feature bullets, sidebar, marquee)
 *   • `md`  — "Coming soon" for headings (feature tiles, pipeline steps)
 */
interface ComingSoonProps {
  size?: 'sm' | 'md';
  /** Override the pill text. Defaults to the translated "Soon" (sm) / "Coming soon" (md). */
  label?: string;
  style?: CSSProperties;
}

export function ComingSoon({ size = 'sm', label, style }: ComingSoonProps) {
  const { theme } = useThemeStore();
  const { t } = useTranslation();
  const c = getColors(theme);
  const text = label ?? (size === 'md' ? t('common.comingSoon') : t('common.soon'));

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
        borderRadius: '999px',
        fontWeight: 550,
        lineHeight: 1,
        background: c.warningBg,
        color: c.warningText,
        border: `1px solid ${c.warningBorder}`,
        fontSize: size === 'md' ? '0.62rem' : '0.58rem',
        padding: size === 'md' ? '4px 8px' : '3px 6px',
        ...style,
      }}
    >
      {text}
    </span>
  );
}
