'use client';

import React from 'react';
import { parseApiDate } from '@/lib/date';
import { getCustomerBookingStatusLabelKey } from '@/lib/booking-status';
import { useTranslation } from '@/lib/i18n';
import type { Booking } from '@/types/api';
import { getStatusVisual } from './bookings.filters';
import type { AttentionKey } from './bookings.insights';
import type { TranslationKey } from '@/lib/i18n';

const ATTENTION_LABEL: Record<AttentionKey, TranslationKey> = {
  reply: 'bookings.attention.reply',
  close: 'bookings.attention.close',
  overdue: 'bookings.attention.overdue',
  contractUnsigned: 'bookings.attention.contractUnsigned',
};
import type { getBookingsColors } from './bookings.styles';

/** One row in the bookings list. */

export type ListItemProps = {
  booking: Booking;
  isActive: boolean;
  onSelect: () => void;
  isPhotographer: boolean;
  styles: Record<string, React.CSSProperties>;
  colors: ReturnType<typeof getBookingsColors>;
  /** Roving tabindex — 0 on the selected row, -1 on the rest. */
  tabIndex: number;
  registerRef: (_el: HTMLButtonElement | null) => void;
  /** What waits on the photographer here, if anything (photographer only). */
  attention?: AttentionKey | null;
  /** What the client still owes on it. */
  openCents?: number;
  isPast?: boolean;
};

export function BookingListItem({
  booking,
  isActive,
  onSelect,
  isPhotographer,
  styles,
  colors,
  tabIndex,
  registerRef,
  attention = null,
  openCents = 0,
  isPast = false,
}: ListItemProps) {
  const { t, format } = useTranslation();
  const date = parseApiDate(booking.eventDate);
  const status = getStatusVisual(booking.status, colors, 'list');
  // The photographer's list is client-first (whose booking is it); the client's
  // own list is session-first (what/where), since every row is theirs.
  const remaining = Math.max(booking.totalAmountCents - (booking.amountPaidCents ?? 0), 0);
  const title = isPhotographer
    ? booking.clientName
    : (booking.eventType ?? t('bookings.sessionFallback'));
  const deadlineDate = !isPhotographer && remaining > 0 ? format.dayMonth(booking.eventDate) : null;
  const metaText = isPhotographer
    ? [booking.eventType ?? t('bookings.sessionFallback'), booking.location]
        .filter(Boolean)
        .join(' · ')
    : [
        booking.location,
        remaining > 0 && deadlineDate
          ? t('bookings.balanceDue', { amount: format.eur(remaining), date: deadlineDate })
          : null,
      ]
        .filter(Boolean)
        .join(' · ');
  const statusLabel = isPhotographer
    ? t(status.labelKey)
    : t(getCustomerBookingStatusLabelKey(booking.status));

  return (
    <button
      type="button"
      ref={registerRef}
      tabIndex={tabIndex}
      onClick={onSelect}
      // Hover is a stylesheet rule (`.bk-row:hover`), not React state — so
      // hovering a row never re-renders the list.
      className="bk-row"
      style={{
        ...styles.listItem,
        ...(isActive ? styles.listItemActive : {}),
      }}
      aria-current={isActive ? 'true' : undefined}
    >
      <div style={{ ...styles.listItemDate, ...(isPast ? styles.listItemDatePast : {}) }}>
        <span style={styles.listItemDateMonth}>{format.weekdayShort(date)}</span>
        <span style={styles.listItemDateDay}>{date.getDate()}</span>
        <span style={styles.listItemDateMonth}>{format.monthAbbr(date)}</span>
      </div>
      <div style={styles.listItemContent}>
        <div style={styles.listItemTopRow}>
          <span style={styles.listItemName}>{title}</span>
          <span style={styles.listItemAmount}>{format.eur(booking.totalAmountCents)}</span>
        </div>
        <div style={styles.listItemBottomRow}>
          <span style={styles.listItemMeta}>{metaText}</span>
          {isPhotographer && openCents > 0 && (
            <span style={styles.listItemOpen}>
              {t('bookings.list.open', { amount: format.eur(openCents) })}
            </span>
          )}
        </div>
        <div style={{ ...styles.listItemBottomRow, marginTop: 2 }}>
          <span
            style={{
              ...styles.badge,
              background: status.bg,
              color: status.color,
            }}
          >
            <span style={{ ...styles.badgeDot, background: status.dot }} />
            {statusLabel}
          </span>
          {isPhotographer && attention && (
            <span style={styles.listItemHint}>
              <span style={styles.listItemHintDot} aria-hidden />
              {t(ATTENTION_LABEL[attention])}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
