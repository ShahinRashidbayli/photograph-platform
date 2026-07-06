'use client';

import { AuthSplitLayout } from '@/components/AuthSplitLayout';
import { getColors } from '@/lib/design-tokens';
import { useThemeStore } from '@/store/themeStore';
import Link from 'next/link';
import { getAuthStyles } from '../auth.styles';

// Self-serve password reset isn't wired to a backend endpoint yet, so this
// page is honest about that instead of pretending to send a reset email.
// When POST /api/auth/password/reset lands, swap this for the real form.
export default function ForgotPasswordPage() {
  const theme = useThemeStore((st) => st.theme);
  const colors = getColors(theme);
  const s = getAuthStyles(theme);

  return (
    <AuthSplitLayout
      visualTitle="Locked out? It happens."
      visualSubtitle="We'll get you back into your studio in no time."
    >
      <div style={s.header}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔑</div>
        <h2 style={s.title}>Reset your password</h2>
        <p style={s.subtitle}>
          Self-service password reset isn&apos;t available yet. Email us at{' '}
          <a href="mailto:support@fotolio.de" style={s.link}>
            support@fotolio.de
          </a>{' '}
          and we&apos;ll help you back into your studio.
        </p>
      </div>

      <div style={{ ...s.alertInfo, marginBottom: 24 }}>
        Tip: if you&apos;re a client, you don&apos;t need a password — use your emailed
        magic link to sign in.
      </div>

      <Link
        href="/login"
        style={{
          ...s.button,
          ...s.buttonPrimary,
          display: 'block',
          textAlign: 'center',
          textDecoration: 'none',
          boxSizing: 'border-box',
        }}
      >
        Back to sign in
      </Link>

      <p style={{ ...s.centerText, color: colors.textSubtle }}>
        Are you a client?{' '}
        <Link href="/customer/auth/login" style={{ ...s.link, color: colors.textMuted }}>
          Sign in with a magic link
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
