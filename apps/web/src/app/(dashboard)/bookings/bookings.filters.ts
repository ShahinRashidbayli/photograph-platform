import { parseApiDate } from '@/lib/date';
import { getBookingStatusMeta, toneToVisual } from '@/lib/booking-status';
import type { Booking } from '@/types/api';
import type { TranslationKey } from '@/lib/i18n';
import type { getBookingsColors } from './bookings.styles';

/**
 * Filtering, grouping and status presentation for the bookings list.
 *
 * <p>Pulled out of `page.tsx` because it is the only part of that screen that
 * is pure: given a booking and a date it always answers the same way, with no
 * React, no theme and no network. That makes it the part worth testing, and it
 * was previously unreachable from a test because it lived inside a 1,700-line
 * component file.
 */

export type FilterKey = 'all' | 'deposit' | 'confirmed' | 'pending' | 'completed';

export const FILTERS: { key: FilterKey; labelKey: TranslationKey }[] = [
  { key: 'all', labelKey: 'bookings.filter.all' },
  { key: 'deposit', labelKey: 'bookings.filter.awaitingPayment' },
  { key: 'confirmed', labelKey: 'bookings.filter.confirmed' },
  { key: 'pending', labelKey: 'bookings.filter.pending' },
  { key: 'completed', labelKey: 'bookings.filter.completed' },
];

export function matchesFilter(booking: Booking, filter: FilterKey): boolean {
  if (filter === 'all') return true;
  // Payment progress is a separate, derived field — "awaiting payment" means
  // invoiced-but-not-fully-paid, independent of lifecycle status.
  if (filter === 'deposit') {
    return (
      booking.paymentState === 'OPEN' ||
      booking.paymentState === 'PARTIALLY_PAID' ||
      booking.paymentState === 'OVERDUE'
    );
  }
  if (filter === 'confirmed') return booking.status === 'CONFIRMED';
  if (filter === 'pending') return booking.status === 'ENQUIRY';
  if (filter === 'completed') return booking.status === 'COMPLETED';
  return true;
}

export function filterCount(bookings: Booking[], filter: FilterKey): number {
  return bookings.filter((b) => matchesFilter(b, filter)).length;
}

// ─── Time grouping ─────────────────────────────────────────────────────────
// A flat chronological list gives no sense of urgency: "next Tuesday" and
// "next March" look identical until you read both dates. Rows are bucketed by
// how soon they are, and past shoots sink to the bottom rather than sitting at
// the top of a work queue.

export type GroupKey = 'thisWeek' | 'thisMonth' | 'later' | 'past';

export const GROUP_ORDER: GroupKey[] = ['thisWeek', 'thisMonth', 'later', 'past'];

export const GROUP_LABEL_KEY: Record<GroupKey, TranslationKey> = {
  thisWeek: 'bookings.group.thisWeek',
  thisMonth: 'bookings.group.thisMonth',
  later: 'bookings.group.later',
  past: 'bookings.group.past',
};

export function groupFor(eventDate: string, today: Date): GroupKey {
  const date = parseApiDate(eventDate);
  date.setHours(0, 0, 0, 0);
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return 'past';
  if (days <= 7) return 'thisWeek';
  if (days <= 31) return 'thisMonth';
  return 'later';
}

export type StatusVisual = {
  bg: string;
  color: string;
  dot: string;
  labelKey: TranslationKey;
};

export function getStatusVisual(
  status: string,
  c: ReturnType<typeof getBookingsColors>,
  variant: 'list' | 'detail' = 'list'
): StatusVisual {
  const meta = getBookingStatusMeta(status);
  const visual = toneToVisual(meta.tone, c);
  const labelKey =
    variant === 'detail' && meta.detailLabelKey ? meta.detailLabelKey : meta.labelKey;
  return { ...visual, labelKey };
}
