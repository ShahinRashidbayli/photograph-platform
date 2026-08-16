import { DATE_PATTERNS, displayToIso, isoToDisplay } from './DateField';

/**
 * The date field parses and formats by hand because `<input type="date">`
 * renders in the *browser's* language rather than the app's. That trade buys
 * a consistent UI and costs us the browser's parser, so the parser we replaced
 * it with is worth pinning down — especially the cases a naive implementation
 * gets wrong (rollover dates, locale field order, mixed separators).
 */
const en = DATE_PATTERNS.en;
const de = DATE_PATTERNS.de;

describe('displayToIso', () => {
  it('reads the locale field order', () => {
    // Same digits, different meaning: 03/04 is 4 March in en, 3 April in de.
    expect(displayToIso('03/04/2026', en)).toBe('2026-03-04');
    expect(displayToIso('03.04.2026', de)).toBe('2026-04-03');
  });

  it('accepts any separator, because people type and paste both', () => {
    expect(displayToIso('31-12-2026', de)).toBe('2026-12-31');
    expect(displayToIso('31/12/2026', de)).toBe('2026-12-31');
  });

  it('passes an ISO string straight through', () => {
    expect(displayToIso('2026-12-31', en)).toBe('2026-12-31');
  });

  it('pads single-digit input', () => {
    expect(displayToIso('1.2.2026', de)).toBe('2026-02-01');
  });

  it('rejects dates that do not exist instead of rolling over', () => {
    // `new Date(2025, 1, 29)` silently becomes 1 March — the classic bug.
    expect(displayToIso('29.02.2025', de)).toBeNull();
    expect(displayToIso('31.04.2026', de)).toBeNull();
    expect(displayToIso('13/01/2026', en)).toBeNull();
  });

  it('accepts a real leap day', () => {
    expect(displayToIso('29.02.2028', de)).toBe('2028-02-29');
  });

  it('returns null for incomplete or non-numeric input', () => {
    expect(displayToIso('', de)).toBeNull();
    expect(displayToIso('31.12', de)).toBeNull();
    expect(displayToIso('tomorrow', en)).toBeNull();
  });
});

describe('isoToDisplay', () => {
  it('formats into the locale pattern', () => {
    expect(isoToDisplay('2026-12-31', en)).toBe('12/31/2026');
    expect(isoToDisplay('2026-12-31', de)).toBe('31.12.2026');
  });

  it('renders an empty string for a missing or malformed value', () => {
    expect(isoToDisplay('', de)).toBe('');
    expect(isoToDisplay('2026-12', de)).toBe('');
  });

  it('round-trips with the parser in both locales', () => {
    for (const pattern of [en, de]) {
      expect(displayToIso(isoToDisplay('2026-08-16', pattern), pattern)).toBe('2026-08-16');
    }
  });
});
