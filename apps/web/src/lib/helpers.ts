import { getFormatters, type DateInput } from '@/lib/i18n/format';
import { SOURCE_LOCALE } from '@/lib/i18n/config';

// ── Date & money display (source-locale only) ───────────────────────────────
// These delegate to the i18n formatters pinned to the SOURCE locale, and exist
// for the surfaces that are not translated yet (payments, galleries, the client
// landing). Inside a translated component use `useTranslation().format`, which
// follows the language the user actually picked — these helpers cannot, because
// they are plain functions with no access to the store.
//
// When the last untranslated page migrates, delete this block.
const source = getFormatters(SOURCE_LOCALE);

/** @deprecated Prefer `useTranslation().format.eur` — this one never localises. */
export const formatEUR = source.eur;
/** @deprecated Prefer `useTranslation().format.monthAbbr`. */
export const formatMonthAbbr = source.monthAbbr;
/** @deprecated Prefer `useTranslation().format.monthAbbrUpper`. */
export const formatMonthAbbrUpper = source.monthAbbrUpper;
/** @deprecated Prefer `useTranslation().format.dayMonth`. */
export const formatDayMonth = source.dayMonth;
/** @deprecated Prefer `useTranslation().format.monthDay`. */
export const formatMonthDay = source.monthDay;
/** @deprecated Prefer `useTranslation().format.monthYear`. */
export const formatMonthYear = source.monthYear;
/** @deprecated Prefer `useTranslation().format.monthDayYear`. */
export const formatMonthDayYear = source.monthDayYear;
/** @deprecated Prefer `useTranslation().format.dayMonthYearLong`. */
export const formatDayMonthYearLong = source.dayMonthYearLong;
/** @deprecated Prefer `useTranslation().format.fullDate`. */
export const formatFullDate = source.fullDate;
/** @deprecated Prefer `useTranslation().format.dateTime`. */
export const formatDateTime = source.dateTime;

export type { DateInput };

export function extractApiError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { error?: string } } })
    ?.response?.data?.error;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

export function eurosToCents(value: string): number {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function insertSortedByDate<T extends { eventDate: string }>(
  list: T[],
  item: T,
): T[] {
  return [...list, item].sort((a, b) => a.eventDate.localeCompare(b.eventDate));
}
