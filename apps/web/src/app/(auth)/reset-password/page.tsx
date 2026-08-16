'use client';

import api from '@/lib/api';
import { AuthSplitLayout } from '@/components/AuthSplitLayout';
import { getColors } from '@/lib/design-tokens';
import { extractApiError } from '@/lib/helpers';
import { useThemeStore } from '@/store/themeStore';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { getAuthStyles } from '../auth.styles';

// Mirrors the backend rule in ResetPasswordRequest. Checked here purely so the
// user finds out before a round-trip — the server is still the one enforcing it.
const MIN_LENGTH = 10;
const HAS_LETTER_AND_DIGIT = /^(?=.*[A-Za-z])(?=.*\d).*$/;

function passwordProblem(password: string): string | null {
  if (password.length < MIN_LENGTH) {
    return `Password must be at least ${MIN_LENGTH} characters.`;
  }
  if (!HAS_LETTER_AND_DIGIT.test(password)) {
    return 'Password must contain at least one letter and one digit.';
  }
  return null;
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const theme = useThemeStore((st) => st.theme);
  const colors = getColors(theme);
  const s = getAuthStyles(theme);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [focused, setFocused] = useState<'password' | 'confirm' | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const problem = passwordProblem(password);
    if (problem) {
      setError(problem);
      return;
    }
    if (password !== confirm) {
      setError('The two passwords don’t match.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await api.post('/api/auth/password/reset', { token, password });
      setDone(true);
    } catch (err) {
      // 401 covers unknown / expired / already-used alike: the backend refuses
      // to say which, so the link is simply "no longer usable".
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(
        status === 401
          ? 'This reset link is no longer valid. Request a new one and try again.'
          : extractApiError(err, 'Could not reset your password. Please try again.'),
      );
    } finally {
      setLoading(false);
    }
  };

  // A link without a token can't be acted on — say so rather than showing a form
  // that is guaranteed to fail on submit.
  if (!token) {
    return (
      <AuthSplitLayout visualTitle="That link looks incomplete.">
        <div style={s.header}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔒</div>
          <h2 style={s.title}>Link is missing its token</h2>
          <p style={s.subtitle}>
            Open the link straight from the email, or request a fresh one.
          </p>
        </div>
        <Link
          href="/forgot-password"
          style={{
            ...s.button,
            ...s.buttonPrimary,
            display: 'block',
            textAlign: 'center',
            textDecoration: 'none',
            boxSizing: 'border-box',
          }}
        >
          Request a new link
        </Link>
      </AuthSplitLayout>
    );
  }

  if (done) {
    return (
      <AuthSplitLayout
        visualTitle="You're all set."
        visualSubtitle="Sign in with your new password."
      >
        <div style={s.header}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
          <h2 style={s.title}>Password updated</h2>
          {/* Worth stating plainly: the reset revoked every existing session, so
              anyone who was signed in as them (including an intruder) is out. */}
          <p style={s.subtitle}>
            You&apos;ve been signed out everywhere else for safety. Sign in with your new
            password to continue.
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push('/login')}
          style={{ ...s.button, ...s.buttonPrimary }}
        >
          Go to sign in
        </button>
      </AuthSplitLayout>
    );
  }

  const inputStyle = (field: 'password' | 'confirm') => ({
    ...s.input,
    ...(focused === field ? s.inputFocus : {}),
  });

  return (
    <AuthSplitLayout
      visualTitle="Choose a new password."
      visualSubtitle="Make it something only you would pick."
    >
      <div style={s.header}>
        <h2 style={s.title}>Set a new password</h2>
        <p style={s.subtitle}>
          At least {MIN_LENGTH} characters, with a letter and a digit.
        </p>
      </div>

      {error && <div style={s.alertError}>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div style={s.formGroup}>
          <label style={s.label} htmlFor="reset-password">New password</label>
          <input
            id="reset-password"
            type="password"
            style={inputStyle('password')}
            placeholder="••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setFocused('password')}
            onBlur={() => setFocused(null)}
            autoComplete="new-password"
            autoFocus
          />
        </div>

        <div style={s.formGroup}>
          <label style={s.label} htmlFor="reset-password-confirm">Confirm new password</label>
          <input
            id="reset-password-confirm"
            type="password"
            style={inputStyle('confirm')}
            placeholder="••••••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onFocus={() => setFocused('confirm')}
            onBlur={() => setFocused(null)}
            autoComplete="new-password"
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
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>

      <p style={{ ...s.centerText, color: colors.textSubtle }}>
        <Link href="/login" style={{ ...s.link, color: colors.textMuted }}>
          Back to sign in
        </Link>
      </p>
    </AuthSplitLayout>
  );
}

export default function ResetPasswordPage() {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
