'use client';

import api from '@/lib/api';
import { AuthUser, useAuthStore } from '@/store/authStore';
import { FotolioLogo } from '@/components/FotolioLogo';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authStyles } from '../auth.styles';

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
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#1E293B';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#0F172A';
            }}
          >
            Sign in
          </Link>
        </div>
      </nav>

      <div style={authStyles.container}>
        <div style={authStyles.content}>
          {step === 'role' && (
            <div style={authStyles.card}>
              <div style={authStyles.header}>
                <h2 style={authStyles.title}>Join Fotolio</h2>
                <p style={authStyles.subtitle}>Choose your role to set up the right experience.</p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '22px',
                  marginBottom: '28px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setRole('photographer')}
                  style={{
                    padding: '32px 26px',
                    border: role === 'photographer' ? '2px solid #3B82F6' : '1px solid #E5E7EB',
                    borderRadius: '18px',
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
                      width: '56px',
                      height: '56px',
                      background: '#DBEAFE',
                      borderRadius: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#3B82F6',
                      fontSize: '30px',
                      margin: '0 auto 18px',
                    }}
                  >
                    💼
                  </div>
                  <h3 style={{ fontSize: '19px', fontWeight: 700, margin: '0 0 10px 0', color: '#111827' }}>
                    Photographer
                  </h3>
                  <p style={{ fontSize: '14px', color: '#6B7280', margin: 0, lineHeight: '1.65' }}>
                    I want to manage my bookings, leads, contracts and gallery delivery
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('client')}
                  style={{
                    padding: '32px 26px',
                    border: role === 'client' ? '2px solid #10B981' : '1px solid #E5E7EB',
                    borderRadius: '18px',
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
                      width: '56px',
                      height: '56px',
                      background: '#D1FAE5',
                      borderRadius: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#10B981',
                      fontSize: '30px',
                      margin: '0 auto 18px',
                    }}
                  >
                    👤
                  </div>
                  <h3 style={{ fontSize: '19px', fontWeight: 700, margin: '0 0 10px 0', color: '#111827' }}>
                    Client
                  </h3>
                  <p style={{ fontSize: '14px', color: '#6B7280', margin: 0, lineHeight: '1.65' }}>
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
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: role ? '1px solid #D1D5DB' : '1px solid #E5E7EB',
                  background: role ? '#FFFFFF' : '#F9FAFB',
                  color: role ? '#111827' : '#9CA3AF',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: role ? 'pointer' : 'not-allowed',
                  marginBottom: '20px',
                  transition: 'all 0.3s ease',
                  opacity: role ? 1 : 0.6,
                }}
              >
                Continue as {role ? role.charAt(0).toUpperCase() + role.slice(1) : 'role'} →
              </button>

              <div style={{ textAlign: 'center', marginTop: '8px' }}>
                <span style={{ fontSize: '13px', color: '#6B7280', fontWeight: 500 }}>
                  Already have an account?{' '}
                  <Link
                    href="/login"
                    style={{ color: '#3B82F6', textDecoration: 'none', fontWeight: 700 }}
                  >
                    Sign in
                  </Link>
                </span>
              </div>
            </div>
          )}

          {step === 'ph-form' && (
            <div style={authStyles.card}>
              <div style={authStyles.header}>
                <h2 style={authStyles.title}>Create your studio</h2>
                <p style={authStyles.subtitle}>
                  14-day free trial · No credit card required
                </p>
              </div>

              {error && <div style={authStyles.alertError}>{error}</div>}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!loading) handlePhSubmit();
                }}
              >
                <div style={authStyles.formGroup}>
                  <label style={authStyles.label}>Full name</label>
                  <input
                    type="text"
                    style={authStyles.input}
                    placeholder="Anna Fischer"
                    value={form.fullName}
                    onChange={(e) => updateForm('fullName', e.target.value)}
                    autoComplete="name"
                  />
                </div>

                <div style={authStyles.formGroup}>
                  <label style={authStyles.label}>Email address</label>
                  <input
                    type="email"
                    style={authStyles.input}
                    placeholder="anna@fotografie.de"
                    value={form.email}
                    onChange={(e) => updateForm('email', e.target.value)}
                    autoComplete="email"
                  />
                </div>

                <div style={authStyles.formGroup}>
                  <label style={authStyles.label}>Your subdomain</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
                    <input
                      type="text"
                      style={authStyles.input}
                      placeholder="anna-foto"
                      value={form.subdomain}
                      onChange={(e) => updateForm('subdomain', slugifySubdomain(e.target.value))}
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
                    3–63 characters · lowercase letters, digits and hyphens
                  </div>
                </div>

                <div style={authStyles.formGroup}>
                  <label style={authStyles.label}>Password</label>
                  <input
                    type="password"
                    style={authStyles.input}
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
                          ...authStyles.helperText,
                          color: passwordStrength.color,
                          fontWeight: 600,
                        }}
                      >
                        {passwordStrength.label}
                      </div>
                    </div>
                  ) : (
                    <div style={authStyles.helperText}>Min. 10 characters, with at least one letter and one digit</div>
                  )}
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
                    if (!loading) Object.assign(e.currentTarget.style, authStyles.buttonPrimaryHover);
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) Object.assign(e.currentTarget.style, authStyles.buttonPrimary);
                  }}
                >
                  {loading ? 'Creating studio…' : 'Create studio →'}
                </button>
              </form>

              <div style={authStyles.centerText}>
                <button
                  type="button"
                  onClick={handleBack}
                  style={{
                    ...authStyles.link,
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                >
                  ← Back
                </button>
              </div>
            </div>
          )}

          {step === 'ph-success' && (
            <div style={authStyles.card}>
              <div style={authStyles.header}>
                <div style={authStyles.successIcon}>✓</div>
                <h2 style={authStyles.title}>Welcome to Fotolio!</h2>
                <p style={authStyles.successText}>
                  Your studio is live at {form.subdomain}.fotolio.de. Redirecting to your dashboard…
                </p>
              </div>
            </div>
          )}

          {step === 'cu-info' && (
            <div style={authStyles.card}>
              <div style={authStyles.header}>
                <div style={authStyles.successIcon}>📧</div>
                <h2 style={authStyles.title}>Clients are invited</h2>
                <p style={authStyles.subtitle}>
                  Fotolio clients don&apos;t self-register. Your photographer will send you a secure
                  magic link by email after they&apos;ve added you to a booking.
                </p>
              </div>

              <div style={authStyles.alertInfo}>
                Already received a magic link? Click the link in your email to sign in — no password
                needed.
              </div>

              <Link
                href="/login"
                style={{
                  ...authStyles.button,
                  ...authStyles.buttonPrimary,
                  textDecoration: 'none',
                  display: 'inline-block',
                  textAlign: 'center',
                  boxSizing: 'border-box',
                }}
              >
                Go to sign in
              </Link>

              <div style={authStyles.centerText}>
                <button
                  type="button"
                  onClick={handleBack}
                  style={{
                    ...authStyles.link,
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                >
                  ← Back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
