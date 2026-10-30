import { FILTERS, filterCount, groupFor, matchesFilter } from './bookings.filters';
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

describe('matchesFilter', () => {
  it('lets everything through on "all"', () => {
    expect(matchesFilter(booking({ status: 'CANCELLED' }), 'all')).toBe(true);
  });

  /**
   * "Awaiting payment" is derived from the invoice/payment rows, not from the
   * lifecycle status — a CONFIRMED booking with nothing invoiced owes nothing
   * yet, and showing it as awaiting payment sends the photographer chasing
   * money they never asked for.
   */
  it.each(['OPEN', 'PARTIALLY_PAID', 'OVERDUE'] as const)(
    'counts %s as awaiting payment',
    (paymentState) => {
      expect(matchesFilter(booking({ paymentState }), 'deposit')).toBe(true);
    }
  );

  it.each(['NOT_INVOICED', 'PAID'] as const)(
    'does not count %s as awaiting payment',
    (paymentState) => {
      expect(matchesFilter(booking({ paymentState }), 'deposit')).toBe(false);
    }
  );

  it('ignores lifecycle status when filtering on payment', () => {
    expect(matchesFilter(booking({ status: 'ENQUIRY', paymentState: 'OPEN' }), 'deposit')).toBe(
      true
    );
    expect(
      matchesFilter(booking({ status: 'CONFIRMED', paymentState: 'NOT_INVOICED' }), 'deposit')
    ).toBe(false);
  });

  it('matches the lifecycle filters exactly', () => {
    expect(matchesFilter(booking({ status: 'CONFIRMED' }), 'confirmed')).toBe(true);
    expect(matchesFilter(booking({ status: 'ENQUIRY' }), 'pending')).toBe(true);
    expect(matchesFilter(booking({ status: 'COMPLETED' }), 'completed')).toBe(true);
    expect(matchesFilter(booking({ status: 'COMPLETED' }), 'confirmed')).toBe(false);
  });

  it('exposes one filter per tab, "all" first', () => {
    expect(FILTERS[0].key).toBe('all');
    expect(FILTERS.map((f) => f.key)).toEqual([
      'all',
      'deposit',
      'confirmed',
      'pending',
      'completed',
    ]);
  });
});

describe('filterCount', () => {
  it('counts only the matching bookings', () => {
    const list = [
      booking({ id: '1', status: 'CONFIRMED' }),
      booking({ id: '2', status: 'ENQUIRY' }),
      booking({ id: '3', status: 'CONFIRMED' }),
    ];

    expect(filterCount(list, 'confirmed')).toBe(2);
    expect(filterCount(list, 'pending')).toBe(1);
    expect(filterCount(list, 'all')).toBe(3);
    expect(filterCount([], 'all')).toBe(0);
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
