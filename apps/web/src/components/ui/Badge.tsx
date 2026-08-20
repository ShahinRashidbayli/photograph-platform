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
        padding: '4px 10px',
        borderRadius: RADIUS.pill,
        background: background ?? 'transparent',
        border: background ? 'none' : `1px solid ${c.border}`,
        color,
        fontSize: '0.72rem',
        fontWeight: 700,
        letterSpacing: '0.04em',
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
