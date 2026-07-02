'use client';

import React, { useMemo } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { getColors } from '@/lib/design-tokens';

/**
 * Reports — stub page. Sidebar entry exists to validate the information
 * architecture; real analytics (lead → booking conversion, seasonal trends,
 * package mix, weekday distribution) land in Sprint 2.5 per the master plan.
 *
 * <p>Kept deliberately minimal so the "coming soon" honesty is visible
 * rather than dressed up with fake charts.
 */
export default function ReportsPage() {
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
        Reports
      </h1>
      <p style={{ fontSize: '0.95rem', color: c.textMuted, marginBottom: '24px' }}>
        Conversion, seasonality, and package mix analysis for your bookings pipeline.
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
          Coming soon
        </div>
        <p style={{ fontSize: '0.88rem', color: c.textMuted, lineHeight: 1.5, maxWidth: '440px', margin: '0 auto' }}>
          Lead-to-booking conversion rate, seasonal demand curves, and your top
          packages by revenue. We&apos;ll surface these once you&apos;ve worked
          through a few bookings — the data has to exist before the chart does.
        </p>
      </div>
    </div>
  );
}
