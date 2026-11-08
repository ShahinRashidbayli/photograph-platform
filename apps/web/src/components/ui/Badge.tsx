'use client';

import React from 'react';
import { useColors, RADIUS } from './tokens';

export interface BadgeProps {
  children: React.ReactNode;
  /** Text/dot colour. Defaults to the muted foreground. */
  tone?: string;
  /** Pill background. Defaults to transparent with a border. */
  background?: string;
  /** Renders the small leading dot the status pills use. */
  dot?: boolean;
  style?: React.CSSProperties;
}

/** The status pill used for booking, invoice and lead states. */
export function Badge({ children, tone, background, dot = false, style }: BadgeProps) {
  const c = useColors();
  const color = tone ?? c.textMuted;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        borderRadius: RADIUS.pill,
        background: background ?? 'transparent',
        border: background ? '1px solid transparent' : `1px solid ${c.border}`,
        color,
        fontSize: '0.75rem',
        fontWeight: 550,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {dot ? (
        <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      ) : null}
      {children}
    </span>
  );
}
