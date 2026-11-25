import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';
/** What the visitor chose: a theme, or to follow the system setting. */
export type ThemePreference = Theme | 'system';

export const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';
export const THEME_STORAGE_KEY = 'theme-storage';

/** An explicit choice wins; otherwise the system setting. */
export function resolveTheme(preference: ThemePreference, system: Theme): Theme {
  return preference === 'system' ? system : preference;
}

/** The OS setting. Light where it cannot be read (server, jsdom). */
export function readSystemTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia(SYSTEM_DARK_QUERY).matches ? 'dark' : 'light';
}

/**
 * The explicit choice as persisted, or null when there is none. For readers
 * that paint before React exists; the pre-paint script in the root layout
 * inlines the same read.
 */
export function readStoredChoice(): Theme | null {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    const t = raw ? JSON.parse(raw)?.state?.theme : null;
    return t === 'light' || t === 'dark' ? t : null;
  } catch {
    return null;
  }
}

interface ThemeStore {
  /** The resolved theme — what every surface paints. Never 'system'. */
  theme: Theme;
  preference: ThemePreference;
  systemTheme: Theme;
  /** An explicit choice. */
  setTheme: (_theme: Theme) => void;
  setPreference: (_preference: ThemePreference) => void;
  /** Sets the explicit opposite of what is on screen, even while following the system. */
  toggleTheme: () => void;
  /** Fed by `ThemeSync` from the `prefers-color-scheme` media query. */
  setSystemTheme: (_system: Theme) => void;
}

const initialSystem = readSystemTheme();

/**
 * Persisted as `{ state: { theme } }` with `theme` holding the explicit choice
 * only — the shape every stored value already has, so a value written before
 * "system" existed is read as the explicit choice it was (zustand writes the
 * key only from `set`, never the default). Following the system persists no
 * `theme` at all. Never bump `version`: a `migrate` makes rehydrate rewrite
 * storage. The pre-paint script in `app/layout.tsx` and the dashboard loading
 * screen read this shape directly.
 */
export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: initialSystem,
      preference: 'system',
      systemTheme: initialSystem,
      setTheme: (theme) => set({ preference: theme, theme }),
      setPreference: (preference) =>
        set({ preference, theme: resolveTheme(preference, get().systemTheme) }),
      toggleTheme: () => {
        const next: Theme = get().theme === 'light' ? 'dark' : 'light';
        set({ preference: next, theme: next });
      },
      setSystemTheme: (systemTheme) => {
        // Every `set` writes storage; skip the no-op so a visitor who never
        // chose keeps an empty key.
        if (get().systemTheme === systemTheme) return;
        set({ systemTheme, theme: resolveTheme(get().preference, systemTheme) });
      },
    }),
    {
      name: THEME_STORAGE_KEY,
      partialize: (s) => (s.preference === 'system' ? {} : { theme: s.preference }),
      // The default shallow merge would copy a stored `theme` over the
      // resolved one and leave `preference` at 'system', dropping the choice.
      merge: (persisted, current) => {
        const t = (persisted as { theme?: unknown } | undefined)?.theme;
        return t === 'light' || t === 'dark' ? { ...current, preference: t, theme: t } : current;
      },
    }
  )
);
