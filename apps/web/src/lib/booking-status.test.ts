import { isNotHappening } from '@/lib/booking-status';

/**
 * The web's one definition of Not happening (GLOSSARY.md), the same set as the
 * backend `BookingStatus`. Billable is not defined here at all: money is the
 * server's rule (ADR-004).
 */
describe('booking status groups', () => {
  it('treats only cancelled and declined bookings as Not happening', () => {
    expect(isNotHappening('CANCELLED')).toBe(true);
    expect(isNotHappening('DECLINED')).toBe(true);

    expect(isNotHappening('ENQUIRY')).toBe(false);
    expect(isNotHappening('CONFIRMED')).toBe(false);
    expect(isNotHappening('POSTPONED')).toBe(false);
    expect(isNotHappening('COMPLETED')).toBe(false);
  });
});
