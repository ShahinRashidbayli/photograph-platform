'use client';

import api from '@/lib/api';
import { AuthSplitLayout } from '@/components/AuthSplitLayout';
import { getColors } from '@/lib/design-tokens';
import { extractApiError } from '@/lib/helpers';
import { useThemeStore } from '@/store/themeStore';
import Link from 'next/link';
import { useState } from 'react';
import { getAuthStyles } from '../auth.styles';

export default function ForgotPasswordPage() {
  const theme = useThemeStore((st) => st.theme);
  const colors = getColors(theme);
  const s = getAuthStyles(theme);

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Enter the email address on your account.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await api.post('/api/auth/password/forgot', { email: trimmedEmail });
      setSent(true);
    } catch (err) {
      // The endpoint answers 204 whether or not the address exists, so the only
      // errors that can land here are real ones (rate limit, network, outage).
      setError(extractApiError(err, 'Could not send the reset link. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  // Deliberately identical whether or not the address is on file — the backend
  // won't say, and neither should this screen. Confirming "no such account"
  // would hand anyone who can type an email a way to enumerate our users.
  if (sent) {
    return (
      <AuthSplitLayout
        visualTitle="Check your inbox."
        visualSubtitle="The link is good for one hour."
      >
        <div style={s.header}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📬</div>
          <h2 style={s.title}>Check your email</h2>
          <p style={s.subtitle}>
            If an account exists for <strong>{email.trim().toLowerCase()}</strong>, we&apos;ve sent
            it a link to choose a new password. It expires in an hour and can only be used once.
          </p>
        </div>

        <div style={{ ...s.alertInfo, marginBottom: 24 }}>
          Nothing arrived? Check your spam folder, then try again in a few minutes.
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
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout
      visualTitle="Locked out? It happens."
      visualSubtitle="We'll get you back into your studio in no time."
    >
      <div style={s.header}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔑</div>
        <h2 style={s.title}>Reset your password</h2>
        <p style={s.subtitle}>
          Enter your email address and we&apos;ll send you a link to choose a new password.
        </p>
      </div>

      {error && <div style={s.alertError}>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div style={s.formGroup}>
          <label style={s.label} htmlFor="forgot-email">
            Email address
          </label>
          <input
            id="forgot-email"
            type="email"
            style={{ ...s.input, ...(focused ? s.inputFocus : {}) }}
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoComplete="email"
            autoFocus
          />
        </div>

        <button
          type="submit"
          style={{ ...s.button, ...s.buttonPrimary, ...(loading ? s.buttonDisabled : {}) }}
          disabled={loading}
          onMouseEnter={(e) => {
            if (!loading) Object.assign(e.currentTarget.style, s.buttonPrimaryHover);
          }}
          onMouseLeave={(e) => {
            if (!loading) Object.assign(e.currentTarget.style, s.buttonPrimary);
          }}
        >
          {loading ? 'Sending link…' : 'Send reset link'}
        </button>
      </form>

      <div style={{ ...s.alertInfo, marginTop: 24 }}>
        Tip: if you&apos;re a client, you don&apos;t need a password — use your emailed magic link
        to sign in.
      </div>

      <p style={{ ...s.centerText, color: colors.textSubtle }}>
        Remembered it?{' '}
        <Link href="/login" style={{ ...s.link, color: colors.textMuted }}>
          Back to sign in
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
