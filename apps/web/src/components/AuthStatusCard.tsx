'use client';

import { Icon } from '@/components/Icon';
import { getColors } from '@/lib/design-tokens';
import { useThemeStore } from '@/store/themeStore';
import { getAuthStyles } from '@/app/(auth)/auth.styles';
import type { ReactNode } from 'react';

export type AuthStatusTone = 'loading' | 'success' | 'error';

interface AuthStatusCardProps {
  tone: AuthStatusTone;
  title: string;
  message: string;
  /** Buttons or links offered under the message. */
  children?: ReactNode;
}

/**
 * The "we are resolving a token from an email link" screen, shared by
 * email confirmation and the customer magic-link sign-in.
 *
 * Both used to hand-roll this, against a *static light-mode* style snapshot and
 * a hard-coded palette — so a user on the dark theme clicked a link in their
 * inbox and got a white page in a different layout from every other auth
 * screen. Sharing one component is what keeps that from drifting apart again.
 *
 * Status is not carried by colour alone: each tone has its own icon and its own
 * heading, so it survives greyscale, colour blindness and a screen reader. The
 * live region is on the message, which is the part that changes.
 */
export function AuthStatusCard({ tone, title, message, children }: Readonly<AuthStatusCardProps>) {
  const theme = useThemeStore((st) => st.theme);
  const c = getColors(theme);
  const s = getAuthStyles(theme);

  const palette = {
    loading: { bg: c.primaryBg, fg: c.primaryText, border: c.primaryBorder },
    success: { bg: c.successBg, fg: c.success, border: c.successBorder },
    error: { bg: c.dangerBg, fg: c.dangerText, border: c.dangerBorder },
  }[tone];

  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: palette.bg,
          color: palette.fg,
          border: `1px solid ${palette.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}
      >
        {tone === 'loading' && <span className="auth-spinner" aria-hidden="true" />}
        {tone === 'success' && <Icon name="check" size={30} strokeWidth={2.25} />}
        {tone === 'error' && <ExclamationIcon />}
      </div>

      <h2 style={s.title}>{title}</h2>

      {/*
        `polite`, not `assertive`: the outcome is worth announcing but never
        worth interrupting whatever the user is already having read to them.
        `atomic` so the whole sentence is re-read rather than the diff.
      */}
      <p
        style={{ ...s.subtitle, marginTop: 8 }}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {message}
      </p>

      {children && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 28 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function ExclamationIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5v5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16.4" r="1.05" fill="currentColor" />
    </svg>
  );
}
