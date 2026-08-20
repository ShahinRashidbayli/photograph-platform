'use client';

import React from 'react';
import { useColors, RADIUS, type Colors } from './tokens';

export type AlertTone = 'danger' | 'warning' | 'success' | 'info';

function paint(tone: AlertTone, c: Colors) {
  switch (tone) {
    case 'danger':
      return { bg: c.dangerBg, border: c.dangerBorder, text: c.dangerText };
    case 'warning':
      return { bg: c.warningBg, border: c.warningBorder, text: c.warningText };
    case 'success':
      return { bg: c.successBg, border: c.successBorder, text: c.successText };
    case 'info':
    default:
      return { bg: c.infoBg, border: c.infoBorder, text: c.infoText };
  }
}

export interface AlertProps {
  tone?: AlertTone;
  title?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * An inline message. `danger` announces itself as an alert; the quieter tones
 * use `status`, which screen readers deliver without interrupting — a saved
 * confirmation should not cut off whatever the user is reading.
 */
export function Alert({ tone = 'info', title, children, style }: AlertProps) {
  const c = useColors();
  const paints = paint(tone, c);
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      style={{
        background: paints.bg,
        border: `1px solid ${paints.border}`,
        color: paints.text,
        borderRadius: RADIUS.control,
        padding: '10px 14px',
        fontSize: '0.85rem',
        lineHeight: 1.5,
        ...style,
      }}
    >
      {title ? <strong style={{ display: 'block', marginBottom: 2 }}>{title}</strong> : null}
      {children}
    </div>
  );
}
