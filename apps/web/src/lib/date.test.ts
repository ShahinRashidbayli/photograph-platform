import { parseApiDate, startOfToday } from './date';

describe('parseApiDate', () => {
  it('reads a date-only string as local midnight, not UTC midnight', () => {
    const d = parseApiDate('2026-08-21');

    // Together these two assertions fail under the old `new Date(iso)`
    // implementation in every timezone except exactly UTC: east of Greenwich
    // the UTC instant lands at 01:00/02:00 local (so getHours() !== 0), and
    // west of it the calendar day rolls back (so getDate() === 20).
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7); // August, zero-indexed
    expect(d.getDate()).toBe(21);
    expect(d.getHours()).toBe(0);
  });

  it('keeps the calendar day stable across a year boundary', () => {
    const d = parseApiDate('2027-01-01');
    expect(d.getFullYear()).toBe(2027);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });

  it('passes timestamps through untouched', () => {
    // Full timestamps carry an offset and are already unambiguous — parsing
    // them by hand would be wrong.
    const iso = '2026-08-21T14:30:00Z';
    expect(parseApiDate(iso).getTime()).toBe(new Date(iso).getTime());
  });

  it('returns a Date argument unchanged', () => {
    const d = new Date(2026, 7, 21);
    expect(parseApiDate(d)).toBe(d);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseApiDate('  2026-08-21 ').getDate()).toBe(21);
  });

  it('compares correctly against startOfToday for a shoot happening today', () => {
    // The regression this guards: with UTC parsing, today's own shoot sorted
    // as past west of Greenwich and dropped out of the "upcoming" lists.
    const today = startOfToday();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate(),
    ).padStart(2, '0')}`;

    expect(parseApiDate(iso).getTime()).toBe(today.getTime());
    expect(parseApiDate(iso) >= today).toBe(true);
  });
});
