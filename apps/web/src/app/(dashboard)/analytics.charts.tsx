'use client';

import React, { useId, useState } from 'react';
import { useColors } from '@/components/ui';
import { useThemeStore } from '@/store/themeStore';

/**
 * The two chart forms the report screens need, and nothing else.
 *
 * <p>Both are bars, for the reason the form heuristic gives: every question
 * here is a magnitude comparison across a small set of labelled things
 * (months, statuses, packages). Neither screen gets a pie — a pie answers
 * "what share of a whole", which is not a question a photographer asks of
 * twelve months, and it is unreadable past three slices.
 *
 * <h2>Series colours</h2>
 * Two series only: invoiced and collected. The pair is validated for
 * colour-blind separation against both surfaces — light `#44403C`/`#16A34A`,
 * dark `#D6D3D1`/`#059669`. The first series is the interface's own ink, so the
 * only saturated colour in a chart is the money that actually arrived; the
 * pair differs in lightness as well as hue, which is what survives every kind
 * of colour blindness. The light green sits outside the dark mode's lightness
 * band and would have gone muddy on the dark surface, hence the second value.
 *
 * <p>Their tritan separation lands in the warn band, so colour is never the
 * only cue: the legend is always present, the paired bars carry a 2px surface
 * gap, and every value is also reachable as text through the table view each
 * screen renders beneath its charts.
 */

export const SERIES = {
  light: { a: '#44403C', b: '#16A34A' },
  dark: { a: '#D6D3D1', b: '#059669' },
} as const;

export function useSeriesColors() {
  const { theme } = useThemeStore();
  return theme === 'dark' ? SERIES.dark : SERIES.light;
}

interface Bar {
  /** Axis label — a month initial, a status, a package name. */
  label: string;
  /** Full label for the tooltip, when `label` is abbreviated. */
  title?: string;
  a: number;
  b?: number;
}

/**
 * Vertical bars over a shared baseline, one or two series.
 *
 * <p>Laid out in CSS rather than SVG. The bars are rectangles on a baseline
 * with text under them, which flexbox already describes; an SVG would need its
 * own text scaling and a viewBox that fights the responsive column the
 * dashboard puts it in.
 */
export function BarChart({
  bars,
  seriesA,
  seriesB,
  format,
  height = 168,
}: {
  bars: Bar[];
  seriesA: string;
  seriesB?: string;
  /** Renders a raw value for the tooltip — money or a plain count. */
  format: (_value: number) => string;
  height?: number;
}) {
  const c = useColors();
  const colors = useSeriesColors();
  const [hover, setHover] = useState<number | null>(null);
  const labelId = useId();

  // One scale for both series — never a second axis. Zero-height bars still
  // render a 2px stub so an empty month reads as "nothing here" rather than as
  // a gap in the chart.
  const max = Math.max(1, ...bars.flatMap((b) => [b.a, b.b ?? 0]));
  const scale = (v: number) => Math.max(v > 0 ? 2 : 0, Math.round((v / max) * height));

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: height + 4 }}
        role="img"
        aria-labelledby={labelId}
      >
        {bars.map((bar, i) => (
          <div
            key={bar.label + i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              // The 2px surface gap between paired bars, so the two series stay
              // separable without relying on hue.
              gap: 2,
              height: '100%',
              borderRadius: 4,
              background: hover === i ? c.surfaceHover : 'transparent',
              cursor: 'default',
            }}
          >
            <span
              style={{
                width: seriesB ? '38%' : '62%',
                height: scale(bar.a),
                background: colors.a,
                borderRadius: '4px 4px 0 0',
                transition: 'height 0.25s ease',
              }}
            />
            {seriesB && (
              <span
                style={{
                  width: '38%',
                  height: scale(bar.b ?? 0),
                  background: colors.b,
                  borderRadius: '4px 4px 0 0',
                  transition: 'height 0.25s ease',
                }}
              />
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        {bars.map((bar, i) => (
          <div
            key={bar.label + i}
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: '0.68rem',
              color: hover === i ? c.text : c.textSubtle,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {bar.label}
          </div>
        ))}
      </div>

      {/* Tooltip rather than a number on every bar: twelve labelled values is
          noise, and the table below carries all of them anyway. */}
      {hover !== null && (
        <div
          style={{
            position: 'absolute',
            top: -6,
            left: `${((hover + 0.5) / bars.length) * 100}%`,
            transform: 'translate(-50%, -100%)',
            background: c.surface,
            border: `1px solid ${c.border}`,
            borderRadius: 8,
            boxShadow: c.overlayShadow,
            padding: '8px 10px',
            fontSize: '0.78rem',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        >
          <div style={{ fontWeight: 600, color: c.text, marginBottom: 4 }}>
            {bars[hover].title ?? bars[hover].label}
          </div>
          <TooltipRow color={colors.a} label={seriesA} value={format(bars[hover].a)} />
          {seriesB && (
            <TooltipRow color={colors.b} label={seriesB} value={format(bars[hover].b ?? 0)} />
          )}
        </div>
      )}

      <span id={labelId} style={SR_ONLY}>
        {seriesB ? `${seriesA}, ${seriesB}` : seriesA}
      </span>
    </div>
  );
}

function TooltipRow({ color, label, value }: { color: string; label: string; value: string }) {
  const c = useColors();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: c.textMuted }}>
      <span
        style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }}
        aria-hidden="true"
      />
      {label}
      {/* Value in text ink, never the series colour. */}
      <span style={{ marginLeft: 'auto', color: c.text, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

/**
 * Horizontal bars for a ranked list — statuses, packages.
 *
 * <p>Horizontal because the labels are words, and words under a vertical bar
 * either truncate or tilt. Ranked biggest-first, and every row carries its own
 * value: there are only a handful, so a direct label costs nothing and removes
 * the need to hover.
 */
export function RankedBars({
  rows,
  format,
}: {
  rows: { label: string; value: number; hint?: string }[];
  format: (_value: number) => string;
}) {
  const c = useColors();
  const colors = useSeriesColors();
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map((row) => (
        <div key={row.label}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              fontSize: '0.85rem',
              marginBottom: 5,
            }}
          >
            <span style={{ color: c.text, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {row.label}
            </span>
            <span style={{ color: c.textMuted, whiteSpace: 'nowrap' }}>
              {format(row.value)}
              {row.hint && <span style={{ color: c.textSubtle }}> · {row.hint}</span>}
            </span>
          </div>
          <div style={{ height: 8, background: c.borderSoft, borderRadius: 999 }}>
            <div
              style={{
                width: `${Math.max(2, (row.value / max) * 100)}%`,
                height: '100%',
                background: colors.a,
                borderRadius: 999,
                transition: 'width 0.25s ease',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Legend. Always rendered for two series — identity is never colour alone. */
export function Legend({ a, b }: { a: string; b: string }) {
  const c = useColors();
  const colors = useSeriesColors();
  return (
    <div style={{ display: 'flex', gap: 16, fontSize: '0.8rem', color: c.textMuted }}>
      {[
        { label: a, color: colors.a },
        { label: b, color: colors.b },
      ].map((s) => (
        <span key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{ width: 10, height: 10, borderRadius: 3, background: s.color }}
            aria-hidden="true"
          />
          {s.label}
        </span>
      ))}
    </div>
  );
}

export const SR_ONLY: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};
