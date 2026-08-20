'use client';

import React, { useMemo } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { getColors } from '@/lib/design-tokens';
import { useTranslation } from '@/lib/i18n';

/**
 * Revenue — stub page. Sidebar entry exists to validate the information
 * architecture; the real implementation (monthly revenue, deposits vs
 * outstanding, year-over-year comparison, Stripe payout reconciliation)
 * needs Stripe + accounting integration (Sprint 5 + v3.0 in the master plan).
 */
export default function RevenuePage() {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const c = useMemo(() => getColors(theme), [theme]);

  return (
    <div
      style={{
        padding: '28px 28px 40px',
        maxWidth: '860px',
        margin: '0 auto',
        color: c.text,
      }}
    >
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '6px' }}>
        {t('stubs.revenue.title')}
      </h1>
      <p style={{ fontSize: '0.95rem', color: c.textMuted, marginBottom: '24px' }}>
        {t('stubs.revenue.subtitle')}
      </p>

      <div
        style={{
          padding: '32px 24px',
          background: c.surface,
          border: `1px dashed ${c.border}`,
          borderRadius: '14px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '1rem', fontWeight: 700, color: c.text, marginBottom: '8px' }}>
          {t('stubs.comingSoon')}
        </div>
        <p
          style={{
            fontSize: '0.88rem',
            color: c.textMuted,
            lineHeight: 1.5,
            maxWidth: '440px',
            margin: '0 auto',
          }}
        >
          {t('stubs.revenue.body')}
        </p>
      </div>
    </div>
  );
}
