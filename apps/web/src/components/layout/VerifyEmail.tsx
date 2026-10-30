'use client';

import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

export function EmailVerifyToast() {
  // Holds the server-supplied message, or an empty string when the event
  // carried none — the fallback is resolved at render so it follows the
  // active language rather than the one in effect when the event fired.
  const [toast, setToast] = useState<{ text: string } | null>(null);
  const { t } = useTranslation();

  // One timer, restarted per event. Scheduling a fresh un-tracked timeout on
  // every event meant they stacked: a dashboard page fires several gated
  // requests at once, so three 403s scheduled three dismissals, and the first
  // to expire cleared the *latest* toast — the message vanished a second after
  // appearing, precisely when it fired most often. Tracking it in a ref also
  // lets the unmount cleanup cancel a pending dismissal.
  const dismissTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setToast({ text: detail?.message ?? '' });
      if (dismissTimer.current !== undefined) window.clearTimeout(dismissTimer.current);
      dismissTimer.current = window.setTimeout(() => setToast(null), 6000);
    };
    window.addEventListener('app:email-not-verified', handler);
    return () => {
      window.removeEventListener('app:email-not-verified', handler);
      if (dismissTimer.current !== undefined) window.clearTimeout(dismissTimer.current);
    };
  }, []);

  if (!toast) return null;
  const message = toast.text || t('verify.toastDefault');

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        right: 20,
        bottom: 24,
        zIndex: 60,
        maxWidth: 360,
        background: '#0F172A',
        color: '#F8FAFC',
        padding: '14px 18px',
        borderRadius: 10,
        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.35)',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        fontSize: 14,
        lineHeight: 1.5,
        animation: 'toast-in 0.2s ease-out',
      }}
    >
      <style>{`@keyframes toast-in { from { transform: translateY(8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
      <span style={{ flex: '0 0 auto', marginTop: 2 }}>⚠️</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>{t('verify.toastTitle')}</div>
        <div style={{ color: '#CBD5E1' }}>{message}</div>
      </div>
      <button
        onClick={() => setToast(null)}
        aria-label={t('verify.dismiss')}
        style={{
          flex: '0 0 auto',
          width: 24,
          height: 24,
          border: 'none',
          background: 'transparent',
          color: '#CBD5E1',
          cursor: 'pointer',
          fontSize: 18,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

export function VerifyEmailBanner({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const { t } = useTranslation();

  async function resend() {
    setState('sending');
    setMessage('');
    try {
      await api.post('/api/auth/resend-verification');
      setState('sent');
      setMessage(t('verify.bannerSent', { email }));
    } catch (err: unknown) {
      const apiMessage = (err as { response?: { data?: { error?: string } } })?.response?.data
        ?.error;
      setState('error');
      setMessage(apiMessage ?? t('verify.bannerError'));
    }
  }

  return (
    <div
      role="status"
      style={{
        margin: '12px 16px 0',
        padding: '12px 16px',
        borderRadius: 10,
        border: '1px solid #FCD34D',
        background: '#FFFBEB',
        color: '#78350F',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        fontSize: 14,
      }}
    >
      <span style={{ flex: 1, minWidth: 220 }}>
        <strong>{t('verify.bannerTitle')}</strong>{' '}
        {state === 'sent' || state === 'error' ? message : t('verify.bannerBody', { email })}
      </span>
      <button
        type="button"
        onClick={resend}
        disabled={state === 'sending' || state === 'sent'}
        style={{
          padding: '8px 14px',
          borderRadius: 8,
          border: '1px solid #B45309',
          background: state === 'sent' ? '#FDE68A' : '#FFFFFF',
          color: '#78350F',
          fontWeight: 600,
          fontSize: 13,
          cursor: state === 'sending' || state === 'sent' ? 'not-allowed' : 'pointer',
        }}
      >
        {state === 'sending'
          ? t('verify.sending')
          : state === 'sent'
            ? t('verify.sent')
            : t('verify.resend')}
      </button>
    </div>
  );
}
