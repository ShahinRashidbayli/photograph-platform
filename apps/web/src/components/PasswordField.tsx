'use client';

import { getColors } from '@/lib/design-tokens';
import { useTranslation } from '@/lib/i18n';
import { useThemeStore } from '@/store/themeStore';
import { getAuthStyles } from '@/app/(auth)/auth.styles';
import { useState, type ReactNode } from 'react';

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (_value: string) => void;
  /** `current-password` when signing in, `new-password` when choosing one. */
  autoComplete: 'current-password' | 'new-password';
  placeholder?: string;
  autoFocus?: boolean;
  /** Message shown under the field; also marks the input invalid. */
  error?: string;
  /** Helper text or a strength meter rendered under the field. */
  children?: ReactNode;
}

/**
 * A password input with a reveal toggle, in one place.
 *
 * Sign-in had the toggle and sign-up did not, which is backwards: a typo
 * matters most in the field you cannot retype from memory. Both now share this,
 * so the pair cannot drift again.
 *
 * The toggle is a real `<button type="button">` — inside a form, a bare
 * `<button>` submits, and inside *this* form that would submit half-filled
 * credentials every time someone checked their typing.
 */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder = '••••••••',
  autoFocus,
  error,
  children,
}: Readonly<PasswordFieldProps>) {
  const theme = useThemeStore((st) => st.theme);
  const colors = getColors(theme);
  const s = getAuthStyles(theme);
  const { t } = useTranslation();

  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);

  const errorId = `${id}-error`;
  const helpId = `${id}-help`;

  return (
    <div style={s.formGroup}>
      <label style={s.label} htmlFor={id}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          // Toggling `type` keeps one input, so the value, the caret and the
          // password manager's binding all survive the reveal.
          type={visible ? 'text' : 'password'}
          style={{
            ...s.input,
            ...(focused ? s.inputFocus : {}),
            ...(error ? { border: `1px solid ${colors.danger}` } : {}),
            paddingRight: 44,
          }}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : children ? helpId : undefined}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: colors.textSubtle,
            padding: 6,
          }}
          aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
          aria-pressed={visible}
        >
          <EyeIcon off={visible} />
        </button>
      </div>

      {error ? (
        <div id={errorId} style={{ ...s.helperText, color: colors.danger }} role="alert">
          {error}
        </div>
      ) : (
        children && <div id={helpId}>{children}</div>
      )}
    </div>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.4" />
      {off && (
        <path d="M3.5 3.5l13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      )}
    </svg>
  );
}
