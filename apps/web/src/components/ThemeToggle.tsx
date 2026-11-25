'use client';

import { getColors } from '@/lib/design-tokens';
import { useThemeStore } from '@/store/themeStore';
import { useTranslation } from '@/lib/i18n';
import type { CSSProperties } from 'react';

/**
 * ThemeToggle — the single source of truth for the light/dark switch button.
 *
 * The theme *state* already lives in one place (`useThemeStore`); this component
 * does the same for the *button* — its icon, behaviour, sizing and hover. Every
 * surface that offers one (auth, dashboard, landing, legal pages) renders `<ThemeToggle />` instead of
 * its own markup, so changing the glyph or interaction here changes it
 * everywhere. A click sets the explicit opposite of what is on screen, also
 * while the theme follows the system; only the dashboard's Appearance menu goes
 * back to following it.
 *
 * The only thing that legitimately differs by context is the shell shape, so
 * that is the one prop:
 *   • `pill` — a standalone bordered pill (auth and legal pages)
 *   • `bare` — a compact borderless square that sits inside a toolbar (dashboard,
 *     landing nav)
 */
interface ThemeToggleProps {
  variant?: 'pill' | 'bare';
  style?: CSSProperties;
}

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function ThemeToggle({ variant = 'pill', style }: Readonly<ThemeToggleProps>) {
  const { theme, toggleTheme } = useThemeStore();
  const { t } = useTranslation();
  const c = getColors(theme);
  const isPill = variant === 'pill';
  const iconSize = isPill ? 17 : 20;
  const switchLabel = theme === 'light' ? t('theme.switchToDark') : t('theme.switchToLight');

  const shell: CSSProperties = isPill
    ? { width: 38, height: 38, borderRadius: 999, border: `1px solid ${c.border}` }
    : { width: 34, height: 34, borderRadius: 8, border: 'none' };

  return (
    // Hover comes from the stylesheet, fed this theme's colours as variables.
    // It used to be written inline on mouseenter — with the colours of the
    // theme current at that moment, so a click switched the theme under the
    // pointer and left a light hover square, its icon invisible, until the
    // pointer moved off.
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={switchLabel}
      title={switchLabel}
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
        ...style,
      }}
    >
      {theme === 'light' ? (
        // Moon — click to go dark
        <svg width={iconSize} height={iconSize} {...ICON_PROPS}>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      ) : (
        // Sun — click to go light
        <svg width={iconSize} height={iconSize} {...ICON_PROPS}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      )}
    </button>
  );
}
