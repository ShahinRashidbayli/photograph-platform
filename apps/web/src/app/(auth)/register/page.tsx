'use client';

import api from '@/lib/api';
import { AuthUser, useAuthStore } from '@/store/authStore';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Step = 'role' | 'ph-form' | 'ph-success' | 'cu-info';
type Role = 'photographer' | 'client' | null;

const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface PasswordStrength {
  label: string;
  score: number;
  color: string;
}

function getPasswordStrength(pw: string): PasswordStrength {
  if (!pw) return { label: '', score: 0, color: '#E5E7EB' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: 'Weak', score, color: '#EF4444' };
  if (score <= 3) return { label: 'Medium', score, color: '#F59E0B' };
  return { label: 'Strong', score, color: '#10B981' };
}

function slugifySubdomain(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 63);
}

export default function RegisterPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  const [step, setStep] = useState<Step>('role');
  const [role, setRole] = useState<Role>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    subdomain: '',
  });

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
  };

  const validatePhForm = (): string | null => {
    const fullName = form.fullName.trim();
    const email = form.email.trim();
    const subdomain = form.subdomain.trim();

    if (!fullName || !email || !form.password || !subdomain) {
      return 'All fields are required';
    }
    if (!EMAIL_REGEX.test(email)) {
      return 'Please enter a valid email address';
    }
    if (form.password.length < 10) {
      return 'Password must be at least 10 characters';
    }
    if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      return 'Password must contain at least one letter and one digit';
    }
    if (!SUBDOMAIN_REGEX.test(subdomain)) {
      return 'Subdomain must be 3–63 chars, start and end with a letter or digit, hyphens allowed in between';
    }
    return null;
  };

  const handlePhSubmit = async () => {
    const validationError = validatePhForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setLoading(true);
    try {
      const { data: user } = await api.post<AuthUser>('/api/auth/register', {
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        subdomain: form.subdomain.trim(),
        role: 'PHOTOGRAPHER',
      });
      setUser(user);
      setStep('ph-success');
      setTimeout(() => router.push('/dashboard'), 1200);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Registration failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleContinue = () => {
    setError('');
    if (role === 'photographer') setStep('ph-form');
    else if (role === 'client') setStep('cu-info');
  };

  const handleBack = () => {
    setError('');
    setRole(null);
    setStep('role');
  };

  const passwordStrength = getPasswordStrength(form.password);

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
        {step === 'role' && (
          <div style={cardStyle}>
            <div style={{ marginBottom: '32px' }}>
              <h2 style={titleStyle}>Join Fotolio</h2>
              <p style={subtitleStyle}>Choose your role to set up the right experience.</p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '24px',
                marginBottom: '32px',
              }}
            >
              <button
                type="button"
                onClick={() => setRole('photographer')}
                style={{
                  padding: '36px 28px',
                  border: role === 'photographer' ? '2px solid #3B82F6' : '1px solid #E5E7EB',
                  borderRadius: '16px',
                  background: role === 'photographer' ? '#F0F9FF' : '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  textAlign: 'center',
                  boxShadow:
                    role === 'photographer'
                      ? '0 10px 24px rgba(59, 130, 246, 0.12)'
                      : '0 4px 12px rgba(15, 23, 42, 0.06)',
                  outline: 'none',
                }}
              >
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    background: '#DBEAFE',
                    borderRadius: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#3B82F6',
                    fontSize: '32px',
                    margin: '0 auto 20px',
                  }}
                >
                  💼
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 12px 0', color: '#111827' }}>
                  Photographer
                </h3>
                <p style={{ fontSize: '0.9rem', color: '#6B7280', margin: 0, lineHeight: '1.65' }}>
                  I want to manage my bookings, leads, contracts and gallery delivery
                </p>
              </button>

              <button
                type="button"
                onClick={() => setRole('client')}
                style={{
                  padding: '36px 28px',
                  border: role === 'client' ? '2px solid #10B981' : '1px solid #E5E7EB',
                  borderRadius: '16px',
                  background: role === 'client' ? '#F0FDF4' : '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  textAlign: 'center',
                  boxShadow:
                    role === 'client'
                      ? '0 10px 24px rgba(16, 185, 129, 0.12)'
                      : '0 4px 12px rgba(15, 23, 42, 0.06)',
                  outline: 'none',
                }}
              >
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    background: '#D1FAE5',
                    borderRadius: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#10B981',
                    fontSize: '32px',
                    margin: '0 auto 20px',
                  }}
                >
                  👤
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 12px 0', color: '#111827' }}>
                  Client
                </h3>
                <p style={{ fontSize: '0.9rem', color: '#6B7280', margin: 0, lineHeight: '1.65' }}>
                  I want to track my booking, view my photos and communicate with my photographer
                </p>
              </button>
            </div>

            <button
              type="button"
              onClick={handleRoleContinue}
              disabled={!role}
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: '10px',
                border: role ? '1px solid #D1D5DB' : '1px solid #E5E7EB',
                background: role ? '#FFFFFF' : '#F9FAFB',
                color: role ? '#111827' : '#9CA3AF',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: role ? 'pointer' : 'not-allowed',
                marginBottom: '24px',
                transition: 'all 0.3s ease',
                opacity: role ? 1 : 0.6,
              }}
            >
              Continue as {role ? role.charAt(0).toUpperCase() + role.slice(1) : 'role'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <span style={{ fontSize: '0.9rem', color: '#6B7280', fontWeight: 500 }}>
                Already have an account?{' '}
                <Link
                  href="/login"
                  style={{ color: '#2563EB', textDecoration: 'none', fontWeight: 600 }}
                >
                  Sign in
                </Link>
              </span>
            </div>
          </div>
        )}

        {step === 'ph-form' && (
          <div style={cardStyle}>
            <div style={{ marginBottom: '32px' }}>
              <h2 style={titleStyle}>Create your studio</h2>
              <p style={subtitleStyle}>
                14-day free trial · No credit card required
              </p>
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

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!loading) handlePhSubmit();
              }}
            >
              <div style={formGroupStyle}>
                <label style={labelStyle}>Full name</label>
                <input
                  type="text"
                  style={inputStyle}
                  placeholder="Anna Fischer"
                  value={form.fullName}
                  onChange={(e) => updateForm('fullName', e.target.value)}
                  autoComplete="name"
                />
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>Email address</label>
                <input
                  type="email"
                  style={inputStyle}
                  placeholder="anna@fotografie.de"
                  value={form.email}
                  onChange={(e) => updateForm('email', e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>Your subdomain</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
                  <input
                    type="text"
                    style={inputStyle}
                    placeholder="anna-foto"
                    value={form.subdomain}
                    onChange={(e) => updateForm('subdomain', slugifySubdomain(e.target.value))}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <div
                    style={{
                      ...inputStyle,
                      background: '#F8FAFC',
                      cursor: 'default',
                      color: '#64748B',
                    }}
                  >
                    .fotolio.de
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                  3–63 characters · lowercase letters, digits and hyphens
                </div>
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>Password</label>
                <input
                  type="password"
                  style={inputStyle}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => updateForm('password', e.target.value)}
                  autoComplete="new-password"
                />
                {form.password ? (
                  <div style={{ marginTop: '8px' }}>
                    <div
                      style={{
                        height: '4px',
                        borderRadius: '999px',
                        background: '#F1F5F9',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${(passwordStrength.score / 5) * 100}%`,
                          background: passwordStrength.color,
                          transition: 'width 0.2s ease, background 0.2s ease',
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: passwordStrength.color,
                        fontWeight: 600,
                        marginTop: '4px',
                      }}
                    >
                      {passwordStrength.label}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                    Min. 10 characters, with at least one letter and one digit
                  </div>
                )}
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
                {loading ? 'Creating studio…' : 'Create studio'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <button
                type="button"
                onClick={handleBack}
                style={{
                  color: '#2563EB',
                  textDecoration: 'none',
                  fontWeight: 600,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {step === 'ph-success' && (
          <div style={cardStyle}>
            <div style={{ marginBottom: '32px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
              <h2 style={titleStyle}>Welcome to Fotolio!</h2>
              <p style={{ fontSize: '14px', color: '#64748B', textAlign: 'center' }}>
                Your studio is live at {form.subdomain}.fotolio.de. Redirecting to your dashboard…
              </p>
            </div>
          </div>
        )}

        {step === 'cu-info' && (
          <div style={cardStyle}>
            <div style={{ marginBottom: '32px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📧</div>
              <h2 style={titleStyle}>Clients are invited</h2>
              <p style={subtitleStyle}>
                Fotolio clients don&apos;t self-register. Your photographer will send you a secure
                magic link by email after they&apos;ve added you to a booking.
              </p>
            </div>

            <div style={{
              background: '#F0F9FF',
              color: '#0C4A6E',
              border: '1px solid #BFDBFE',
              padding: '14px 16px',
              borderRadius: '10px',
              fontSize: '0.9rem',
              marginBottom: '20px',
            }}>
              Already received a magic link? Click the link in your email to sign in — no password
              needed.
            </div>

            <Link
              href="/customer/auth/login"
              style={{
                ...buttonPrimaryStyle,
                textDecoration: 'none',
                display: 'inline-block',
                textAlign: 'center',
                boxSizing: 'border-box',
              }}
            >
              Go to client sign in
            </Link>

            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <button
                type="button"
                onClick={handleBack}
                style={{
                  color: '#2563EB',
                  textDecoration: 'none',
                  fontWeight: 600,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                ← Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
