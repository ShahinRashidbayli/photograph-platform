import { INTL_LOCALE, type Locale } from './config';
import { parseApiDate } from '@/lib/date';

/**
 * Locale-aware date, number and currency formatting.
 *
 * Replaces the old module-level `DATE_LOCALE = 'en-US'` pin in `lib/helpers`:
 * dates and money now follow the active UI language, so a German UI no longer
 * renders "Fri, Aug 21, 2026" next to German prose.
 *
 * `Intl` formatters are expensive to construct, so one set is built per locale
 * and reused for the life of the page.
 */
export type DateInput = string | Date;

// Date-only strings must be read as local, not UTC — see parseApiDate.
const asDate = (value: DateInput): Date => parseApiDate(value);

type DateStyle = Intl.DateTimeFormatOptions;

const DATE_STYLES = {
  monthAbbr: { month: 'short' },
  dayMonth: { day: 'numeric', month: 'short' },
  monthDay: { month: 'short', day: 'numeric' },
  monthYear: { month: 'short', year: 'numeric' },
  monthDayYear: { month: 'short', day: 'numeric', year: 'numeric' },
  dayMonthYearLong: { day: 'numeric', month: 'long', year: 'numeric' },
  fullDate: { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' },
  dateTime: {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  },
} satisfies Record<string, DateStyle>;

type DateStyleName = keyof typeof DATE_STYLES;

export type Formatters = {
  /** Whole-euro currency, e.g. "€1,730" (en) / "1.730 €" (de). */
  eur: (_cents: number | null | undefined) => string;
  /**
   * Currency to the cent, e.g. "€1,730.50" / "1.730,50 €".
   *
   * Use this anywhere the figure is a legal or transactional amount — an
   * invoice line, a total, the label on a Pay button. {@link eur} rounds to
   * whole euros, which is fine for a dashboard summary but wrong on a document
   * or a charge: it would print €1,235 next to a button that debits €1,234.56.
   */
  eurExact: (_cents: number | null | undefined) => string;
  /**
   * {@link eur}, split into the symbol and the digits.
   *
   * <p>For the one place that cannot use a formatted string: the pricing card
   * sets the amount in display-size serif and the € in a small superscript, so
   * it needs the two halves separately. Composing them by hand is what put a
   * hardcoded `€` in front of a German price — `formatToParts` reports the
   * order Intl actually chose, so `symbolFirst` decides which side it lands on
   * instead of the markup deciding for every locale at once.
   */
  eurParts: (_cents: number | null | undefined) => {
    symbol: string;
    value: string;
    symbolFirst: boolean;
  };
  /** Plain number with locale grouping — used for interpolated counts. */
  number: (_value: number) => string;
} & Record<DateStyleName, (_value: DateInput) => string> & {
    /** "JUL" — the uppercase month used on date pills. */
    monthAbbrUpper: (_value: DateInput) => string;
  };

const cache = new Map<Locale, Formatters>();

function build(locale: Locale): Formatters {
  const tag = INTL_LOCALE[locale];

  const currency = new Intl.NumberFormat(tag, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });
  const currencyExact = new Intl.NumberFormat(tag, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const number = new Intl.NumberFormat(tag);

  const dates = Object.fromEntries(
    Object.entries(DATE_STYLES).map(([name, options]) => [
      name,
      new Intl.DateTimeFormat(tag, options),
    ])
  ) as Record<DateStyleName, Intl.DateTimeFormat>;

  const formatters = {
    eur: (cents: number | null | undefined) => currency.format((cents ?? 0) / 100),
    eurExact: (cents: number | null | undefined) => currencyExact.format((cents ?? 0) / 100),
    eurParts: (cents: number | null | undefined) => {
      const parts = currency.formatToParts((cents ?? 0) / 100);
      const symbol = parts.find((p) => p.type === 'currency')?.value ?? '€';
      // Everything that is not the symbol — digits, grouping separators and
      // the sign — keeps Intl's own ordering. The literal space German puts
      // between number and symbol is dropped: the two halves are laid out by
      // the card's flex gap, and a stray leading space would offset the digits.
      const value = parts
        .filter((p) => p.type !== 'currency' && p.type !== 'literal')
        .map((p) => p.value)
        .join('');
      return {
        symbol,
        value,
        symbolFirst: parts.findIndex((p) => p.type === 'currency') === 0,
      };
    },
    number: (value: number) => number.format(value),
    monthAbbrUpper: (value: DateInput) => dates.monthAbbr.format(asDate(value)).toUpperCase(),
  } as Formatters;

  for (const name of Object.keys(DATE_STYLES) as DateStyleName[]) {
    formatters[name] = (value: DateInput) => dates[name].format(asDate(value));
  }

  return formatters;
}

/** Formatters for a locale, built once and cached. */
export function getFormatters(locale: Locale): Formatters {
  const hit = cache.get(locale);
  if (hit) return hit;
  const built = build(locale);
  cache.set(locale, built);
  return built;
}
