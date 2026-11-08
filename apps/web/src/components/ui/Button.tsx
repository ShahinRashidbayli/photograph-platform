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
      // A 1px border in the fill colour, not `none`, so every variant is the
      // same height and forced-colours mode still draws an edge.
      return {
        background: c.primarySolid,
        color: c.onPrimary,
        border: `1px solid ${c.primarySolid}`,
        ['--ui-btn-primary-hover' as string]: c.primarySolidHover,
      };
    case 'danger':
      return { background: c.dangerBg, color: c.dangerText, border: `1px solid ${c.dangerBorder}` };
    case 'ghost':
      return {
        background: 'transparent',
        color: c.textMuted,
        border: '1px solid transparent',
        ['--ui-btn-hover' as string]: c.surfaceHover,
      };
    case 'secondary':
    default:
      return {
        background: c.surface,
        color: c.text,
        border: `1px solid ${c.border}`,
        boxShadow: c.shadowRaised,
        ['--ui-btn-hover' as string]: c.surfaceHover,
      };
  }
}

// Heights land on 32 / 38px: the same row height as an input of the same size,
// so a button beside a field lines up without a nudge.
const SIZES: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: '6px 12px', fontSize: '0.8125rem', minHeight: 32 },
  md: { padding: '9px 16px', fontSize: '0.875rem', minHeight: 38 },
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
      // Hover and press live in globals.css (`.ui-press`, `.ui-btn-*`):
      // inline styles cannot express either.
      className={`ui-press ui-btn-${variant}`}
      style={{
        ...SIZES[size],
        ...paint(variant, c),
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        boxSizing: 'border-box',
        borderRadius: RADIUS.control,
        fontFamily: 'inherit',
        fontWeight: 550,
        lineHeight: 1.2,
        letterSpacing: '-0.005em',
        whiteSpace: 'nowrap',
        width: fullWidth ? '100%' : undefined,
        cursor: busy ? 'wait' : disabled ? 'not-allowed' : 'pointer',
        opacity: inactive ? 0.5 : 1,
        ...style,
      }}
      {...rest}
    >
      {busy ? (busyLabel ?? children) : children}
    </button>
  );
}
