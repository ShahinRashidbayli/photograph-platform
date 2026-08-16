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
  const number = new Intl.NumberFormat(tag);

  const dates = Object.fromEntries(
    Object.entries(DATE_STYLES).map(([name, options]) => [
      name,
      new Intl.DateTimeFormat(tag, options),
    ]),
  ) as Record<DateStyleName, Intl.DateTimeFormat>;

  const formatters = {
    eur: (cents: number | null | undefined) => currency.format((cents ?? 0) / 100),
    number: (value: number) => number.format(value),
    monthAbbrUpper: (value: DateInput) =>
      dates.monthAbbr.format(asDate(value)).toUpperCase(),
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
