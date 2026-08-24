'use client';

import api from '@/lib/api';
import { AuthSplitLayout } from '@/components/AuthSplitLayout';
import { AuthStatusCard, type AuthStatusTone } from '@/components/AuthStatusCard';
import { extractApiError } from '@/lib/helpers';
import { useTranslation } from '@/lib/i18n';
import { AuthUser, useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { getAuthStyles } from '../../../(auth)/auth.styles';

function CustomerVerifyInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setUser = useAuthStore((s) => s.setUser);
  const token = searchParams.get('token');
  const theme = useThemeStore((st) => st.theme);
  const s = getAuthStyles(theme);
  const { t } = useTranslation();

  const [status, setStatus] = useState<AuthStatusTone>('loading');
  const [apiMessage, setApiMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }
    let cancelled = false;
    let redirectTimer: number | undefined;
    (async () => {
      try {
        const { data: user } = await api.post<AuthUser>('/api/auth/customer/magic-link/verify', {
          token,
        });
        if (cancelled) return;
        setUser(user);
        setStatus('success');
        // replace, not push: drops the token-bearing /verify URL from history so
        // the single-use magic-link token can't resurface via Back or be leaked
        // through the referrer of a later navigation.
        //
        // Tracked so the cleanup below can cancel it — the `cancelled` flag
        // guards the setState calls but did not stop this timer, so navigating
        // away inside the 800ms pause still bounced the user to /bookings.
        redirectTimer = window.setTimeout(() => router.replace('/bookings'), 800);
      } catch (err: unknown) {
        if (cancelled) return;
        setApiMessage(extractApiError(err, ''));
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      if (redirectTimer !== undefined) window.clearTimeout(redirectTimer);
    };
  }, [token, setUser, router]);

  const title = {
    loading: t('customerVerify.loadingTitle'),
    success: t('customerVerify.successTitle'),
    error: t('customerVerify.errorTitle'),
  }[status];

  const message = (() => {
    if (status === 'loading') return t('customerVerify.loadingBody');
    if (status === 'success') return t('customerVerify.successBody');
    if (!token) return t('customerVerify.errorMissingToken');
    return apiMessage || t('customerVerify.errorInvalid');
  })();

  return (
    <AuthSplitLayout
      visualImage="/brand/auth-visual-client.jpg"
      visualTitle={t('customerVerify.visualTitle')}
      visualSubtitle={t('customerVerify.visualSubtitle')}
    >
      <AuthStatusCard tone={status} title={title} message={message}>
        {status === 'error' && (
          <Link
            href="/customer/auth/login"
            style={{
              ...s.button,
              ...s.buttonPrimary,
              display: 'block',
              textAlign: 'center',
              textDecoration: 'none',
              boxSizing: 'border-box',
            }}
          >
            {t('customerVerify.requestNew')}
          </Link>
        )}
      </AuthStatusCard>
    </AuthSplitLayout>
  );
}

export default function CustomerVerifyPage() {
  return (
    <Suspense fallback={null}>
      <CustomerVerifyInner />
    </Suspense>
  );
}
