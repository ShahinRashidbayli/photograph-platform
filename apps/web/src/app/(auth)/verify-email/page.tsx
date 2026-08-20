'use client';

import api from '@/lib/api';
import { FotolioLogo } from '@/components/FotolioLogo';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { authStyles } from '../auth.styles';

type Status = 'loading' | 'success' | 'error';

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('Confirming your email…');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage(
        'This verification link is missing its token. Request a new email from your dashboard.'
      );
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await api.post('/api/auth/verify-email', { token });
        if (cancelled) return;
        setStatus('success');
        setMessage(
          'Your email is confirmed. You can close this tab or continue to your dashboard.'
        );
      } catch (err: unknown) {
        if (cancelled) return;
        const apiMessage = (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error;
        setStatus('error');
        setMessage(
          apiMessage ??
            'This verification link is invalid or has expired. Request a new one from your dashboard.'
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const accent = status === 'success' ? '#10B981' : status === 'error' ? '#EF4444' : '#3B82F6';

  return (
    <div style={authStyles.page}>
      <nav style={authStyles.navbar}>
        <Link href="/" style={{ ...authStyles.navBrand, textDecoration: 'none' }}>
          <FotolioLogo theme="light" showText={true} />
        </Link>
        <div style={authStyles.navRight}>
          <Link href="/login" style={{ ...authStyles.navButton, ...authStyles.navButtonPrimary }}>
            Sign in
          </Link>
        </div>
      </nav>

      <div style={authStyles.container}>
        <div style={authStyles.content}>
          <div style={authStyles.card}>
            <div style={authStyles.header}>
              <h2 style={authStyles.title}>
                {status === 'loading' && 'Confirming your email'}
                {status === 'success' && 'Email confirmed'}
                {status === 'error' && 'Verification failed'}
              </h2>
              <p style={{ ...authStyles.subtitle, color: accent }}>{message}</p>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <Link
                href="/dashboard"
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: '#0F172A',
                  color: '#FFFFFF',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: 15,
                }}
              >
                Go to dashboard
              </Link>
              <Link
                href="/login"
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: '1px solid #D1D5DB',
                  background: '#FFFFFF',
                  color: '#111827',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: 15,
                }}
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  );
}
