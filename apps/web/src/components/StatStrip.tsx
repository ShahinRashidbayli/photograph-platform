'use client';

import React from 'react';
import { fontSize, getColors, leading, radius, space, type Theme } from '@/lib/design-tokens';
import { useThemeStore } from '@/store/themeStore';

export type StatItem = {
  label: string;
  value: string;
  /** Short caption beside the figure — "3 this month", "1 booking open". */
  trend?: string;
  trendColor?: string;
  /** Colours the figure itself, for strips that distinguish their segments. */
  valueColor?: string;
  /** 0–100 — renders a hairline progress bar under the segment. */
  bar?: number;
  barColor?: string;
};

/**
 * How the band is placed.
 *
 * `block` is the full-width row that opens a page — bookings, clients,
 * portfolio. `inline` is the same band shrunk to its content so it can sit in
 * a page header beside the button that belongs there, which is where galleries
 * wants its two figures: the design should be shared, the footprint should not.
 */
export type StatStripVariant = 'block' | 'inline';

/**
 * The frame and segment styles, exported so a loading skeleton can draw the
 * same band without duplicating its measurements.
 */
export function getStatStripStyles(
  theme: Theme,
  variant: StatStripVariant = 'block'
): Record<string, React.CSSProperties> {
  const c = getColors(theme);
  const inline = variant === 'inline';

  return {
    strip: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      // Content-width in a header, full-width when it opens a page.
      width: inline ? 'auto' : '100%',
      background: c.surface,
      border: `1px solid ${c.border}`,
      borderRadius: inline ? radius.control : radius.card,
      overflow: 'hidden',
    },
    item: {
      padding: inline ? `${space.sm} ${space.md}` : `${space.md} ${space.lg}`,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: space.xxs,
      minWidth: 0,
    },
    // The eyebrow stays small and quiet on purpose: it names the number, it
    // isn't the thing being read. Bumping it to 700 made it compete with the
    // value it labels, which is what flattened the strip.
    label: {
      fontSize: fontSize.xs,
      color: c.textMuted,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      fontWeight: 600,
    },
    valueRow: {
      display: 'flex',
      alignItems: 'baseline',
      gap: space.sm,
      minWidth: 0,
    },
    // xl, not lg: the number is the only thing in this strip meant to be read
    // at a glance, so it needs a clear step above the card titles below it.
    value: {
      fontSize: inline ? fontSize.lg : fontSize.xl,
      fontWeight: 800,
      color: c.text,
      letterSpacing: '-0.02em',
      lineHeight: leading.tight,
      whiteSpace: 'nowrap',
    },
    trend: {
      fontSize: inline ? fontSize.xs : fontSize.sm,
      fontWeight: 500,
      color: c.textMuted,
      lineHeight: leading.snug,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      minWidth: 0,
    },
  };
}

type StatStripProps = {
  items: StatItem[];
  /** See `StatStripVariant`. Defaults to the full-width page-opening band. */
  variant?: StatStripVariant;
  /** Announced as a group; falls back to no label when omitted. */
  'aria-label'?: string;
};

/**
 * A page's headline numbers as one slim band.
 *
 * This started on the bookings screen, where it replaced a row of tall icon
 * cards: the icons carried no information the label didn't already give, and
 * the cards pushed the actual work area — the list and its detail pane — a
 * third of a screen down. Clients and portfolio had each grown their own
 * variant of the same idea at their own sizes, so the three screens disagreed
 * about how tall a headline number should be. One component so they cannot
 * disagree again.
 *
 * Presentational by design: every figure is computed by the screen that owns
 * the data and passed in, so this can never contradict the list beneath it.
 *
 * A `block` strip stacks its segments below 720px — see `.stat-strip` in
 * globals.css, which flips the hairline divider from vertical to horizontal
 * using the `--stat-strip-border` custom property set below. The `inline`
 * variant opts out of that: it is already narrow, and it lives in a header
 * that wraps as a whole, so stacking it there would make it tall for no gain.
 */
export function StatStrip({
  items,
  variant = 'block',
  'aria-label': ariaLabel,
}: Readonly<StatStripProps>) {
  const theme = useThemeStore((st) => st.theme);
  const c = getColors(theme);
  const s = getStatStripStyles(theme, variant);
  const inline = variant === 'inline';

  return (
    <div
      className={inline ? undefined : 'stat-strip'}
      style={{
        ...s.strip,
        gridTemplateColumns: `repeat(${items.length}, ${inline ? 'auto' : 'minmax(0, 1fr)'})`,
        // Handed to the stylesheet so the stacked-layout divider can be the
        // right colour in both themes without a second source of truth.
        ['--stat-strip-border' as string]: c.border,
      }}
      role="group"
      aria-label={ariaLabel}
    >
      {items.map((item, index) => (
        <div
          key={item.label}
          className={inline ? undefined : 'stat-strip-item'}
          style={{
            ...s.item,
            ...(index > 0 ? { borderLeft: `1px solid ${c.border}` } : {}),
          }}
        >
          <span style={s.label}>{item.label}</span>
          <div style={s.valueRow}>
            <span style={{ ...s.value, ...(item.valueColor ? { color: item.valueColor } : {}) }}>
              {item.value}
            </span>
            {item.trend && (
              <span style={{ ...s.trend, ...(item.trendColor ? { color: item.trendColor } : {}) }}>
                {item.trend}
              </span>
            )}
          </div>
          {typeof item.bar === 'number' && (
            <div
              style={{
                marginTop: '5px',
                height: 4,
                borderRadius: 999,
                background: c.isDark ? 'rgba(148,163,184,0.15)' : '#E5E7EB',
                overflow: 'hidden',
              }}
              role="progressbar"
              aria-valuenow={Math.round(item.bar)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.max(0, Math.min(100, item.bar))}%`,
                  borderRadius: 999,
                  background: item.barColor ?? c.primary,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
