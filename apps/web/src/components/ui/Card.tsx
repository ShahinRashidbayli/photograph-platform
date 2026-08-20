'use client';

import React from 'react';
import { useColors, RADIUS } from './tokens';

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'className'> {
  /** Drops the inner padding for cards that lay out their own sections. */
  flush?: boolean;
  /** A coloured left edge — the app's convention for "needs attention". */
  accent?: string;
}

/** The app's surface: background, border, radius and shadow in one place. */
export function Card({ flush = false, accent, style, children, ...rest }: CardProps) {
  const c = useColors();
  return (
    <div
      style={{
        background: c.surface,
        border: `1px solid ${c.border}`,
        borderLeft: accent ? `3px solid ${accent}` : undefined,
        borderRadius: RADIUS.card,
        boxShadow: c.overlayShadow,
        padding: flush ? 0 : 24,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
