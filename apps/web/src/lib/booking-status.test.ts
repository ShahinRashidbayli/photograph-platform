import { isBillable, isNotHappening } from '@/lib/booking-status';

/**
 * The web's one definition of Billable and Not happening (GLOSSARY.md), the
 * same sets as the backend `BookingStatus`. The dashboard once counted an
 * enquiry's quote as revenue because Billable was read as "not cancelled",
 * while the bookings overview kept its own stricter copy and disagreed.
 */
describe('booking status groups', () => {
  it('counts only confirmed, postponed and completed bookings as Billable', () => {
    expect(isBillable('CONFIRMED')).toBe(true);
    expect(isBillable('POSTPONED')).toBe(true);
    expect(isBillable('COMPLETED')).toBe(true);

    expect(isBillable('ENQUIRY')).toBe(false);
    expect(isBillable('DECLINED')).toBe(false);
    expect(isBillable('CANCELLED')).toBe(false);
  });

  it('treats only cancelled and declined bookings as Not happening', () => {
    expect(isNotHappening('CANCELLED')).toBe(true);
    expect(isNotHappening('DECLINED')).toBe(true);

    expect(isNotHappening('ENQUIRY')).toBe(false);
    expect(isNotHappening('CONFIRMED')).toBe(false);
    expect(isNotHappening('POSTPONED')).toBe(false);
    expect(isNotHappening('COMPLETED')).toBe(false);
  });
});
