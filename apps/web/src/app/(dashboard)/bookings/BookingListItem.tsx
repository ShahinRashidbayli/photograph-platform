'use client';

import React from 'react';
import { parseApiDate } from '@/lib/date';
import { getCustomerBookingStatusLabelKey } from '@/lib/booking-status';
import { useTranslation } from '@/lib/i18n';
import type { Booking } from '@/types/api';
import { getStatusVisual } from './bookings.filters';
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
}: ListItemProps) {
  const { t, format } = useTranslation();
  const date = parseApiDate(booking.eventDate);
  const month = format.monthAbbrUpper(date);
  const day = date.getDate();
  const status = getStatusVisual(booking.status, colors, 'list');
  // The photographer's list is client-first (whose booking is it); the client's
  // own list is session-first (what/where), since every row is theirs.
  const remaining = Math.max(booking.totalAmountCents - (booking.amountPaidCents ?? 0), 0);
  const title = isPhotographer
    ? booking.clientName
    : (booking.eventType ?? t('bookings.sessionFallback'));
  const deadlineDate = !isPhotographer && remaining > 0 ? format.dayMonth(booking.eventDate) : null;
  const metaText = isPhotographer
    ? [
        booking.eventType ?? t('bookings.sessionFallback'),
        booking.status === 'ENQUIRY' ? t('bookings.awaitingDeposit') : booking.location,
      ]
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
      // Hover is a pure CSS-style toggle done via direct DOM mutation, not React
      // state — keeping it out of state means hovering a row no longer re-renders
      // the whole page (and every other row) on each mouse-enter/leave.
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = colors.surfaceHover;
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = 'transparent';
      }}
      style={{
        ...styles.listItem,
        ...(isActive ? styles.listItemActive : {}),
      }}
      aria-current={isActive ? 'true' : undefined}
    >
      <div style={styles.listItemDate}>
        <span style={styles.listItemDateMonth}>{month}</span>
        <span style={styles.listItemDateDay}>{day}</span>
      </div>
      <div style={styles.listItemContent}>
        <div style={styles.listItemTopRow}>
          <span style={styles.listItemName}>{title}</span>
          <span style={styles.listItemAmount}>{format.eur(booking.totalAmountCents)}</span>
        </div>
        <div style={styles.listItemBottomRow}>
          <span style={styles.listItemMeta}>{metaText}</span>
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
        </div>
      </div>
    </button>
  );
}
