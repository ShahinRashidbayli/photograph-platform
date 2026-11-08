'use client';

import React from 'react';
import { useTranslation } from '@/lib/i18n';
import { UpgradeCard } from '@/components/UpgradeCard';
import { asyncErrorText, type AsyncError } from '@/lib/async-error';
import { Alert, Card, EmptyState, useColors } from '@/components/ui';
import { pageTitle } from '@/lib/design-tokens';

/**
 * The frame both report screens share: title, year picker, and the three
 * states they can be in before there is anything to draw.
 *
 * <p>Extracted because those states — locked, loading, empty — are where the
 * two pages would otherwise be identical, and where getting one of them subtly
 * different is most visible: a customer who sees "upgrade" on one report and a
 * blank page on the other learns nothing about why.
 */
export function ReportShell({
  title,
  subtitle,
  years,
  year,
  onSelectYear,
  loading,
  locked,
  error,
  isEmpty,
  children,
}: {
  title: string;
  subtitle: string;
  years: number[];
  year: number | null;
  onSelectYear: (_year: number) => void;
  loading: boolean;
  locked: boolean;
  error: AsyncError | null;
  isEmpty: boolean;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const c = useColors();

  return (
    <div style={{ padding: '28px 28px 40px', maxWidth: 980, margin: '0 auto', color: c.text }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={pageTitle}>{title}</h1>
          <p style={{ fontSize: '0.95rem', color: c.textMuted, margin: 0 }}>{subtitle}</p>
        </div>

        {/* One filter, above the charts. Only rendered when there is more than
            one year to choose between — a picker with a single option is a
            control that cannot do anything. */}
        {!locked && years.length > 1 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
            <span style={{ color: c.textMuted }}>{t('analytics.year')}</span>
            <select
              value={year ?? ''}
              onChange={(e) => onSelectYear(Number(e.target.value))}
              style={{
                padding: '7px 10px',
                borderRadius: 8,
                border: `1px solid ${c.border}`,
                background: c.surface,
                color: c.text,
                fontSize: '0.85rem',
                fontFamily: 'inherit',
              }}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {locked ? (
        <UpgradeCard
          capability="ANALYTICS"
          title={t('analytics.lockedTitle')}
          body={t('analytics.lockedBody')}
        />
      ) : error ? (
        <Alert tone="danger">{asyncErrorText(error, t)}</Alert>
      ) : loading ? (
        <Card>
          <p style={{ color: c.textMuted, fontSize: '0.9rem', margin: 0 }}>
            {t('analytics.loading')}
          </p>
        </Card>
      ) : isEmpty ? (
        <Card>
          {/* An honest empty year, not a chart of zeroes: twelve empty bars
              look like a broken query. */}
          <EmptyState title={t('analytics.emptyTitle')} body={t('analytics.emptyBody')} />
        </Card>
      ) : (
        children
      )}
    </div>
  );
}

/** A headline figure. The form for a single number that needs no comparison. */
export function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  const c = useColors();
  return (
    <div style={{ flex: '1 1 160px', minWidth: 0 }}>
      <div style={{ fontSize: '0.8rem', color: c.textMuted, marginBottom: 6 }}>{label}</div>
      <div
        style={{
          fontSize: '1.5rem',
          fontWeight: 600,
          color: tone ?? c.text,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.15,
        }}
      >
        {value}
      </div>
      {hint && <div style={{ fontSize: '0.78rem', color: c.textSubtle, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

/** The panel a chart sits in, with its heading. */
export function ChartCard({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const c = useColors();
  return (
    <Card style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 18,
        }}
      >
        <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: c.text, margin: 0 }}>{title}</h2>
        {aside}
      </div>
      {children}
    </Card>
  );
}

/**
 * The table view every chart owes its reader.
 *
 * <p>Collapsed by default so it does not compete with the chart, but present on
 * the page rather than behind a mode switch: it is what makes the figures
 * reachable when colour is not — screen readers, printouts, forced-colors.
 */
export function DataTable({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: (string | number)[][];
}) {
  const c = useColors();
  return (
    <details style={{ marginTop: 16 }}>
      <summary style={{ cursor: 'pointer', fontSize: '0.82rem', color: c.textMuted }}>
        {caption}
      </summary>
      <div style={{ overflowX: 'auto', marginTop: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr>
              {head.map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: 'left',
                    padding: '6px 10px 6px 0',
                    color: c.textMuted,
                    fontWeight: 600,
                    borderBottom: `1px solid ${c.border}`,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td
                    key={j}
                    style={{
                      padding: '6px 10px 6px 0',
                      color: j === 0 ? c.text : c.textMuted,
                      borderBottom: `1px solid ${c.borderSoft}`,
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
