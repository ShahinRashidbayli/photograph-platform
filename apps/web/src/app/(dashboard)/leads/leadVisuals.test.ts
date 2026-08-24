import { daysUntilEvent, getUrgencyVisual } from './leadVisuals';
import { getColors } from '@/lib/design-tokens';

const colors = getColors('light');

describe('daysUntilEvent', () => {
  /**
   * The crash this exists for: `leads.event_date` is nullable — "what does
   * this cost?" is an ordinary enquiry — but the function took a plain string
   * and went straight to `.getTime()`, so the first dateless lead in the inbox
   * took the whole page down.
   */
  it('returns null for an enquiry with no date', () => {
    expect(daysUntilEvent(null)).toBeNull();
    expect(daysUntilEvent(undefined)).toBeNull();
    expect(daysUntilEvent('')).toBeNull();
  });

  it('treats an unparseable date as unknown rather than crashing', () => {
    expect(daysUntilEvent('not-a-date')).toBeNull();
  });

  it('counts forward to a future date', () => {
    const inTenDays = new Date();
    inTenDays.setDate(inTenDays.getDate() + 10);
    const iso = inTenDays.toISOString().slice(0, 10);

    // Rounding lands on 10 or 11 depending on the time of day the suite runs.
    expect(daysUntilEvent(iso)).toBeGreaterThanOrEqual(10);
    expect(daysUntilEvent(iso)).toBeLessThanOrEqual(11);
  });

  it('goes negative for a date that has passed', () => {
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    expect(daysUntilEvent(tenDaysAgo.toISOString().slice(0, 10))).toBeLessThan(0);
  });
});

describe('getUrgencyVisual', () => {
  /**
   * "No date" and "already happened" are different facts. Sharing the neutral
   * palette is fine; sharing the label would tell the photographer an event
   * has passed when none was ever scheduled.
   */
  it('distinguishes a missing date from a past one', () => {
    expect(getUrgencyVisual(null, colors).labelKey).toBe('leadUrgency.noDate');
    expect(getUrgencyVisual(-3, colors).labelKey).toBe('leadUrgency.past');
  });

  it('escalates as the date approaches', () => {
    expect(getUrgencyVisual(10, colors).color).toBe(colors.dangerText);
    expect(getUrgencyVisual(45, colors).color).toBe(colors.warningText);
    expect(getUrgencyVisual(120, colors).color).toBe(colors.primaryStrong);
  });

  it('always returns a usable palette, whatever it is given', () => {
    for (const days of [null, -100, 0, 1, 29, 30, 59, 60, 10_000]) {
      const v = getUrgencyVisual(days, colors);
      expect(v.bg).toBeTruthy();
      expect(v.color).toBeTruthy();
      expect(v.dot).toBeTruthy();
      expect(v.labelKey).toBeTruthy();
    }
  });
});
