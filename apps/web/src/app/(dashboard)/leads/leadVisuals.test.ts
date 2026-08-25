import { daysUntilEvent, getUrgencyVisual } from './leadVisuals';
import { getColors } from '@/lib/design-tokens';

const colors = getColors('light');

/**
 * A date-only string `days` from now, built from **local** components.
 *
 * `toISOString().slice(0, 10)` is the obvious way to write this, and it is the
 * exact trap `parseApiDate` and `todayIso` exist to document: a bare date-only
 * string is UTC. East of Greenwich, between local midnight and the offset, it
 * names the *previous* day — so this suite failed every night between 00:00
 * and 04:00 in Baku, one day short and looking like a real regression. West of
 * Greenwich it is the mirror image, late in the evening.
 *
 * Building the string the way the API writes it makes the count exact at any
 * hour: the target is local midnight, so the difference is always just under
 * `days`, and `Math.ceil` lands on `days` whatever time the suite runs.
 */
function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

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
    expect(daysUntilEvent(isoDaysFromNow(10))).toBe(10);
    expect(daysUntilEvent(isoDaysFromNow(1))).toBe(1);
  });

  /**
   * A shoot happening today is not "in n days". `Math.ceil` of the fraction of
   * today already elapsed gives `-0`, which every caller reads as zero —
   * `getUrgencyVisual` compares with `<= 0` — so this asserts the sign and the
   * label rather than the identity: `Object.is(-0, 0)` is false and `toBe(0)`
   * would fail on a value that behaves correctly everywhere it is used.
   */
  it('does not count a shoot happening today as a day away', () => {
    const today = daysUntilEvent(isoDaysFromNow(0));

    expect(today).not.toBeNull();
    expect(today as number).toBeLessThanOrEqual(0);
    expect(getUrgencyVisual(today, colors).labelKey).toBe('leadUrgency.past');
  });

  it('goes negative for a date that has passed', () => {
    expect(daysUntilEvent(isoDaysFromNow(-10))).toBeLessThan(0);
    expect(daysUntilEvent(isoDaysFromNow(-1))).toBeLessThan(0);
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
