'use client';

import React from 'react';
import type { getColors } from '@/lib/design-tokens';

/**
 * One titled card in a settings panel.
 *
 * <p>The card, its heading, and the `aria-labelledby` wiring were written out
 * by hand at every section — the same twelve lines, five times, with the type
 * sizes already starting to disagree between them. This is that shape, once.
 *
 * <p>Keeps the `id` on the heading rather than the section so existing
 * `#settings-*` links still resolve: they are no longer how the app navigates
 * here, but they are what people bookmarked.
 */
export function SettingsSection({
  id,
  title,
  description,
  colors: c,
  tone = 'default',
  children,
}: {
  id: string;
  title: string;
  description?: string;
  colors: ReturnType<typeof getColors>;
  /** `danger` reserves the red border for the one section that destroys data. */
  tone?: 'default' | 'danger';
  children: React.ReactNode;
}) {
  const danger = tone === 'danger';
  return (
    <section
      aria-labelledby={id}
      style={{
        background: c.surface,
        border: `1px solid ${danger ? c.dangerBorder : c.border}`,
        borderRadius: '14px',
        padding: '24px',
        marginBottom: '20px',
        boxShadow: c.overlayShadow,
      }}
    >
      <h2
        id={id}
        style={{
          fontSize: '1rem',
          fontWeight: 700,
          color: danger ? c.danger : c.text,
          marginBottom: description ? '4px' : '20px',
        }}
      >
        {title}
      </h2>
      {description && (
        <p style={{ fontSize: '0.88rem', color: c.textMuted, marginBottom: '20px' }}>
          {description}
        </p>
      )}
      {children}
    </section>
  );
}
