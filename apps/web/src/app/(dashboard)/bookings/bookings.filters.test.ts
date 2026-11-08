import { FILTERS, filterCount, groupFor, matchesFilter, parseFilter } from './bookings.filters';
import type { BookingContext } from './bookings.insights';
import type { Contract } from '@/hooks/useContracts';
import type { Booking } from '@/types/api';

/**
 * Until this logic was extracted it lived inside a 1,700-line component file
 * and could not be reached from a test — so the rules deciding which bookings a
 * photographer sees in their work queue had no coverage at all.
 */

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'bk-1',
    clientName: 'Maria Kellner',
    clientEmail: 'maria@example.test',
    eventDate: '2026-12-01',
    totalAmountCents: 119_000,
    depositAmountCents: 30_000,
    status: 'CONFIRMED',
    paymentState: 'NOT_INVOICED',
    amountPaidCents: 0,
    createdAt: '2026-08-01T10:00:00Z',
    ...overrides,
  };
}

// A fixed "today" (Sunday 8 Nov 2026) so nothing depends on when the suite runs.
const TODAY = new Date(2026, 10, 8);

function ctx(overrides: Partial<BookingContext> = {}): BookingContext {
  return { today: TODAY, contract: null, gallery: null, contractsEnabled: true, ...overrides };
}

describe('matchesFilter', () => {
  it('lets everything through on "all"', () => {
    expect(matchesFilter(booking({ status: 'CANCELLED' }), 'all', ctx())).toBe(true);
  });

  /**
   * "Unpaid" is what the client still owes on an agreed booking. An enquiry
   * owes nothing yet and a cancelled booking owes nothing any more — counting
   * either sends the photographer chasing money nobody agreed to.
   */
  it('counts an agreed booking with money outstanding as unpaid', () => {
    expect(matchesFilter(booking({ amountPaidCents: 30_000 }), 'unpaid', ctx())).toBe(true);
    expect(
      matchesFilter(booking({ status: 'COMPLETED', amountPaidCents: 0 }), 'unpaid', ctx())
    ).toBe(true);
  });

  it.each(['ENQUIRY', 'CANCELLED', 'DECLINED'] as const)('never counts %s as unpaid', (status) => {
    expect(matchesFilter(booking({ status }), 'unpaid', ctx())).toBe(false);
  });

  it('does not count a fully paid booking as unpaid', () => {
    expect(
      matchesFilter(booking({ amountPaidCents: 119_000, paymentState: 'PAID' }), 'unpaid', ctx())
    ).toBe(false);
  });

  it('splits upcoming and past at today', () => {
    expect(matchesFilter(booking({ eventDate: '2026-11-08' }), 'upcoming', ctx())).toBe(true);
    expect(matchesFilter(booking({ eventDate: '2026-11-07' }), 'upcoming', ctx())).toBe(false);
    expect(matchesFilter(booking({ eventDate: '2026-11-07' }), 'past', ctx())).toBe(true);
    // Completed is past even if it was closed before the date.
    expect(
      matchesFilter(booking({ status: 'COMPLETED', eventDate: '2026-12-01' }), 'past', ctx())
    ).toBe(true);
  });

  it('puts enquiries, shoots to close and unsigned contracts under "needs you"', () => {
    expect(matchesFilter(booking({ status: 'ENQUIRY' }), 'needs', ctx())).toBe(true);
    expect(matchesFilter(booking({ eventDate: '2026-11-05' }), 'needs', ctx())).toBe(true);
    const sent = { status: 'SENT', sentAt: '2026-11-03T10:00:00Z' } as Contract;
    expect(matchesFilter(booking(), 'needs', ctx({ contract: sent }))).toBe(true);
    expect(matchesFilter(booking(), 'needs', ctx())).toBe(false);
  });

  it('offers the five questions in order', () => {
    expect(FILTERS.map((f) => f.key)).toEqual(['all', 'needs', 'upcoming', 'unpaid', 'past']);
  });
});

describe('parseFilter', () => {
  // Links and bookmarks made before the rename keep landing somewhere sensible.
  it('maps the old status filters onto the new questions', () => {
    expect(parseFilter('deposit')).toBe('unpaid');
    expect(parseFilter('pending')).toBe('needs');
    expect(parseFilter('confirmed')).toBe('upcoming');
    expect(parseFilter('completed')).toBe('past');
  });

  it('falls back to "all" for anything unknown', () => {
    expect(parseFilter(null)).toBe('all');
    expect(parseFilter('nonsense')).toBe('all');
    expect(parseFilter('needs')).toBe('needs');
  });
});

describe('filterCount', () => {
  it('counts only the matching bookings', () => {
    const list = [
      booking({ id: '1', status: 'CONFIRMED' }),
      booking({ id: '2', status: 'ENQUIRY' }),
      booking({ id: '3', status: 'CONFIRMED', eventDate: '2026-10-01' }),
    ];

    expect(filterCount(list, 'needs', () => ctx())).toBe(2);
    expect(filterCount(list, 'upcoming', () => ctx())).toBe(2);
    expect(filterCount(list, 'all', () => ctx())).toBe(3);
    expect(filterCount([], 'all', () => ctx())).toBe(0);
  });
});

describe('groupFor', () => {
  // A fixed "today" so these never depend on when the suite runs.
  const today = new Date(2026, 7, 20);
  today.setHours(0, 0, 0, 0);

  const iso = (year: number, month: number, day: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  it('puts a shoot that already happened in the past', () => {
    expect(groupFor(iso(2026, 8, 19), today)).toBe('past');
  });

  /** Today is this week, not past — the boundary that decides whether a shoot
   * happening in a few hours sinks to the bottom of the queue. */
  it('treats today as this week', () => {
    expect(groupFor(iso(2026, 8, 20), today)).toBe('thisWeek');
  });

  it('spans exactly seven days for this week', () => {
    expect(groupFor(iso(2026, 8, 27), today)).toBe('thisWeek');
    expect(groupFor(iso(2026, 8, 28), today)).toBe('thisMonth');
  });

  it('spans 31 days for this month, then later', () => {
    expect(groupFor(iso(2026, 9, 20), today)).toBe('thisMonth');
    expect(groupFor(iso(2026, 9, 21), today)).toBe('later');
  });

  it('handles a date well into the future', () => {
    expect(groupFor(iso(2027, 6, 1), today)).toBe('later');
  });
});
