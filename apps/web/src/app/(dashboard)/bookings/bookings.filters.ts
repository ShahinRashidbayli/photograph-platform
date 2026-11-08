import { parseApiDate } from '@/lib/date';
import { getBookingStatusMeta, toneToVisual } from '@/lib/booking-status';
import type { Booking } from '@/types/api';
import type { TranslationKey } from '@/lib/i18n';
import type { getBookingsColors } from './bookings.styles';
import {
  attentionFor,
  isPast,
  isUpcoming,
  openBalanceCents,
  type BookingContext,
} from './bookings.insights';

/**
 * Filtering, grouping and status presentation for the bookings list.
 *
 * <p>Pulled out of `page.tsx` because it is the only part of that screen that
 * is pure: given a booking and a date it always answers the same way, with no
 * React, no theme and no network. That makes it the part worth testing, and it
 * was previously unreachable from a test because it lived inside a 1,700-line
 * component file.
 */

/**
 * The list's filters are questions a photographer asks, not status values:
 * "what is waiting on me", "what is coming", "who still owes me", "what is
 * done". The status names (Confirmed, Pending…) they replaced answered a
 * question nobody asks of a work queue.
 */
export type FilterKey = 'all' | 'needs' | 'upcoming' | 'unpaid' | 'past';

export const FILTERS: { key: FilterKey; labelKey: TranslationKey }[] = [
  { key: 'all', labelKey: 'bookings.filter.all' },
  { key: 'needs', labelKey: 'bookings.filter.needs' },
  { key: 'upcoming', labelKey: 'bookings.filter.upcoming' },
  { key: 'unpaid', labelKey: 'bookings.filter.unpaid' },
  { key: 'past', labelKey: 'bookings.filter.past' },
];

/**
 * Old `?status=` values from links and bookmarks made before the filters were
 * renamed, mapped onto the question each was closest to.
 */
const LEGACY_FILTER: Record<string, FilterKey> = {
  deposit: 'unpaid',
  pending: 'needs',
  confirmed: 'upcoming',
  completed: 'past',
};

export function parseFilter(raw: string | null): FilterKey {
  if (!raw) return 'all';
  if (FILTERS.some((f) => f.key === raw)) return raw as FilterKey;
  return LEGACY_FILTER[raw] ?? 'all';
}

export function matchesFilter(booking: Booking, filter: FilterKey, ctx: BookingContext): boolean {
  switch (filter) {
    case 'needs':
      return attentionFor(booking, ctx) !== null;
    case 'upcoming':
      return isUpcoming(booking, ctx.today);
    case 'unpaid':
      return openBalanceCents(booking) > 0;
    case 'past':
      return isPast(booking, ctx.today);
    default:
      return true;
  }
}

export function filterCount(
  bookings: Booking[],
  filter: FilterKey,
  ctxFor: (_booking: Booking) => BookingContext
): number {
  return bookings.filter((b) => matchesFilter(b, filter, ctxFor(b))).length;
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
