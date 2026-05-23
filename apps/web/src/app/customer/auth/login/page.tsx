'use client';

import api from '@/lib/api';
import { FotolioLogo } from '@/components/FotolioLogo';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { authStyles } from '../../../(auth)/auth.styles';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

function CustomerLoginInner() {
  const searchParams = useSearchParams();
  const initialSubdomain = (searchParams.get('subdomain') ?? '').trim().toLowerCase();

  const [email, setEmail] = useState('');
  const [subdomain, setSubdomain] = useState(initialSubdomain);
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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

  return (
    <div style={authStyles.page}>
      <nav style={authStyles.navbar}>
        <Link href="/" style={{ ...authStyles.navBrand, textDecoration: 'none' }}>
          <FotolioLogo theme="light" showText={true} />
        </Link>
        <div style={authStyles.navRight}>
          <Link
            href="/login"
            style={{ ...authStyles.navButton, ...authStyles.navButtonPrimary }}
          >
            Photographer sign in
          </Link>
        </div>
      </nav>

      <div style={authStyles.container}>
        <div style={authStyles.content}>
          <div style={authStyles.card}>
            {!submitted ? (
              <>
                <div style={authStyles.header}>
                  <h2 style={authStyles.title}>Sign in as a client</h2>
                  <p style={authStyles.subtitle}>
                    Enter your email and your photographer&apos;s subdomain — we&apos;ll send you
                    a one-time link to sign in. No password needed.
                  </p>
                </div>

                {error && <div style={authStyles.alertError}>{error}</div>}

                <form onSubmit={handleSubmit}>
                  <div style={authStyles.formGroup}>
                    <label style={authStyles.label}>Email address</label>
                    <input
                      type="email"
                      style={authStyles.input}
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </div>

                  <div style={authStyles.formGroup}>
                    <label style={authStyles.label}>Photographer subdomain</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
                      <input
                        type="text"
                        style={authStyles.input}
                        placeholder="anna-foto"
                        value={subdomain}
                        onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <div
                        style={{
                          ...authStyles.input,
                          background: '#F8FAFC',
                          cursor: 'default',
                          color: '#64748B',
                        }}
                      >
                        .fotolio.de
                      </div>
                    </div>
                    <div style={authStyles.helperText}>
                      The subdomain your photographer shared with you.
                    </div>
                  </div>

                  <div style={authStyles.formGroup}>
                    <label style={authStyles.label}>Full name (optional)</label>
                    <input
                      type="text"
                      style={authStyles.input}
                      placeholder="Maria Klein"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      autoComplete="name"
                    />
                    <div style={authStyles.helperText}>
                      Only used the first time you sign in.
                    </div>
                  </div>

                  <button
                    type="submit"
                    style={{
                      ...authStyles.button,
                      ...authStyles.buttonPrimary,
                      ...(loading ? authStyles.buttonDisabled : {}),
                    }}
                    disabled={loading}
                  >
                    {loading ? 'Sending link…' : 'Send me a magic link →'}
                  </button>
                </form>
              </>
            ) : (
              <div style={authStyles.header}>
                <div style={authStyles.successIcon}>📧</div>
                <h2 style={authStyles.title}>Check your inbox</h2>
                <p style={authStyles.subtitle}>
                  If <strong>{email}</strong> is registered with that photographer, we just sent
                  you a sign-in link. It&apos;s valid for 15 minutes.
                </p>
                <div style={{ ...authStyles.alertInfo, marginTop: 24 }}>
                  Didn&apos;t get it? Check your spam folder, or request a new one in a few
                  minutes.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomerLoginPage() {
  return (
    <Suspense fallback={null}>
      <CustomerLoginInner />
    </Suspense>
  );
}
