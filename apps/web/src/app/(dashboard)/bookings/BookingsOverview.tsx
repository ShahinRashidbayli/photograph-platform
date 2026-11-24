'use client';

import React, { useMemo } from 'react';
import { summaryYear, useYearSummary } from '@/hooks/useAnalytics';
import { fontSize, getColors, radius, space } from '@/lib/design-tokens';
import { useTranslation, type PluralKey } from '@/lib/i18n';
import type { Booking } from '@/types/api';
import type { FilterKey } from './bookings.filters';
import {
  attentionFor,
  daysFromToday,
  isUpcoming,
  uncollectedCents,
  type AttentionKey,
  type BookingContext,
} from './bookings.insights';
import { relativeDay } from './BookingProgress';

/** In the order the breakdown reads: the costliest wait first. */
const ATTENTION_COUNT: [AttentionKey, PluralKey][] = [
  ['reply', 'bookings.attention.count.reply'],
  ['close', 'bookings.attention.count.close'],
  ['overdue', 'bookings.attention.count.overdue'],
  ['contractUnsigned', 'bookings.attention.count.contractUnsigned'],
];

/**
 * The photographer's four numbers above the list.
 *
 * <p>Three are buttons. The strip they replaced was read-only ("Active
 * bookings 3"), so a number that named work — three bookings waiting on you,
 * €1,190 still owed — could not take you to that work. Now "Needs you" and
 * "Open balance" filter the list, and "Next shoot" opens it. "Collected" is a
 * fact, not a queue, and stays plain text.
 *
 * <p>Collected and Booked are the year's, from the server's summary — the same
 * figures as the dashboard. They used to be summed here from the list with a
 * Billable status list of this screen's own.
 */
export function BookingsOverview({
  bookings,
  ctxFor,
  today,
  filter,
  colors: c,
  onFilter,
  onSelect,
}: {
  bookings: Booking[];
  ctxFor: (_booking: Booking) => BookingContext;
  today: Date;
  filter: FilterKey;
  colors: ReturnType<typeof getColors>;
  onFilter: (_key: FilterKey) => void;
  onSelect: (_id: string) => void;
}) {
  const { t, tPlural, format } = useTranslation();
  const { data: summary } = useYearSummary();

  const numbers = useMemo(() => {
    const next =
      bookings
        .filter(
          (b) => (b.status === 'CONFIRMED' || b.status === 'POSTPONED') && isUpcoming(b, today)
        )
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0] ?? null;
    const attention = new Map<AttentionKey, number>();
    let needs = 0;
    for (const b of bookings) {
      const key = attentionFor(b, ctxFor(b));
      if (!key) continue;
      needs += 1;
      attention.set(key, (attention.get(key) ?? 0) + 1);
    }
    const owing = bookings.filter((b) => uncollectedCents(b) > 0);
    const uncollected = owing.reduce((sum, b) => sum + uncollectedCents(b), 0);
    return { next, attention, needs, owing: owing.length, uncollected };
  }, [bookings, ctxFor, today]);

  const needsBreakdown = ATTENTION_COUNT.filter(([k]) => numbers.attention.has(k))
    .map(([k, key]) => tPlural(key, numbers.attention.get(k) ?? 0))
    .join(' · ');

  const tile = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
    padding: `${space.lg} ${space.xl}`,
    textAlign: 'left',
    border: 0,
    font: 'inherit',
    color: c.text,
    cursor: 'pointer',
    minWidth: 0,
    background: active ? c.surfaceActive : c.surface,
    ['--bk-tile-hover' as string]: active ? c.surfaceActive : c.surfaceHover,
  });
  const label: React.CSSProperties = {
    fontSize: fontSize.base,
    color: c.textMuted,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  };
  const value: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: 600,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
    fontVariantNumeric: 'tabular-nums',
  };
  const sub: React.CSSProperties = {
    fontSize: fontSize.base,
    color: c.textSubtle,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '100%',
  };
  const filteredChip = (
    <span
      style={{
        fontSize: fontSize.xs,
        color: c.text,
        background: c.surface,
        border: `1px solid ${c.border}`,
        borderRadius: radius.pill,
        padding: '0 7px',
      }}
    >
      {t('bookings.overview.filtered')}
    </span>
  );

  const { next } = numbers;
  const needsActive = filter === 'needs';
  const openActive = filter === 'unpaid';

  return (
    <section
      aria-label={t('bookings.overview.aria')}
      className="bk-tiles"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        border: `1px solid ${c.border}`,
        borderRadius: radius.card,
        background: c.border,
        gap: 1,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        className="bk-tile"
        style={tile(false)}
        onClick={() => next && onSelect(next.id)}
        disabled={!next}
      >
        <span style={label}>{t('bookings.overview.nextShoot')}</span>
        <span style={value}>
          {next ? format.weekdayDayMonth(next.eventDate) : t('bookings.overview.nothingScheduled')}
        </span>
        {next && (
          <span style={sub}>
            {next.clientName} · {relativeDay(daysFromToday(next.eventDate, today), t, tPlural)}
          </span>
        )}
      </button>

      <button
        type="button"
        className="bk-tile"
        style={tile(needsActive)}
        aria-pressed={needsActive}
        onClick={() => onFilter(needsActive ? 'all' : 'needs')}
      >
        <span style={label}>
          {t('bookings.overview.needsYou')}
          {needsActive && filteredChip}
        </span>
        <span style={value}>{format.number(numbers.needs)}</span>
        <span style={sub}>{needsBreakdown || t('bookings.overview.allCaughtUp')}</span>
      </button>

      <button
        type="button"
        className="bk-tile"
        style={tile(openActive)}
        aria-pressed={openActive}
        onClick={() => onFilter(openActive ? 'all' : 'unpaid')}
      >
        <span style={label}>
          {t('bookings.overview.openBalance')}
          {openActive && filteredChip}
        </span>
        <span style={{ ...value, color: numbers.uncollected > 0 ? c.warningText : c.text }}>
          {format.eur(numbers.uncollected)}
        </span>
        <span style={sub}>
          {numbers.owing > 0
            ? tPlural('bookings.overview.across', numbers.owing)
            : t('bookings.overview.allSettled')}
        </span>
      </button>

      <div style={{ ...tile(false), cursor: 'default' }}>
        <span style={label}>
          {t('bookings.overview.collected', { year: summaryYear(summary, today) })}
        </span>
        <span style={value}>{summary ? format.eur(summary.collectedCents) : '—'}</span>
        {summary && (
          <span style={sub}>
            {t('bookings.overview.booked', { amount: format.eur(summary.bookedCents) })}
          </span>
        )}
      </div>
    </section>
  );
}
