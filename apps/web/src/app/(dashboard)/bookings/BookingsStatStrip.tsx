'use client';

import React from 'react';
import type { getBookingsColors } from './bookings.styles';

/**
 * The row of headline numbers above the bookings list. Presentational: every
 * figure is computed by the screen that owns the data and passed in, so this
 * cannot disagree with the list below it.
 */

export type StatItem = {
  label: string;
  value: string;
  trend?: string;
  trendColor?: string;
  /** 0–100 — renders a hairline progress bar under the segment */
  bar?: number;
  barColor?: string;
};

type StatStripProps = {
  styles: Record<string, React.CSSProperties>;
  colors: ReturnType<typeof getBookingsColors>;
  items: StatItem[];
};

/**
 * The page's three headline numbers as one slim band. This replaced a row of
 * tall icon cards: the icons carried no information the label didn't already
 * give, and the cards pushed the actual work area (list + detail) a third of
 * a screen down.
 */
export function StatStrip({ styles, colors, items }: StatStripProps) {
  return (
    <div className="bk-stat-strip" style={styles.statStrip}>
      {items.map((item, index) => (
        <div
          key={item.label}
          className="bk-stat-item"
          style={{
            ...styles.statStripItem,
            ...(index > 0 ? { borderLeft: `1px solid ${colors.border}` } : {}),
          }}
        >
          <span style={styles.statStripLabel}>{item.label}</span>
          <div style={styles.statStripValueRow}>
            <span style={styles.statStripValue}>{item.value}</span>
            {item.trend && (
              <span
                style={{
                  ...styles.statStripTrend,
                  color: item.trendColor ?? styles.statStripTrend?.color,
                }}
              >
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
                background: colors.isDark ? 'rgba(148,163,184,0.15)' : '#E5E7EB',
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
                  background: item.barColor ?? colors.primary,
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
