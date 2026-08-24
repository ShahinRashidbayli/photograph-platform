/**
 * i18n public API. Import from `@/lib/i18n` — the internals (locale files,
 * Intl plumbing) are free to move behind it.
 *
 *   const { t, tPlural, format, lang } = useTranslation();
 *   t('bookings.title')                        → "Buchungen"
 *   t('dashboard.welcome', { name })           → "Willkommen zurück, Anna"
 *   tPlural('clients.bookingCount', n)         → "3 Buchungen"
 *   format.eur(cents) / format.dayMonth(iso)   → locale-aware
 *
 * Adding a language: see `config.ts`.
 */
export { useTranslation, type PluralKey, type TranslateParams } from './useTranslation';
export { getFormatters, type Formatters, type DateInput } from './format';
export {
  LOCALES,
  SOURCE_LOCALE,
  DEFAULT_LOCALE,
  INTL_LOCALE,
  isLocale,
  type Locale,
} from './config';
export { dictionaries, en, type TranslationKey } from './locales';
