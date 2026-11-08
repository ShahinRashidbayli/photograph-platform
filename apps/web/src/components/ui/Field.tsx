'use client';

import React, { useId } from 'react';
import { useColors, RADIUS } from './tokens';

interface FieldShellProps {
  label: string;
  /** Explanatory text under the control. */
  hint?: React.ReactNode;
  /** Replaces the hint and marks the control invalid. */
  error?: string | null;
  children: (_props: {
    id: string;
    'aria-describedby'?: string;
    'aria-invalid'?: true;
  }) => React.ReactNode;
}

/**
 * Label + control + hint/error, wired together for assistive tech.
 *
 * <p>The wiring is the point: a hand-rolled `<label>` next to an `<input>`
 * looks identical on screen but leaves the two unassociated, so a screen
 * reader announces an unlabelled field and never reads the error at all. Doing
 * it once here means every form in the app gets it right.
 */
export function Field({ label, hint, error, children }: FieldShellProps) {
  const c = useColors();
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div>
      <label
        htmlFor={id}
        style={{
          display: 'block',
          marginBottom: 5,
          fontSize: '0.82rem',
          fontWeight: 600,
          color: c.textMuted,
          letterSpacing: '0.02em',
        }}
      >
        {label}
      </label>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })}
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          style={{ margin: '6px 0 0', fontSize: '0.8rem', color: c.dangerText }}
        >
          {error}
        </p>
      ) : hint ? (
        <p
          id={`${id}-hint`}
          style={{ margin: '6px 0 0', fontSize: '0.8rem', color: c.textMuted, lineHeight: 1.5 }}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function controlStyle(c: ReturnType<typeof useColors>, invalid?: boolean): React.CSSProperties {
  return {
    width: '100%',
    boxSizing: 'border-box',
    minHeight: 38,
    padding: '8px 12px',
    border: `1px solid ${invalid ? c.dangerBorder : c.border}`,
    borderRadius: RADIUS.control,
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    color: c.text,
    background: c.surface,
    transition: 'border-color 150ms ease-out, box-shadow 150ms ease-out',
  };
}

export type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'>;

export function Input({ style, ...rest }: InputProps) {
  const c = useColors();
  return (
    <input style={{ ...controlStyle(c, rest['aria-invalid'] === true), ...style }} {...rest} />
  );
}

export type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className'>;

export function Select({ style, children, ...rest }: SelectProps) {
  const c = useColors();
  return (
    <select style={{ ...controlStyle(c, rest['aria-invalid'] === true), ...style }} {...rest}>
      {children}
    </select>
  );
}

export type TextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'>;

export function Textarea({ style, ...rest }: TextareaProps) {
  const c = useColors();
  return (
    <textarea
      style={{ ...controlStyle(c, rest['aria-invalid'] === true), resize: 'vertical', ...style }}
      {...rest}
    />
  );
}
