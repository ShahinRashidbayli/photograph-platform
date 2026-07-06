'use client';

import api from '@/lib/api';
import { AuthSplitLayout } from '@/components/AuthSplitLayout';
import { Icon } from '@/components/Icon';
import { getColors } from '@/lib/design-tokens';
import { useThemeStore } from '@/store/themeStore';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { getAuthStyles } from '../../../(auth)/auth.styles';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

type FocusField = 'email' | 'subdomain' | 'fullName' | null;

function CustomerLoginInner() {
  const searchParams = useSearchParams();
  const initialSubdomain = (searchParams.get('subdomain') ?? '').trim().toLowerCase();

  const theme = useThemeStore((st) => st.theme);
  const colors = getColors(theme);
  const s = getAuthStyles(theme);

  const [email, setEmail] = useState('');
  const [subdomain, setSubdomain] = useState(initialSubdomain);
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [focused, setFocused] = useState<FocusField>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedSubdomain = subdomain.trim().toLowerCase();

    if (!trimmedEmail || !trimmedSubdomain) {
      setError('Email and photographer subdomain are required');
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError('Please enter a valid email address');
      return;
    }
    if (!SUBDOMAIN_REGEX.test(trimmedSubdomain)) {
      setError('Please enter a valid photographer subdomain (e.g. anna-foto)');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await api.post('/api/auth/customer/magic-link/request', {
        email: trimmedEmail,
        subdomain: trimmedSubdomain,
        fullName: fullName.trim() || null,
      });
      setSubmitted(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Could not send magic link. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field: FocusField) => ({
    ...s.input,
    ...(focused === field ? s.inputFocus : {}),
  });

  return (
    <AuthSplitLayout
      crossLink={{ href: '/login', label: 'Photographer sign in' }}
      visualImage="/brand/auth-visual-client.jpg"
      visualTitle="Your photos, your moments"
      visualSubtitle="Sign in to track your booking, view your gallery and message your photographer."
    >
      {!submitted ? (
        <>
          <div style={s.header}>
            <h2 style={s.title}>Sign in as a client</h2>
            <p style={s.subtitle}>
              Enter your email and your photographer&apos;s subdomain — we&apos;ll send you a
              one-time link to sign in. No password needed.
            </p>
          </div>

          {error && <div style={s.alertError}>{error}</div>}

          <form onSubmit={handleSubmit}>
            <div style={s.formGroup}>
              <label style={s.label}>Email address</label>
              <input
                type="email"
                style={inputStyle('email')}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                autoComplete="email"
              />
            </div>

            <div style={s.formGroup}>
              <label style={s.label}>Photographer subdomain</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
                <input
                  type="text"
                  style={inputStyle('subdomain')}
                  placeholder="anna-foto"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                  onFocus={() => setFocused('subdomain')}
                  onBlur={() => setFocused(null)}
                  autoComplete="off"
                  spellCheck={false}
                />
                <div
                  style={{
                    ...s.input,
                    display: 'flex',
                    alignItems: 'center',
                    background: colors.surfaceHover,
                    cursor: 'default',
                    color: colors.textMuted,
                  }}
                >
                  .fotolio.de
                </div>
              </div>
              <div style={s.helperText}>The subdomain your photographer shared with you.</div>
            </div>

            <div style={s.formGroup}>
              <label style={s.label}>Full name (optional)</label>
              <input
                type="text"
                style={inputStyle('fullName')}
                placeholder="Maria Klein"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onFocus={() => setFocused('fullName')}
                onBlur={() => setFocused(null)}
                autoComplete="name"
              />
              <div style={s.helperText}>Only used the first time you sign in.</div>
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
              {loading ? 'Sending link…' : 'Send me a magic link →'}
            </button>
          </form>

          <p style={{ ...s.centerText, marginTop: 18 }}>
            First time here? No sign-up needed — entering your details sets up your account
            automatically.
          </p>
        </>
      ) : (
        <div style={s.header}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: colors.primaryBg,
              color: colors.primaryText,
              border: `1px solid ${colors.primaryBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            <Icon name="mail" size={28} />
          </div>
          <h2 style={s.title}>Check your inbox</h2>
          <p style={s.subtitle}>
            If <strong>{email}</strong> is registered with that photographer, we just sent you a
            sign-in link. It&apos;s valid for 15 minutes.
          </p>
          <div style={{ ...s.alertInfo, marginTop: 24 }}>
            Didn&apos;t get it? Check your spam folder, or request a new one in a few minutes.
          </div>
        </div>
      )}
    </AuthSplitLayout>
  );
}

export default function CustomerLoginPage() {
  return (
    <Suspense fallback={null}>
      <CustomerLoginInner />
    </Suspense>
  );
}
