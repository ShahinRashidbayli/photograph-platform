'use client';

import api from '@/lib/api';
import { AuthSplitLayout } from '@/components/AuthSplitLayout';
import { AuthStatusCard } from '@/components/AuthStatusCard';
import { getColors } from '@/lib/design-tokens';
import { extractApiError } from '@/lib/helpers';
import { useTranslation } from '@/lib/i18n';
import { isRateLimited } from '@/lib/rate-limit';
import { useRetryWait } from '@/lib/useRetryWait';
import { useThemeStore } from '@/store/themeStore';
import Link from 'next/link';
import { useState } from 'react';
import { getAuthStyles } from '../auth.styles';

export default function ForgotPasswordPage() {
  const theme = useThemeStore((st) => st.theme);
  const colors = getColors(theme);
  const s = getAuthStyles(theme);
  const { t } = useTranslation();
  const retryWait = useRetryWait();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError(t('forgot.errorRequired'));
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
      if (isRateLimited(err)) {
        const wait = retryWait(err);
        setError(wait ? t('forgot.errorRateLimitedFor', { wait }) : t('forgot.errorRateLimited'));
      } else {
        setError(extractApiError(err, t('forgot.errorSend')));
      }
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
        visualTitle={t('forgot.sentVisualTitle')}
        visualSubtitle={t('forgot.sentVisualSubtitle')}
      >
        <AuthStatusCard
          tone="success"
          title={t('forgot.sentTitle')}
          message={t('forgot.sentBody', { email: email.trim().toLowerCase() })}
        >
          <div style={{ ...s.alertInfo, marginBottom: 0, textAlign: 'left' }}>
            {t('forgot.sentHint')}
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
            {t('forgot.backToSignIn')}
          </Link>
        </AuthStatusCard>
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout
      visualTitle={t('forgot.visualTitle')}
      visualSubtitle={t('forgot.visualSubtitle')}
    >
      <div style={s.header}>
        <h2 style={s.title}>{t('forgot.title')}</h2>
        <p style={s.subtitle}>{t('forgot.subtitle')}</p>
      </div>

      {error && (
        <div style={s.alertError} role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div style={s.formGroup}>
          <label style={s.label} htmlFor="forgot-email">
            {t('forgot.emailLabel')}
          </label>
          <input
            id="forgot-email"
            type="email"
            style={{ ...s.input, ...(focused ? s.inputFocus : {}) }}
            placeholder={t('auth.emailPlaceholder')}
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
          {loading ? t('forgot.submitLoading') : t('forgot.submit')}
        </button>
      </form>

      <div style={{ ...s.alertInfo, marginTop: 24 }}>{t('forgot.clientTip')}</div>

      <p style={{ ...s.centerText, color: colors.textSubtle }}>
        {t('forgot.remembered')}{' '}
        <Link href="/login" style={{ ...s.link, color: colors.textMuted }}>
          {t('forgot.backToSignIn')}
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
