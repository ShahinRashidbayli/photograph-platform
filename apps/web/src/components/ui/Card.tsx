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
  const edge = `1px solid ${c.border}`;
  return (
    <div
      style={{
        background: c.surface,
        // An accented card names all four sides rather than overriding the
        // `border` shorthand with a `borderLeft`. React warns about that pair
        // on the same element, and it is right to: the two are applied in
        // object order, so a re-render that touches only the shorthand can
        // silently repaint over the accent. Without an accent there is one
        // shorthand and nothing to conflict with.
        ...(accent
          ? {
              borderTop: edge,
              borderRight: edge,
              borderBottom: edge,
              borderLeft: `3px solid ${accent}`,
            }
          : { border: edge }),
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
