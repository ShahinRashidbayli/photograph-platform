'use client';

import { getColors } from '@/lib/design-tokens';
import { useLangStore } from '@/store/langStore';
import { useThemeStore } from '@/store/themeStore';
import type { CSSProperties } from 'react';

/**
 * LanguageToggle — the single source of truth for the DE/EN switch, sized to sit
 * next to {@link ThemeToggle}. Same two shells as ThemeToggle:
 *   • `pill` — bordered pill (marketing / auth pages)
 *   • `bare` — borderless square inside a toolbar (dashboard)
 *
 * Shows the *current* language code and switches to the other on click. The
 * label is `suppressHydrationWarning` because the persisted language is only
 * known client-side; the two-letter mismatch is harmless and self-corrects on
 * mount (see `useTranslation` for the body-text hydration strategy).
 */
interface LanguageToggleProps {
  variant?: 'pill' | 'bare';
  style?: CSSProperties;
}

export function LanguageToggle({ variant = 'pill', style }: Readonly<LanguageToggleProps>) {
  const { theme } = useThemeStore();
  const { lang, toggleLang } = useLangStore();
  const c = getColors(theme);
  const isPill = variant === 'pill';

  const next = lang === 'de' ? 'en' : 'de';
  const label = lang.toUpperCase();
  const title = next === 'en' ? 'Switch to English' : 'Auf Deutsch umschalten';

  const shell: CSSProperties = isPill
    ? {
        height: 38,
        minWidth: 38,
        borderRadius: 999,
        border: `1px solid ${c.border}`,
        padding: '0 12px',
      }
    : { height: 34, minWidth: 34, borderRadius: 8, border: 'none', padding: '0 8px' };

  return (
    <button
      type="button"
      onClick={toggleLang}
      aria-label={title}
      title={title}
      // Hover from the stylesheet, fed this theme's colours as variables — as
      // ThemeToggle does. Written inline on mouseenter, it painted the light
      // theme's hover square on bars that are dark in both themes.
      className={`ui-press ui-btn-ghost${isPill ? ' ui-toggle-pill' : ''}`}
      style={{
        ...shell,
        ['--ui-btn-hover' as string]: c.surfaceHover,
        ['--ui-toggle-hover-border' as string]: c.primaryBorder,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        cursor: 'pointer',
        color: c.text,
        fontSize: isPill ? '0.82rem' : '0.8rem',
        fontWeight: 700,
        letterSpacing: '0.03em',
        ...style,
      }}
    >
      <span suppressHydrationWarning>{label}</span>
    </button>
  );
}
