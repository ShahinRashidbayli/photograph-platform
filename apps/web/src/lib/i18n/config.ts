/**
 * Locale registry — the one place a new language is declared.
 *
 * Adding one is: add the code here, add a `locales/<code>/` folder mirroring
 * `locales/en/`, and register it in `locales/index.ts`. TypeScript then fails
 * the build until every namespace is translated, and `npm run i18n:check`
 * verifies the interpolation placeholders line up.
 */
export const LOCALES = ['en', 'de'] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * English is the source of truth: its keys define `TranslationKey`, and it is
 * the fallback whenever another locale is missing a string at runtime.
 */
export const SOURCE_LOCALE: Locale = 'en';

/**
 * BCP-47 tags handed to the `Intl` APIs (dates, currency, plural rules). Kept
 * apart from the locale code because a UI language and a formatting region are
 * not the same thing — a future `de-AT` would share the `de` dictionary but
 * format differently.
 */
export const INTL_LOCALE: Record<Locale, string> = {
  en: 'en-US',
  de: 'de-DE',
};

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
