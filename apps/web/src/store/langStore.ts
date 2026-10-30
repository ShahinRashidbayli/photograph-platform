import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_LOCALE } from '@/lib/i18n/config';

/** Supported UI languages. German is the product's home market; English is the
 *  fallback and the source-of-truth dictionary. Add a code here + a matching
 *  dictionary in `@/lib/i18n/dictionaries` to support a third language. */
export type Lang = 'de' | 'en';

interface LangStore {
  lang: Lang;
  setLang: (_lang: Lang) => void;
  toggleLang: () => void;
}

/**
 * Language preference, mirroring `useThemeStore`: one persisted client store,
 * one toggle. Persisted under `lang-storage` so the choice survives reloads.
 * Kept out of the URL deliberately — this is a lightweight per-device UI
 * preference, not a routed locale, so there is no middleware/redirect cost.
 */
export const useLangStore = create<LangStore>()(
  persist(
    (set, get) => ({
      // Must stay in step with `DEFAULT_LOCALE`, which the server render and
      // the pre-mount client render both use — three places that disagree is a
      // hydration mismatch. Typed against it so a change there fails here.
      lang: DEFAULT_LOCALE,
      setLang: (lang) => set({ lang }),
      toggleLang: () => set({ lang: get().lang === 'de' ? 'en' : 'de' }),
    }),
    {
      name: 'lang-storage',
    }
  )
);
