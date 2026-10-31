'use client';

import { AuthSplitLayout } from '@/components/AuthSplitLayout';
import { PasswordField } from '@/components/PasswordField';
import { extractApiError } from '@/lib/helpers';
import { isRateLimited } from '@/lib/rate-limit';
import { useRetryWait } from '@/lib/useRetryWait';
import { useLogin } from '@/hooks/useAuth';
import { useThemeStore } from '@/store/themeStore';
import { useTranslation } from '@/lib/i18n';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { safeRedirectPath } from '@/lib/safe-redirect';
import { CLIENT_LOGIN, withPreservedNext } from '@/lib/login-redirect';
import { useEffect, useState } from 'react';
import { getAuthStyles } from '../auth.styles';

export default function LoginPage() {
  const router = useRouter();
  const login = useLogin();
  const theme = useThemeStore((st) => st.theme);
  const s = getAuthStyles(theme);
  const { t } = useTranslation();
  const retryWait = useRetryWait();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const loading = login.isPending;
  const [focused, setFocused] = useState(false);

  // Read after mount rather than during render: this is a client component with
  // no Suspense boundary, so `useSearchParams` would opt the whole route out of
  // prerendering, and reading `window` in the render body would not match what
  // the server produced.
  const [search, setSearch] = useState('');
  useEffect(() => setSearch(window.location.search), []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setError(t('login.errorRequired'));
      return;
    }

    setError('');
    login.mutate(
      { email: trimmedEmail, password },
      {
        onSuccess: (user) => {
          const role = user.role?.toUpperCase();
          const isPhotographer = role === 'PHOTOGRAPHER' || role === 'ADMIN';
          // The middleware puts the blocked destination in `?next=` precisely so
          // login can return to it ("Preserve the original destination so
          // post-login can return to it"), but nothing ever read it — so any deep
          // link into the app (an emailed booking link, a bookmarked lead) lost
          // its target and dumped the user on the dashboard.
          const next =
            typeof window === 'undefined'
              ? null
              : safeRedirectPath(window.location.search, window.location.origin);
          router.push(next ?? (isPhotographer ? '/dashboard' : '/bookings'));
        },
        onError: (err) => {
          // A lockout gets its own message. The backend counts failed attempts
          // against the submitted address whether or not an account exists, so
          // naming the lockout leaks nothing — while folding it into "invalid
          // password" told someone typing the correct password that it was wrong.
          if (isRateLimited(err)) {
            const wait = retryWait(err);
            setError(wait ? t('login.errorLockedFor', { wait }) : t('login.errorLocked'));
          } else if ((err as { response?: { status?: number } })?.response?.status === 401) {
            setError(t('login.errorInvalid'));
          } else {
            setError(extractApiError(err, t('login.errorGeneric')));
          }
        },
      }
    );
  };

  return (
    // Clients sign in via the "Client sign in" cross-link — they normally
    // arrive on their photographer's own subdomain, so the platform login
    // keeps that path low-emphasis rather than duplicating it here.
    <AuthSplitLayout
      visualTitle={t('login.visualTitle')}
      visualSubtitle={t('login.visualSubtitle')}
      crossLink={{
        // Keep `?next=` across the switch: a client sent here by the middleware
        // and correcting themselves should not lose the link that sent them.
        href: withPreservedNext(CLIENT_LOGIN, search),
        label: t('login.crossLink'),
      }}
    >
      <div style={s.header}>
        <h2 style={s.title}>{t('login.title')}</h2>
        <p style={s.subtitle}>{t('login.subtitle')}</p>
      </div>

      {error && (
        <div style={s.alertError} role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div style={s.formGroup}>
          <label style={s.label} htmlFor="login-email">
            {t('login.emailLabel')}
          </label>
          <input
            id="login-email"
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

        <PasswordField
          id="login-password"
          label={t('login.passwordLabel')}
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
          <Link href="/forgot-password" style={{ ...s.link, fontSize: '0.85rem' }}>
            {t('login.forgot')}
          </Link>
        </div>

        <button
          type="submit"
          style={{
            ...s.button,
            ...s.buttonPrimary,
            ...(loading ? s.buttonDisabled : {}),
          }}
          disabled={loading}
          onMouseEnter={(e) => {
            if (!loading) Object.assign(e.currentTarget.style, s.buttonPrimaryHover);
          }}
          onMouseLeave={(e) => {
            if (!loading) Object.assign(e.currentTarget.style, s.buttonPrimary);
          }}
        >
          {loading ? t('login.submitLoading') : t('login.submit')}
        </button>
      </form>

      <div style={s.divider}>
        <div style={s.dividerLine} />
      </div>

      <p style={s.centerText}>
        {t('login.noAccount')}{' '}
        <Link href="/register" style={s.link}>
          {t('login.createOne')}
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
