'use client';

import api from '@/lib/api';
import { AuthUser, useAuthStore } from '@/store/authStore';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

  const cardStyle = {
    background: '#FFFFFF',
    borderRadius: '16px',
    padding: '48px 40px',
    boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)',
  };

  const titleStyle = {
    fontSize: '2rem',
    fontWeight: 700,
    color: '#0F172A',
    margin: '0 0 8px 0',
    lineHeight: 1.2,
  };

  const subtitleStyle = {
    fontSize: '0.95rem',
    color: '#64748B',
    margin: 0,
    lineHeight: 1.5,
  };

  const formGroupStyle = {
    marginBottom: '20px',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#0F172A',
    marginBottom: '8px',
    letterSpacing: '0.01em',
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    fontSize: '0.95rem',
    border: '1px solid #E2E8F0',
    borderRadius: '10px',
    color: '#0F172A',
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  };

  const buttonPrimaryStyle = {
    width: '100%',
    padding: '12px 18px',
    fontSize: '0.9rem',
    fontWeight: 600,
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    background: '#0F172A',
    color: '#FFFFFF',
    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
  };

  const buttonDisabledStyle = {
    opacity: 0.5,
    cursor: 'not-allowed',
  };

  const dividerStyle = {
    textAlign: 'center' as const,
    fontSize: '0.85rem',
    color: '#94A3B8',
    margin: '24px 0',
    position: 'relative' as const,
  };

  const dividerLineStyle = {
    borderTop: '1px solid #E2E8F0',
    marginTop: '8px',
    marginBottom: '8px',
  };

  const centerTextStyle = {
    textAlign: 'center' as const,
    fontSize: '0.9rem',
    color: '#64748B',
    marginTop: '20px',
    lineHeight: 1.5,
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #F7F8FB 0%, #E0E7FF 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: '560px', padding: '40px 24px' }}>
        <div style={cardStyle}>
          <div style={{ marginBottom: '32px' }}>
            <h2 style={titleStyle}>Welcome back</h2>
            <p style={subtitleStyle}>Enter your email and password to sign in.</p>
          </div>

          {error && (
            <div style={{
              background: '#FEF2F2',
              color: '#991B1B',
              border: '1px solid #FECACA',
              padding: '14px 16px',
              borderRadius: '10px',
              fontSize: '0.9rem',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={formGroupStyle}>
              <label style={labelStyle}>Email address</label>
              <input
                type="email"
                style={inputStyle}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div style={formGroupStyle}>
              <label style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  style={{ ...inputStyle, paddingRight: 40 }}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: inputStyle.color,
                    opacity: 0.5,
                    padding: 4,
                    fontSize: 14,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '👁️' : '🙈'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <Link
                href="/login"
                style={{
                  color: '#2563EB',
                  fontSize: '0.85rem',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#1D4ED8'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#2563EB'; }}
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              style={{
                ...buttonPrimaryStyle,
                ...(loading ? buttonDisabledStyle : {}),
              }}
              disabled={loading}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = '#1E293B';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(15, 23, 42, 0.2)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = '#0F172A';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.15)';
                }
              }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div style={dividerStyle}>
            <div style={dividerLineStyle} />
          </div>

          <p style={centerTextStyle}>
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              style={{
                color: '#2563EB',
                textDecoration: 'none',
                fontWeight: 600,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#1D4ED8'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#2563EB'; }}
            >
              Create one
            </Link>
          </p>

          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.9rem', color: '#64748B' }}>
            Are you a client?{' '}
            <Link
              href="/customer/auth/login"
              style={{ color: '#2563EB', textDecoration: 'none', fontWeight: 600 }}
            >
              Sign in with a magic link
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
