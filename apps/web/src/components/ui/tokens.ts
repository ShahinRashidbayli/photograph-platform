'use client';

import { useMemo } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { getColors } from '@/lib/design-tokens';

export type Colors = ReturnType<typeof getColors>;

/**
 * The palette for the active theme.
 *
 * <p>Every primitive in this folder reads the theme itself rather than taking
 * it as a prop. Threading `theme` through call sites is what produced the
 * 900-odd hand-written style objects this folder replaces: each one had to
 * receive the theme, derive the colours, and re-state the same border radius
 * and padding to use them.
 */
export function useColors(): Colors {
  const { theme } = useThemeStore();
  return useMemo(() => getColors(theme), [theme]);
}

/** Shared geometry, so a card and a modal can't drift apart by a pixel. */
export const RADIUS = {
  control: 8,
  card: 12,
  pill: 999,
} as const;
