'use client';

import React from 'react';
import { useColors, RADIUS, type Colors } from './tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'className'
> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Shows a pending label and blocks further clicks. Separate from `disabled`
   * because the two mean different things to a screen reader: busy is "this is
   * happening", disabled is "you can't do this".
   */
  busy?: boolean;
  /** Replaces the children while `busy`. Falls back to the normal label. */
  busyLabel?: React.ReactNode;
  fullWidth?: boolean;
}

function paint(variant: ButtonVariant, c: Colors): React.CSSProperties {
  switch (variant) {
    case 'primary':
      return { background: c.primarySolid, color: '#fff', border: 'none' };
    case 'danger':
      return { background: c.dangerBg, color: c.dangerText, border: `1px solid ${c.dangerBorder}` };
    case 'ghost':
      return { background: 'transparent', color: c.textMuted, border: `1px solid ${c.border}` };
    case 'secondary':
    default:
      return { background: c.surface, color: c.text, border: `1px solid ${c.border}` };
  }
}

const SIZES: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: '7px 14px', fontSize: '0.82rem' },
  md: { padding: '10px 20px', fontSize: '0.9rem' },
};

/**
 * The app's button. Every visual decision lives here so a "primary action"
 * looks the same on the booking detail, the invoice modal and the settings
 * form — which it previously did only by coincidence.
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  busy = false,
  busyLabel,
  fullWidth = false,
  disabled,
  style,
  children,
  ...rest
}: ButtonProps) {
  const c = useColors();
  const inactive = busy || disabled;

  return (
    <button
      // Buttons inside a <form> default to type="submit", which has silently
      // submitted forms from cancel buttons more than once. Callers opt into
      // submitting explicitly.
      type="button"
      disabled={disabled}
      aria-busy={busy || undefined}
      style={{
        ...SIZES[size],
        ...paint(variant, c),
        borderRadius: RADIUS.control,
        fontWeight: 600,
        lineHeight: 1.2,
        width: fullWidth ? '100%' : undefined,
        cursor: busy ? 'wait' : disabled ? 'not-allowed' : 'pointer',
        opacity: inactive ? 0.6 : 1,
        transition: 'opacity 0.15s ease, background 0.15s ease',
        ...style,
      }}
      {...rest}
    >
      {busy ? (busyLabel ?? children) : children}
    </button>
  );
}
