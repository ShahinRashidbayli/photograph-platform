import React from 'react';
import { useColors } from './tokens';

/**
 * A quiet line of prose — "loading…", "nothing here yet", "we couldn't load
 * that". Existed twice under two names (`Muted` in the photographer's invoice
 * panel, `Note` in the client's) differing only in bottom margin, which is what
 * `style` is for.
 */
export function Note({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const c = useColors();
  return (
    <p style={{ fontSize: '0.85rem', color: c.textMuted, lineHeight: 1.5, margin: 0, ...style }}>
      {children}
    </p>
  );
}
