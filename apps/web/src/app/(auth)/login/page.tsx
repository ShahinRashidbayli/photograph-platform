'use client';

import api from '@/lib/api';
import { AuthUser, useAuthStore } from '@/store/authStore';
import { FotolioLogo } from '@/components/FotolioLogo';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authStyles } from '../auth.styles';

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setError('Email and password are required');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const { data: user } = await api.post<AuthUser>('/api/auth/login', {
        email: trimmedEmail,
        password,
      });
      setUser(user);
      const role = user.role?.toUpperCase();
      const isPhotographer = role === 'PHOTOGRAPHER' || role === 'ADMIN';
      router.push(isPhotographer ? '/dashboard' : '/bookings');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        setError('Invalid email or password');
      } else {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          'Login failed';
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={authStyles.page}>
      {/* Navbar */}
      <nav style={authStyles.navbar}>
        <Link href="/" style={{ ...authStyles.navBrand, textDecoration: 'none' }}>
          <FotolioLogo theme="light" showText={true} />
        </Link>

        <div style={authStyles.navRight}>
          <Link
            href="/register"
            style={{
              ...authStyles.navButton,
              ...authStyles.navButtonPrimary,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#1E293B';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#0F172A';
            }}
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* Main content */}
      <div style={authStyles.container}>
        <div style={authStyles.content}>
          <div style={authStyles.card}>
            <div style={authStyles.header}>
              <h2 style={authStyles.title}>Welcome back</h2>
              <p style={authStyles.subtitle}>Enter your email and password to sign in.</p>
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
                <label style={authStyles.label}>Password</label>
                <input
                  type="password"
                  style={authStyles.input}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                style={{
                  ...authStyles.button,
                  ...authStyles.buttonPrimary,
                  ...(loading ? authStyles.buttonDisabled : {}),
                }}
                disabled={loading}
                onMouseEnter={(e) => {
                  if (!loading)
                    Object.assign(e.currentTarget.style, authStyles.buttonPrimaryHover);
                }}
                onMouseLeave={(e) => {
                  if (!loading) Object.assign(e.currentTarget.style, authStyles.buttonPrimary);
                }}
              >
                {loading ? 'Signing in...' : 'Sign in →'}
              </button>
            </form>

            <div style={authStyles.divider}>
              <div style={authStyles.dividerLine} />
            </div>

            <p style={authStyles.centerText}>
              Don&apos;t have an account?{' '}
              <Link
                href="/register"
                style={{
                  ...authStyles.link,
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) =>
                  Object.assign(e.currentTarget.style, authStyles.linkHover)
                }
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#3B82F6';
                }}
              >
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
