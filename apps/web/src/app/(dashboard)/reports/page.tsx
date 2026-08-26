'use client';

import React from 'react';
import { useTranslation } from '@/lib/i18n';
import { getBookingStatusMeta, toneToVisual } from '@/lib/booking-status';
import { useColors } from '@/components/ui';
import { BarChart, RankedBars } from '../analytics.charts';
import { monthLabels, useAnalytics } from '../analytics.data';
import { ChartCard, DataTable, ReportShell, StatTile } from '../analytics.shell';

/**
 * Booking reports — the shape of the year's work.
 *
 * <p>Three questions, in the order a photographer asks them: when am I busy,
 * what did the enquiries turn into, and which packages actually sell.
 *
 * <p>Statuses reuse `booking-status`, the same source the bookings list and the
 * calendar read. A report that invented its own labels or colours for the same
 * states would be a second vocabulary for one thing.
 */
export default function ReportsPage() {
  const { t, format, lang } = useTranslation();
  const c = useColors();
  const { data, year, loading, locked, error, selectYear } = useAnalytics();

  const months = monthLabels(lang);
  const b = data?.bookings;
  const isEmpty = !!data && b !== undefined && b.total === 0 && b.leadsReceived === 0;

  const bookingsLabel = t('analytics.reports.bookings');

  return (
    <ReportShell
      title={t('analytics.reports.title')}
      subtitle={t('analytics.reports.subtitle')}
      years={data?.availableYears ?? []}
      year={year}
      onSelectYear={selectYear}
      loading={loading}
      locked={locked}
      error={error}
      isEmpty={isEmpty}
    >
      {b && (
        <>
          <ChartCard title={t('analytics.reports.summary')}>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <StatTile label={bookingsLabel} value={format.number(b.total)} />
              <StatTile
                label={t('analytics.reports.leads')}
                value={format.number(b.leadsReceived)}
              />
              <StatTile
                label={t('analytics.reports.converted')}
                value={format.number(b.leadsConverted)}
                hint={t('analytics.reports.conversionRate', {
                  percent: percent(b.leadsConverted, b.leadsReceived),
                })}
              />
            </div>
          </ChartCard>

          <ChartCard title={t('analytics.reports.byMonth')}>
            <BarChart
              bars={b.months.map((m) => ({
                label: months[m.month - 1].slice(0, 1),
                title: months[m.month - 1],
                a: m.count,
              }))}
              seriesA={bookingsLabel}
              format={(v) => format.number(v)}
            />
            <DataTable
              caption={t('analytics.showTable')}
              head={[t('analytics.month'), bookingsLabel]}
              rows={b.months.map((m) => [months[m.month - 1], format.number(m.count)])}
            />
          </ChartCard>

          {b.byStatus.length > 0 && (
            <ChartCard title={t('analytics.reports.byStatus')}>
              {/* Status keeps its own colour from `booking-status` rather than
                  the chart's series hue: these are states, not series, and the
                  rest of the app already teaches what each colour means. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {b.byStatus.map((s) => {
                  const meta = getBookingStatusMeta(s.status);
                  const visual = toneToVisual(meta.tone, c);
                  return (
                    <StatusRow
                      key={s.status}
                      label={t(meta.labelKey)}
                      count={s.count}
                      total={b.total}
                      color={visual.dot}
                      countLabel={format.number(s.count)}
                    />
                  );
                })}
              </div>
            </ChartCard>
          )}

          {b.topPackages.length > 0 && (
            <ChartCard title={t('analytics.reports.packages')}>
              <RankedBars
                rows={b.topPackages.map((p) => ({
                  label: p.name,
                  value: p.count,
                  hint: format.eur(p.revenueCents),
                }))}
                format={(v) => format.number(v)}
              />
            </ChartCard>
          )}
        </>
      )}
    </ReportShell>
  );
}

function StatusRow({
  label,
  count,
  total,
  color,
  countLabel,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
  countLabel: string;
}) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          fontSize: '0.85rem',
          marginBottom: 5,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{ width: 8, height: 8, borderRadius: 2, background: color }}
            aria-hidden="true"
          />
          {label}
        </span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{countLabel}</span>
      </div>
      <div style={{ height: 8, background: 'rgba(127,127,127,0.16)', borderRadius: 999 }}>
        <div
          style={{
            width: `${Math.max(2, (count / Math.max(1, total)) * 100)}%`,
            height: '100%',
            background: color,
            borderRadius: 999,
          }}
        />
      </div>
    </div>
  );
}

function percent(part: number, whole: number): string {
  if (whole <= 0) return '0%';
  return `${Math.round((part / whole) * 100)}%`;
}
