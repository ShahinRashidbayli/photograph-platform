'use client';

import api from '@/lib/api';
import { AuthSplitLayout } from '@/components/AuthSplitLayout';
import { AuthStatusCard } from '@/components/AuthStatusCard';
import { getColors } from '@/lib/design-tokens';
import { extractApiError } from '@/lib/helpers';
import { useTranslation } from '@/lib/i18n';
import { useThemeStore } from '@/store/themeStore';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { getAuthStyles } from '../auth.styles';

// Mirrors the backend rule in ResetPasswordRequest. Checked here purely so the
// user finds out before a round-trip — the server is still the one enforcing it.
const MIN_LENGTH = 10;
const HAS_LETTER_AND_DIGIT = /^(?=.*[A-Za-z])(?=.*\d).*$/;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const theme = useThemeStore((st) => st.theme);
  const colors = getColors(theme);
  const s = getAuthStyles(theme);
  const { t } = useTranslation();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [focused, setFocused] = useState<'password' | 'confirm' | null>(null);

  const passwordProblem = (): string | null => {
    if (password.length < MIN_LENGTH) {
      return t('reset.errorLength', { min: MIN_LENGTH });
    }
    if (!HAS_LETTER_AND_DIGIT.test(password)) {
      return t('reset.errorComposition');
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const problem = passwordProblem();
    if (problem) {
      setError(problem);
      return;
    }
    if (password !== confirm) {
      setError(t('reset.errorMismatch'));
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
        status === 401 ? t('reset.errorInvalidLink') : extractApiError(err, t('reset.errorGeneric'))
      );
    } finally {
      setLoading(false);
    }
  };

  const linkButton = (href: string, label: string) => (
    <Link
      href={href}
      style={{
        ...s.button,
        ...s.buttonPrimary,
        display: 'block',
        textAlign: 'center',
        textDecoration: 'none',
        boxSizing: 'border-box',
      }}
    >
      {label}
    </Link>
  );

  // A link without a token can't be acted on — say so rather than showing a form
  // that is guaranteed to fail on submit.
  if (!token) {
    return (
      <AuthSplitLayout
        visualTitle={t('reset.missingVisualTitle')}
        visualSubtitle={t('reset.missingVisualSubtitle')}
      >
        <AuthStatusCard
          tone="error"
          title={t('reset.missingTitle')}
          message={t('reset.missingBody')}
        >
          {linkButton('/forgot-password', t('reset.requestNew'))}
        </AuthStatusCard>
      </AuthSplitLayout>
    );
  }

  if (done) {
    return (
      <AuthSplitLayout
        visualTitle={t('reset.doneVisualTitle')}
        visualSubtitle={t('reset.doneVisualSubtitle')}
      >
        {/* Worth stating plainly: the reset revoked every existing session, so
            anyone who was signed in as them (including an intruder) is out. */}
        <AuthStatusCard tone="success" title={t('reset.doneTitle')} message={t('reset.doneBody')}>
          <button
            type="button"
            onClick={() => router.push('/login')}
            style={{ ...s.button, ...s.buttonPrimary }}
          >
            {t('reset.goToSignIn')}
          </button>
        </AuthStatusCard>
      </AuthSplitLayout>
    );
  }

  const inputStyle = (field: 'password' | 'confirm') => ({
    ...s.input,
    ...(focused === field ? s.inputFocus : {}),
  });

  return (
    <AuthSplitLayout
      visualTitle={t('reset.visualTitle')}
      visualSubtitle={t('reset.visualSubtitle')}
    >
      <div style={s.header}>
        <h2 style={s.title}>{t('reset.title')}</h2>
        <p style={s.subtitle}>{t('reset.subtitle', { min: MIN_LENGTH })}</p>
      </div>

      {error && (
        <div style={s.alertError} role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div style={s.formGroup}>
          <label style={s.label} htmlFor="reset-password">
            {t('reset.passwordLabel')}
          </label>
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
          <label style={s.label} htmlFor="reset-password-confirm">
            {t('reset.confirmLabel')}
          </label>
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
          {loading ? t('reset.submitLoading') : t('reset.submit')}
        </button>
      </form>

      <p style={{ ...s.centerText, color: colors.textSubtle }}>
        <Link href="/login" style={{ ...s.link, color: colors.textMuted }}>
          {t('reset.backToSignIn')}
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
