import type { Locale } from '../config';
import { en } from './en';
import { de } from './de';

/**
 * Every dictionary, keyed by locale. Registering a new language here is the
 * last step — `Record<Locale, ...>` makes the compiler demand it exists.
 */
export const dictionaries: Record<Locale, Record<TranslationKey, string>> = { en, de };

export { en };

/** Every valid key. Derived from English, so the source dictionary defines the contract. */
export type TranslationKey = keyof typeof en;
