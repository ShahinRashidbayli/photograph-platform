'use client';

import { useEffect, useRef } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { getColors } from '@/lib/design-tokens';

/**
 * Mirrors the theme store onto `<html>`: `data-theme` for the stylesheet's
 * browser-surface rules (selection, scrollbars, focus ring), `color-scheme`
 * for native controls, and the page background for overscroll.
 *
 * <p>The pre-paint script in the root layout does the same once, from
 * localStorage, before React exists; this keeps it true after a toggle, which
 * nothing did before — a native date picker stayed light in dark mode until
 * the next reload.
 *
 * <p>On a change after the first render, every transition is suspended for one
 * frame. Each surface animates its background independently, so without this
 * a theme switch smears across the screen in a dozen different timings.
 */
export function ThemeSync() {
  const theme = useThemeStore((s) => s.theme);
  const first = useRef(true);

  useEffect(() => {
    const el = document.documentElement;
    let style: HTMLStyleElement | null = null;
    if (!first.current) {
      style = document.createElement('style');
      style.textContent = '*,*::before,*::after{transition:none!important}';
      document.head.appendChild(style);
    }
    first.current = false;
    el.dataset.theme = theme;
    el.style.colorScheme = theme;
    el.style.backgroundColor = getColors(theme).bg;
    if (!style) return;
    // Force a style flush so the new colours land with transitions off, then
    // restore them on the next frame.
    void window.getComputedStyle(document.body).opacity;
    const frame = requestAnimationFrame(() => style?.remove());
    return () => {
      cancelAnimationFrame(frame);
      style?.remove();
    };
  }, [theme]);

  return null;
}
