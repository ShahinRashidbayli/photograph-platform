'use client';

import React from 'react';
import { useColors, RADIUS } from './tokens';

export interface ToggleProps {
  checked: boolean;
  onChange: (_next: boolean) => void;
  /** What the switch controls. Rendered beside it and used as its label. */
  label: string;
  /** The state in words — screens should say what "off" actually means. */
  description?: string;
  /** Leading glyph. Decorative; the label carries the meaning. */
  icon?: React.ReactNode;
  disabled?: boolean;
}

/**
 * A labelled on/off switch.
 *
 * Built because settings were being rendered as the *word* "Enabled" next to a
 * label, wired to an onClick. That reads as a status readout, not a control —
 * so the two settings a photographer most needs to change before sending a
 * gallery to a client looked like something the app was telling them, and the
 * only clue otherwise was the cursor.
 *
 * A real `role="switch"` also means assistive tech announces it as a control
 * with a state, and the keyboard gets it for free: `<button>` already responds
 * to Enter and Space, which a clickable `<span>` does not.
 *
 * The whole row is the label, so the hit target is the row rather than a 44px
 * track at the end of it.
 */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  icon,
  disabled = false,
}: Readonly<ToggleProps>) {
  const c = useColors();

  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 0',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {icon && (
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            color: c.textSubtle,
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
      )}

      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: '0.9rem',
            fontWeight: 600,
            color: c.text,
            lineHeight: 1.3,
          }}
        >
          {label}
        </span>
        {description && (
          <span
            style={{
              display: 'block',
              fontSize: '0.8rem',
              color: c.textMuted,
              lineHeight: 1.4,
              marginTop: 2,
            }}
          >
            {description}
          </span>
        )}
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        style={{
          position: 'relative',
          width: 44,
          height: 26,
          flexShrink: 0,
          borderRadius: RADIUS.pill,
          border: 'none',
          padding: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: checked ? c.success : c.neutralBg,
          transition: 'background 0.18s ease',
        }}
      >
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 3,
            // Travel is the track minus the knob and both insets, so the knob
            // lands flush at each end rather than at a number that happens to
            // look right at this size.
            left: checked ? 44 - 20 - 3 : 3,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#FFFFFF',
            boxShadow: '0 1px 3px rgba(0,0,0,0.28)',
            transition: 'left 0.18s ease',
          }}
        />
      </button>
    </label>
  );
}
