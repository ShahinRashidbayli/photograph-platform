'use client';

import React from 'react';
import { space } from '@/lib/design-tokens';
import { getStatStripStyles } from '@/components/StatStrip';
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
  photographer = true,
}: Readonly<{
  styles: Record<string, React.CSSProperties>;
  colors: ReturnType<typeof getBookingsColors>;
  label: string;
  /** The photographer's page has four overview tiles; the client's, a three-part strip. */
  photographer?: boolean;
}>) {
  const stripStyles = getStatStripStyles(colors.isDark ? 'dark' : 'light');
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
        <div style={{ display: 'flex', alignItems: 'baseline', gap: space.md }}>
          {block(150, 30)}
          {block(90, 14)}
        </div>
        <div style={{ display: 'flex', gap: space.sm }}>
          {photographer && block(150, 38)}
          {block(140, 38)}
        </div>
      </header>

      {photographer ? (
        // The overview tiles: four cells in one bordered strip.
        <div
          className="bk-tiles"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            background: colors.border,
            gap: 1,
            overflow: 'hidden',
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                background: colors.surface,
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: space.sm,
              }}
            >
              {block(80, 10)}
              {block(110, 22)}
              {block(140, 10)}
            </div>
          ))}
        </div>
      ) : (
        // Same measurements as the real strip, from the same factory — a
        // skeleton that guesses at them is what makes the swap to data jump.
        <div
          className="stat-strip"
          style={{
            ...stripStyles.strip,
            ['--stat-strip-border' as string]: colors.border,
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="stat-strip-item"
              style={{
                ...stripStyles.item,
                ...(i > 0 ? { borderLeft: `1px solid ${colors.border}` } : {}),
              }}
            >
              {block(90, 10)}
              {block(120, 18, { marginTop: space.sm })}
            </div>
          ))}
        </div>
      )}

      <div className="bk-container" style={styles.container}>
        <section className="bk-list-panel" style={styles.listPanel}>
          <div style={{ ...styles.listHeader, flexDirection: 'column', alignItems: 'stretch' }}>
            {block('100%', 36)}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[56, 96, 92, 72].map((w) => (
                <React.Fragment key={w}>{block(w, 30, { borderRadius: 999 })}</React.Fragment>
              ))}
            </div>
          </div>
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
                {block(52, 60)}
                <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
                  {block('70%', 12)}
                  {block('55%', 10)}
                  {block(72, 18, { borderRadius: 999 })}
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="bk-detail-panel" style={styles.detailPanel}>
          {/* Header with the actions on the right, the progress box, then the
              session/client split — the order the detail draws them in. */}
          <div
            style={{
              display: 'flex',
              gap: space.lg,
              alignItems: 'flex-start',
              padding: '20px 24px',
              borderBottom: `1px solid ${colors.borderSoft}`,
            }}
          >
            {block(48, 48, { borderRadius: '50%' })}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: space.sm }}>
              {block(200, 20)}
              {block(260, 12)}
            </div>
            <div style={{ display: 'flex', gap: space.sm }}>
              {block(80, 38)}
              {block(140, 38)}
              {block(38, 38)}
            </div>
          </div>
          <div
            style={{
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: space.xxl,
            }}
          >
            {block('100%', 84, { borderRadius: 12 })}
            <div
              className="bk-split"
              style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: space.xxxl }}
            >
              {[0, 1].map((col) => (
                <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: space.md }}>
                  {block('30%', 10)}
                  {[0, 1, 2].map((i) => (
                    <React.Fragment key={i}>{block(col ? '70%' : '85%', 12)}</React.Fragment>
                  ))}
                </div>
              ))}
            </div>
            {block('100%', 6)}
          </div>
        </section>
      </div>
    </div>
  );
}
