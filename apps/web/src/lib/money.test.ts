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

/**
 * The pricing card renders the symbol and the digits as two separately styled
 * spans, so it cannot use a formatted string. It used to concatenate them in
 * source order — a hardcoded `€` in front of the number — which printed the
 * English form under German copy on the page that sells "built for the German
 * market". `symbolFirst` is what stops that: it reports where Intl actually
 * put the symbol rather than letting the markup decide once for every locale.
 */
describe('eurParts', () => {
  const en = getFormatters('en');
  const de = getFormatters('de');

  it('puts the symbol first in English and last in German', () => {
    expect(en.eurParts(1_900).symbolFirst).toBe(true);
    expect(de.eurParts(1_900).symbolFirst).toBe(false);
  });

  it('carries the locale separators on the digits', () => {
    expect(en.eurParts(124_000).value).toBe('1,240');
    expect(de.eurParts(124_000).value).toBe('1.240');
  });

  it('yields the symbol on its own, with no padding to trim', () => {
    expect(de.eurParts(1_900).symbol).toBe('€');
    expect(de.eurParts(1_900).value).toBe('19');
  });

  it('recomposes to the same text `eur` renders', () => {
    for (const f of [en, de]) {
      const { symbol, value, symbolFirst } = f.eurParts(124_000);
      const joined = symbolFirst ? `${symbol}${value}` : `${value} ${symbol}`;
      // Intl separates the German pair with U+00A0, not a plain space.
      expect(joined.replace(/\s/g, ' ')).toBe(f.eur(124_000).replace(/\s/g, ' '));
    }
  });

  it('treats a missing amount as zero rather than NaN', () => {
    expect(en.eurParts(null).value).toBe('0');
    expect(en.eurParts(undefined).value).toBe('0');
  });
});
