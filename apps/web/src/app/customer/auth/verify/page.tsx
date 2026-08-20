'use client';

import api from '@/lib/api';
import { AuthUser, useAuthStore } from '@/store/authStore';
import { FotolioLogo } from '@/components/FotolioLogo';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { authStyles } from '../../../(auth)/auth.styles';

type Status = 'loading' | 'success' | 'error';

function CustomerVerifyInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setUser = useAuthStore((s) => s.setUser);
  const token = searchParams.get('token');

  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('Signing you in…');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage(
        'This sign-in link is missing its token. Request a new one from your photographer.'
      );
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
        setMessage('You are signed in. Redirecting to your bookings…');
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
        const apiMessage = (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error;
        setStatus('error');
        setMessage(
          apiMessage ??
            'This sign-in link is invalid or has expired. Request a new one from the sign-in page.'
        );
      }
    })();
    return () => {
      cancelled = true;
      if (redirectTimer !== undefined) window.clearTimeout(redirectTimer);
    };
  }, [token, setUser, router]);

  const accent = status === 'success' ? '#10B981' : status === 'error' ? '#EF4444' : '#3B82F6';

  return (
    <div style={authStyles.page}>
      <nav style={authStyles.navbar}>
        <Link href="/" style={{ ...authStyles.navBrand, textDecoration: 'none' }}>
          <FotolioLogo theme="light" showText={true} />
        </Link>
      </nav>

      <div style={authStyles.container}>
        <div style={authStyles.content}>
          <div style={authStyles.card}>
            <div style={authStyles.header}>
              <h2 style={authStyles.title}>
                {status === 'loading' && 'Signing you in'}
                {status === 'success' && 'Welcome back'}
                {status === 'error' && 'Sign-in failed'}
              </h2>
              <p style={{ ...authStyles.subtitle, color: accent }}>{message}</p>
            </div>

            {status === 'error' && (
              <Link
                href="/customer/auth/login"
                style={{
                  ...authStyles.button,
                  ...authStyles.buttonPrimary,
                  textDecoration: 'none',
                  display: 'inline-block',
                  textAlign: 'center',
                  boxSizing: 'border-box',
                }}
              >
                Request a new link
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomerVerifyPage() {
  return (
    <Suspense fallback={null}>
      <CustomerVerifyInner />
    </Suspense>
  );
}
