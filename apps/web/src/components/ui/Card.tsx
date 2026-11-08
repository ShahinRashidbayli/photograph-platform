'use client';

import React from 'react';
import { useColors, RADIUS } from './tokens';

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'className'> {
  /** Drops the inner padding for cards that lay out their own sections. */
  flush?: boolean;
  /** A coloured top hairline — the app's convention for "needs attention". */
  accent?: string;
}

/** The app's surface: background, border, radius and shadow in one place. */
export function Card({ flush = false, accent, style, children, ...rest }: CardProps) {
  const c = useColors();
  return (
    <div
      style={{
        position: 'relative',
        background: c.surface,
        border: `1px solid ${c.border}`,
        borderRadius: RADIUS.card,
        boxShadow: c.shadowRaised,
        padding: flush ? 0 : 24,
        // Clips the attention bar to the card's own corner radius.
        overflow: accent ? 'hidden' : undefined,
        ...style,
      }}
      {...rest}
    >
      {/* "Needs attention" used to be a 3px coloured left border, which is the
          one card treatment every dashboard template ships. A hairline across
          the top edge carries the same signal without turning the card into a
          callout, and leaves the border itself one colour on all four sides. */}
      {accent ? (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            insetInline: 0,
            top: 0,
            height: 2,
            background: accent,
          }}
        />
      ) : null}
      {children}
    </div>
  );
}
