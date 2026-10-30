'use client';

import api from '@/lib/api';
import { AuthSplitLayout } from '@/components/AuthSplitLayout';
import { AuthStatusCard, type AuthStatusTone } from '@/components/AuthStatusCard';
import { extractApiError } from '@/lib/helpers';
import { useTranslation } from '@/lib/i18n';
import { useThemeStore } from '@/store/themeStore';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { getAuthStyles } from '../auth.styles';

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const theme = useThemeStore((st) => st.theme);
  const s = getAuthStyles(theme);
  const { t } = useTranslation();

  const [status, setStatus] = useState<AuthStatusTone>('loading');
  // Only set for failures the API described itself; otherwise the translated
  // fallback is used, so the screen is never blank and never English-only.
  const [apiMessage, setApiMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await api.post('/api/auth/verify-email', { token });
        if (!cancelled) setStatus('success');
      } catch (err: unknown) {
        if (cancelled) return;
        setApiMessage(extractApiError(err, ''));
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const title = {
    loading: t('verifyEmail.loadingTitle'),
    success: t('verifyEmail.successTitle'),
    error: t('verifyEmail.errorTitle'),
  }[status];

  const message = (() => {
    if (status === 'loading') return t('verifyEmail.loadingBody');
    if (status === 'success') return t('verifyEmail.successBody');
    if (!token) return t('verifyEmail.errorMissingToken');
    return apiMessage || t('verifyEmail.errorInvalid');
  })();

  const linkButton = (href: string, label: string, primary: boolean) => (
    <Link
      href={href}
      style={{
        ...s.button,
        ...(primary ? s.buttonPrimary : s.buttonSecondary),
        display: 'block',
        textAlign: 'center',
        textDecoration: 'none',
        boxSizing: 'border-box',
      }}
    >
      {label}
    </Link>
  );

  return (
    <AuthSplitLayout
      visualTitle={t('verifyEmail.visualTitle')}
      visualSubtitle={t('verifyEmail.visualSubtitle')}
    >
      <AuthStatusCard tone={status} title={title} message={message}>
        {/* Nothing to offer while the request is still in flight — a button
            here would just race the redirect it is competing with. On failure
            the dashboard is the wrong suggestion: confirmation failed, so the
            useful next step is to sign in and request another mail. */}
        {status === 'success' && (
          <>
            {linkButton('/dashboard', t('verifyEmail.goToDashboard'), true)}
            {linkButton('/login', t('verifyEmail.signIn'), false)}
          </>
        )}
        {status === 'error' && linkButton('/login', t('verifyEmail.signIn'), true)}
      </AuthStatusCard>
    </AuthSplitLayout>
  );
}

export default function VerifyEmailPage() {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  );
}
