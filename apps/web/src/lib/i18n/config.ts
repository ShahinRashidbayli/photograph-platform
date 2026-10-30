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
 *
 * This is a fact about the dictionaries, not a product decision — see
 * {@link DEFAULT_LOCALE} for the language people actually see.
 */
export const SOURCE_LOCALE: Locale = 'en';

/**
 * The language a visitor gets before they express a preference.
 *
 * German, because that is the market: the product is sold on a `.de` domain,
 * prices in EUR, and carries Impressum / Datenschutz / AGB because German law
 * requires them of it. Defaulting that audience to English was a leftover from
 * the period when translation coverage was partial.
 *
 * Kept separate from {@link SOURCE_LOCALE} deliberately. They answer different
 * questions — "which dictionary defines the keys" and "which language do we
 * open in" — and collapsing them means you cannot change the default without
 * also re-rooting the type that every translation key is derived from.
 *
 * This value must be used by the server render, the pre-mount client render and
 * the persisted store's initial state alike: if any of the three disagrees,
 * React throws away the server tree on hydration.
 */
export const DEFAULT_LOCALE: Locale = 'de';

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
