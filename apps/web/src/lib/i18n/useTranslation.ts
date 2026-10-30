'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLangStore } from '@/store/langStore';
import { DEFAULT_LOCALE, INTL_LOCALE, type Locale } from './config';
import { getFormatters, type Formatters } from './format';
import { dictionaries, en, type TranslationKey } from './locales';

export type TranslateParams = Record<string, string | number>;

/**
 * Base key of a pluralised entry: `bookings.clientSessions` for the pair
 * `bookings.clientSessions_one` / `_other`. Derived from the dictionary, so
 * `tPlural` only accepts keys that actually have plural forms — and a key whose
 * `_other` form is deleted stops compiling at its call sites.
 *
 * Written as a generic so the conditional distributes across the key union;
 * applied to the union directly it would collapse to `never`.
 */
type PluralBase<K> = K extends `${infer Base}_other` ? Base : never;

export type PluralKey = PluralBase<TranslationKey>;

// Intl.PluralRules is costly to construct; one per locale is plenty.
const pluralRules = new Map<Locale, Intl.PluralRules>();
const rulesFor = (locale: Locale): Intl.PluralRules => {
  const hit = pluralRules.get(locale);
  if (hit) return hit;
  const made = new Intl.PluralRules(INTL_LOCALE[locale]);
  pluralRules.set(locale, made);
  return made;
};

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  let out = template;
  for (const [key, value] of Object.entries(params)) {
    out = out.replaceAll(`{${key}}`, String(value));
  }
  return out;
}

/**
 * Translation hook. Returns the active `lang`, `t(key, params?)`,
 * `tPlural(key, count, params?)`, and `format` — number/date helpers bound to
 * the same locale.
 *
 * Hydration: the persisted language is read from localStorage on the client, so
 * a visitor who has switched language has a store that differs from what the
 * server rendered. To avoid React text-mismatch errors we render
 * `DEFAULT_LOCALE` — the same thing the server rendered — until after mount,
 * then switch to the persisted language. Visitors on the default see no flash;
 * only someone who has actively switched sees a one-frame swap, and only on
 * translated surfaces.
 *
 * `t`, `tPlural` and `format` are all memoised on `lang` and must stay that
 * way: callers legitimately list them in useEffect/useCallback dependency
 * arrays, and a fresh identity per render turns those into infinite loops
 * (re-render → new `t` → effect refires).
 */
export function useTranslation() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const persisted = useLangStore((s) => s.lang);
  const lang: Locale = mounted ? persisted : DEFAULT_LOCALE;

  const t = useCallback(
    (key: TranslationKey, params?: TranslateParams): string =>
      interpolate(dictionaries[lang][key] ?? en[key] ?? key, params),
    [lang]
  );

  /**
   * Plural-aware lookup. Picks the CLDR category for `count` in the active
   * locale and reads `<key>_<category>`, falling back to `<key>_other` — so a
   * language with categories English lacks (Polish `few`/`many`) degrades to a
   * sensible string instead of rendering the raw key. `{count}` is injected
   * automatically, locale-formatted.
   */
  const tPlural = useCallback(
    (key: PluralKey, count: number, params?: TranslateParams): string => {
      const category = rulesFor(lang).select(count);
      const dict = dictionaries[lang];
      const exact = `${key}_${category}` as TranslationKey;
      const other = `${key}_other` as TranslationKey;
      const template = dict[exact] ?? dict[other] ?? en[other] ?? key;
      return interpolate(template, {
        count: getFormatters(lang).number(count),
        ...params,
      });
    },
    [lang]
  );

  const format: Formatters = useMemo(() => getFormatters(lang), [lang]);

  return { t, tPlural, format, lang };
}
