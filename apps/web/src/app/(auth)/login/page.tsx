'use client';

import api from '@/lib/api';
import { AuthSplitLayout } from '@/components/AuthSplitLayout';
import { getColors } from '@/lib/design-tokens';
import { AuthUser, useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getAuthStyles } from '../auth.styles';

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.4" />
      {off && (
        <path d="M3.5 3.5l13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      )}
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const theme = useThemeStore((st) => st.theme);
  const colors = getColors(theme);
  const s = getAuthStyles(theme);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);

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

  const inputStyle = (field: 'email' | 'password') => ({
    ...s.input,
    ...(focused === field ? s.inputFocus : {}),
  });

  return (
    // Clients sign in via the "Client sign in" cross-link — they normally
    // arrive on their photographer's own subdomain, so the platform login
    // keeps that path low-emphasis rather than duplicating it here.
    <AuthSplitLayout crossLink={{ href: '/customer/auth/login', label: 'Client sign in' }}>
      <div style={s.header}>
        <h2 style={s.title}>Welcome back</h2>
        <p style={s.subtitle}>Sign in to your Fotolio studio.</p>
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
          <label style={s.label}>Password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              style={{ ...inputStyle('password'), paddingRight: 44 }}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: colors.textSubtle,
                padding: 6,
              }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <EyeIcon off={showPassword} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
          <Link href="/forgot-password" style={{ ...s.link, fontSize: '0.85rem' }}>
            Forgot password?
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
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div style={s.divider}>
        <div style={s.dividerLine} />
      </div>

      <p style={s.centerText}>
        Don&apos;t have an account?{' '}
        <Link href="/register" style={s.link}>
          Create one
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
