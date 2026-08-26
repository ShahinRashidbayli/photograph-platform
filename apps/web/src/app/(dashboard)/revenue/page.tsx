'use client';

import React from 'react';
import { useTranslation } from '@/lib/i18n';
import { useColors } from '@/components/ui';
import { BarChart, Legend } from '../analytics.charts';
import { monthLabels, useAnalytics } from '../analytics.data';
import { ChartCard, DataTable, ReportShell, StatTile } from '../analytics.shell';

/**
 * Revenue — what the studio invoiced, and what actually arrived.
 *
 * <p>The gap between those two is the point of the screen. A report that only
 * showed turnover would tell a photographer they had a good year while the
 * money was still sitting in somebody else's account.
 *
 * <p>Every figure comes from issued invoices and succeeded payments. Nothing is
 * projected, annualised or smoothed — a half-finished year is shown as a
 * half-finished year.
 */
export default function RevenuePage() {
  const { t, format, lang } = useTranslation();
  const c = useColors();
  const { data, year, loading, locked, error, selectYear } = useAnalytics();

  const months = monthLabels(lang);
  const rev = data?.revenue;
  const isEmpty = !!data && rev !== undefined && rev.invoiceCount === 0;

  const invoiced = t('analytics.invoiced');
  const collected = t('analytics.collected');

  return (
    <ReportShell
      title={t('analytics.revenue.title')}
      subtitle={t('analytics.revenue.subtitle')}
      years={data?.availableYears ?? []}
      year={year}
      onSelectYear={selectYear}
      loading={loading}
      locked={locked}
      error={error}
      isEmpty={isEmpty}
    >
      {rev && (
        <>
          <ChartCard title={t('analytics.revenue.summary')}>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <StatTile label={invoiced} value={format.eur(rev.invoicedCents)} />
              <StatTile
                label={collected}
                value={format.eur(rev.collectedCents)}
                hint={t('analytics.revenue.ofInvoiced', {
                  percent: percent(rev.collectedCents, rev.invoicedCents),
                })}
              />
              <StatTile
                label={t('analytics.revenue.outstanding')}
                value={format.eur(rev.outstandingCents)}
                // Amber only when there is something to chase; an outstanding
                // balance of zero is good news and should not wear a warning.
                tone={rev.outstandingCents > 0 ? c.warningText : undefined}
              />
              <StatTile
                label={t('analytics.revenue.averageInvoice')}
                value={format.eur(rev.averageInvoiceCents)}
                hint={t('analytics.revenue.invoiceCount', {
                  count: format.number(rev.invoiceCount),
                })}
              />
            </div>
          </ChartCard>

          <ChartCard
            title={t('analytics.revenue.byMonth')}
            aside={<Legend a={invoiced} b={collected} />}
          >
            <BarChart
              bars={rev.months.map((m) => ({
                label: months[m.month - 1].slice(0, 1),
                title: months[m.month - 1],
                a: m.invoicedCents,
                b: m.collectedCents,
              }))}
              seriesA={invoiced}
              seriesB={collected}
              format={(v) => format.eur(v)}
            />
            <DataTable
              caption={t('analytics.showTable')}
              head={[t('analytics.month'), invoiced, collected]}
              rows={rev.months.map((m) => [
                months[m.month - 1],
                format.eur(m.invoicedCents),
                format.eur(m.collectedCents),
              ])}
            />
          </ChartCard>
        </>
      )}
    </ReportShell>
  );
}

function percent(part: number, whole: number): string {
  if (whole <= 0) return '0%';
  return `${Math.round((part / whole) * 100)}%`;
}
