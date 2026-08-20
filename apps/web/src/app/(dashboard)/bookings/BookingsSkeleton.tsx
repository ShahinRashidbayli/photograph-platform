'use client';

import React from 'react';
import { space } from '@/lib/design-tokens';
import type { getBookingsColors } from './bookings.styles';

/**
 * The loading shape of the bookings screen. Mirrors the real layout closely
 * enough that the transition into data is not a jump — a spinner in a blank
 * page makes the same wait feel longer.
 */

export function BookingsSkeleton({
  styles,
  colors,
  label,
}: Readonly<{
  styles: Record<string, React.CSSProperties>;
  colors: ReturnType<typeof getBookingsColors>;
  label: string;
}>) {
  const block = (w: string | number, h: number, extra: React.CSSProperties = {}) => (
    <div
      className="bk-shimmer"
      style={{ ...styles.skeletonBlock, width: w, height: h, ...extra }}
    />
  );

  return (
    <div style={styles.pageWrapper} aria-busy="true" aria-label={label}>
      <style>{`
        .bk-shimmer {
          background-image: linear-gradient(
            90deg,
            transparent 0%,
            ${colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.65)'} 50%,
            transparent 100%
          );
          background-size: 200% 100%;
          background-repeat: no-repeat;
          animation: bk-shimmer 1.3s ease-in-out infinite;
        }
        @keyframes bk-shimmer {
          from { background-position: 180% 0; }
          to   { background-position: -60% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .bk-shimmer { animation: none; }
        }
      `}</style>

      <header style={styles.pageHeader}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
          {block(190, 26)}
          {block(320, 14)}
        </div>
        {block(140, 36)}
      </header>

      <div className="bk-stat-strip" style={styles.statStrip}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bk-stat-item"
            style={{
              ...styles.statStripItem,
              ...(i > 0 ? { borderLeft: `1px solid ${colors.border}` } : {}),
            }}
          >
            {block(90, 10)}
            {block(120, 18, { marginTop: space.sm })}
          </div>
        ))}
      </div>

      <div className="bk-container" style={styles.container}>
        <section className="bk-list-panel" style={styles.listPanel}>
          <div style={styles.listHeader}>{block('100%', 36)}</div>
          <div style={styles.listScroll}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  ...styles.listItem,
                  cursor: 'default',
                  opacity: 1 - i * 0.13,
                }}
              >
                {block(52, 52)}
                <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
                  {block('70%', 12)}
                  {block('45%', 10)}
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="bk-detail-panel" style={styles.detailPanel}>
          <div style={styles.detailHeader}>
            <div style={styles.detailHeaderLeft}>
              {block(48, 48)}
              <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
                {block(170, 16)}
                {block(110, 12)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: space.sm }}>
              {block(130, 34)}
              {block(90, 34)}
            </div>
          </div>
          <div style={styles.detailBody}>
            {block('35%', 10)}
            <div className="bk-info-grid" style={styles.infoGrid}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={styles.infoRow}>
                  {block('50%', 10)}
                  {block('80%', 14, { marginTop: space.xs })}
                </div>
              ))}
            </div>
            {block('100%', 8, { marginTop: space.lg })}
          </div>
        </section>
      </div>
    </div>
  );
}
