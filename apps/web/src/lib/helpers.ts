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

/**
 * Today as `YYYY-MM-DD` in the **local** timezone — the format `<input
 * type="date">` speaks, so it can be compared to a field value directly.
 *
 * Not `new Date().toISOString().slice(0, 10)`: that converts to UTC first, so
 * anywhere east of Greenwich the early hours of the morning report yesterday,
 * and "no bookings in the past" would reject today's date until 04:00.
 */
export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function insertSortedByDate<T extends { eventDate: string }>(
  list: T[],
  item: T,
): T[] {
  return [...list, item].sort((a, b) => a.eventDate.localeCompare(b.eventDate));
}

/**
 * WhatsApp deep link for a phone number as the photographer typed it.
 *
 * `wa.me` wants the full international number with no `+` and no separators.
 * Stripping non-digits alone is not enough: German contacts are almost always
 * captured in national format (`0170 1234567`), and `01701234567` makes
 * WhatsApp reject the link as an invalid number — so the common domestic case
 * was the broken one.
 *
 * Conversions applied, in order:
 *   `+49…` / `0049…` → `49…`  (already international)
 *   `0170…`          → `49170…` (national trunk `0` → the default country code)
 *
 * The default country code is an assumption; it is correct for this product's
 * market (German studios, EUR, DATEV/GoBD) and only applies to numbers that
 * carry no country code of their own.
 */
const DEFAULT_COUNTRY_CODE = '49';

export function whatsappHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  let msisdn = digits;
  if (trimmed.startsWith('+')) {
    // Already international — the leading + is simply dropped.
    msisdn = digits;
  } else if (digits.startsWith('00')) {
    msisdn = digits.slice(2);
  } else if (digits.startsWith('0')) {
    msisdn = DEFAULT_COUNTRY_CODE + digits.slice(1);
  }
  // Shortest plausible E.164 subscriber number; below this it isn't dialable.
  return msisdn.length >= 8 ? `https://wa.me/${msisdn}` : null;
}

/**
 * The total the backend will actually store, in cents, given what the form
 * currently holds.
 *
 * Mirrors `BookingService#resolvePrice`: an explicit amount wins; otherwise a
 * linked package supplies the price; otherwise it's zero. The booking forms
 * need this because they validate `deposit <= total` locally, and reading a
 * blank total as `0` made them reject a perfectly valid booking — pick a
 * €1,800 package, leave the total blank so the server prices it, enter a €500
 * deposit, and the form refused with "deposit cannot exceed the total amount"
 * against a total the user never set and the server would never have used.
 */
export function resolveTotalCents(
  totalInput: string,
  packageId: string | null | undefined,
  packages: ReadonlyArray<{ id: string; priceCents: number }>,
): number {
  const typed = totalInput.trim();
  if (typed) return eurosToCents(totalInput);
  if (!packageId) return 0;
  return packages.find((p) => p.id === packageId)?.priceCents ?? 0;
}
