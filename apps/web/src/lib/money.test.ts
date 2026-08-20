import { getFormatters } from '@/lib/i18n/format';

/**
 * `eur` rounds to whole euros — deliberately, for dashboard summaries — which
 * makes it the wrong formatter for anything transactional. These tests pin the
 * distinction, because the failure mode is silent and expensive: a Pay button
 * reading "€1,235" that debits €1,234.56, or an invoice line that does not add
 * up to its own total.
 */
describe('currency formatting', () => {
  const en = getFormatters('en');
  const de = getFormatters('de');

  it('eur rounds to whole euros', () => {
    expect(en.eur(123_456)).not.toContain('.56');
    expect(en.eur(99)).toBe(en.eur(100));
  });

  it('eurExact keeps the cents', () => {
    expect(en.eurExact(123_456)).toBe('€1,234.56');
    expect(en.eurExact(99)).toBe('€0.99');
  });

  it('eurExact always shows two decimals, even on round amounts', () => {
    expect(en.eurExact(120_000)).toBe('€1,200.00');
  });

  it('eurExact follows the locale, not just the language', () => {
    // German writes the symbol last and swaps the separators — a client
    // reading "1.234,56 €" must not be shown the English form.
    expect(de.eurExact(123_456)).toContain('1.234,56');
    expect(de.eurExact(123_456)).toContain('€');
  });

  it('treats a missing amount as zero rather than NaN', () => {
    expect(en.eurExact(null)).toBe('€0.00');
    expect(en.eurExact(undefined)).toBe('€0.00');
  });

  it('formats a negative total, as a Storno invoice carries', () => {
    expect(en.eurExact(-120_000)).toContain('1,200.00');
    expect(en.eurExact(-120_000)).toMatch(/-|−/);
  });
});
