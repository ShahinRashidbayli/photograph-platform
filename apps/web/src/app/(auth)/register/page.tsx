'use client';

import api from '@/lib/api';
import { AuthSplitLayout } from '@/components/AuthSplitLayout';
import { Icon } from '@/components/Icon';
import { getColors } from '@/lib/design-tokens';
import { AuthUser, useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getAuthStyles } from '../auth.styles';

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
  const setUser = useAuthStore((st) => st.setUser);
  const theme = useThemeStore((st) => st.theme);
  const c = getColors(theme);
  const s = getAuthStyles(theme);

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

  const backButtonStyle = {
    color: c.primaryText,
    textDecoration: 'none',
    fontWeight: 600,
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontSize: '0.9rem',
  } as const;

  const roleCard = (selected: boolean, tone: 'primary' | 'success') => {
    const accent = tone === 'primary' ? c.primary : c.success;
    return {
      position: 'relative' as const,
      padding: '22px 20px',
      border: `1.5px solid ${selected ? accent : c.border}`,
      borderRadius: 16,
      background: selected ? (tone === 'primary' ? c.primaryBg : c.successBg) : c.surface,
      cursor: 'pointer',
      transition: 'border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease',
      textAlign: 'left' as const,
      boxShadow: selected ? `0 0 0 4px ${accent}1F` : c.elevatedShadow,
      transform: selected ? 'translateY(-1px)' : 'none',
      outline: 'none',
      display: 'block',
      width: '100%',
    };
  };

  const iconChip = (tone: 'primary' | 'success') => ({
    width: 48,
    height: 48,
    borderRadius: 13,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    background: tone === 'primary' ? c.primaryBg : c.successBg,
    color: tone === 'primary' ? c.primaryText : c.successText,
    border: `1px solid ${tone === 'primary' ? c.primaryBorder : c.successBorder}`,
  });

  const selectedBadge = (tone: 'primary' | 'success') => ({
    position: 'absolute' as const,
    top: 14,
    right: 14,
    color: tone === 'primary' ? c.primary : c.success,
    display: 'flex',
  });

  return (
    <AuthSplitLayout
      contentMaxWidth={460}
      crossLink={{ href: '/login', label: 'Sign in' }}
      visualTitle="Grow your photography business"
      visualSubtitle="A 14-day free trial. No credit card. Your own booking site in minutes."
    >
      {step === 'role' && (
        <>
          <div style={s.header}>
            <h2 style={s.title}>Join Fotolio</h2>
            <p style={s.subtitle}>Choose your role to set up the right experience.</p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
              gap: 16,
              marginBottom: 28,
            }}
          >
            <button
              type="button"
              onClick={() => setRole('photographer')}
              style={roleCard(role === 'photographer', 'primary')}
            >
              {role === 'photographer' && (
                <span style={selectedBadge('primary')}>
                  <Icon name="check-circle" size={20} />
                </span>
              )}
              <div style={iconChip('primary')}>
                <Icon name="briefcase" size={24} />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 8px 0', color: c.text }}>
                Photographer
              </h3>
              <p style={{ fontSize: '0.86rem', color: c.textMuted, margin: 0, lineHeight: 1.5 }}>
                Manage my bookings, leads, contracts and gallery delivery
              </p>
            </button>

            <button
              type="button"
              onClick={() => setRole('client')}
              style={roleCard(role === 'client', 'success')}
            >
              {role === 'client' && (
                <span style={selectedBadge('success')}>
                  <Icon name="check-circle" size={20} />
                </span>
              )}
              <div style={iconChip('success')}>
                <Icon name="user" size={24} />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 8px 0', color: c.text }}>
                Client
              </h3>
              <p style={{ fontSize: '0.86rem', color: c.textMuted, margin: 0, lineHeight: 1.5 }}>
                Track my booking, view my photos and message my photographer
              </p>
            </button>
          </div>

          <button
            type="button"
            onClick={handleRoleContinue}
            disabled={!role}
            style={{
              ...s.button,
              ...s.buttonPrimary,
              ...(role ? {} : s.buttonDisabled),
              marginBottom: 20,
            }}
          >
            {role ? `Continue as ${role.charAt(0).toUpperCase()}${role.slice(1)}` : 'Continue'}
          </button>

          <p style={s.centerText}>
            Already have an account?{' '}
            <Link href="/login" style={s.link}>
              Sign in
            </Link>
          </p>
        </>
      )}

      {step === 'ph-form' && (
        <>
          <div style={s.header}>
            <h2 style={s.title}>Create your studio</h2>
            <p style={s.subtitle}>14-day free trial · No credit card required</p>
          </div>

          {error && <div style={s.alertError}>{error}</div>}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!loading) handlePhSubmit();
            }}
          >
            <div style={s.formGroup}>
              <label style={s.label}>Full name</label>
              <input
                type="text"
                style={s.input}
                placeholder="Anna Fischer"
                value={form.fullName}
                onChange={(e) => updateForm('fullName', e.target.value)}
                autoComplete="name"
              />
            </div>

            <div style={s.formGroup}>
              <label style={s.label}>Email address</label>
              <input
                type="email"
                style={s.input}
                placeholder="anna@fotografie.de"
                value={form.email}
                onChange={(e) => updateForm('email', e.target.value)}
                autoComplete="email"
              />
            </div>

            <div style={s.formGroup}>
              <label style={s.label}>Your subdomain</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input
                  type="text"
                  style={s.input}
                  placeholder="anna-foto"
                  value={form.subdomain}
                  onChange={(e) => updateForm('subdomain', slugifySubdomain(e.target.value))}
                  autoComplete="off"
                  spellCheck={false}
                />
                <div
                  style={{
                    ...s.input,
                    display: 'flex',
                    alignItems: 'center',
                    background: c.surfaceAlt,
                    cursor: 'default',
                    color: c.textMuted,
                  }}
                >
                  .fotolio.de
                </div>
              </div>
              <div style={s.helperText}>
                3–63 characters · lowercase letters, digits and hyphens
              </div>
            </div>

            <div style={s.formGroup}>
              <label style={s.label}>Password</label>
              <input
                type="password"
                style={s.input}
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => updateForm('password', e.target.value)}
                autoComplete="new-password"
              />
              {form.password ? (
                <div style={{ marginTop: 8 }}>
                  <div
                    style={{
                      height: 4,
                      borderRadius: 999,
                      background: c.neutralBg,
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
                      fontSize: 12,
                      color: passwordStrength.color,
                      fontWeight: 600,
                      marginTop: 4,
                    }}
                  >
                    {passwordStrength.label}
                  </div>
                </div>
              ) : (
                <div style={s.helperText}>
                  Min. 10 characters, with at least one letter and one digit
                </div>
              )}
            </div>

            <button
              type="submit"
              style={{ ...s.button, ...s.buttonPrimary, ...(loading ? s.buttonDisabled : {}) }}
              disabled={loading}
            >
              {loading ? 'Creating studio…' : 'Create studio'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button type="button" onClick={handleBack} style={backButtonStyle}>
              ← Back
            </button>
          </div>
        </>
      )}

      {step === 'ph-success' && (
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: c.successBg,
              color: c.success,
              border: `1px solid ${c.successBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            <Icon name="check" size={30} strokeWidth={2.25} />
          </div>
          <h2 style={s.title}>Welcome to Fotolio!</h2>
          <p style={{ ...s.subtitle, marginTop: 8 }}>
            Your studio is live at {form.subdomain}.fotolio.de. Redirecting to your dashboard…
          </p>
        </div>
      )}

      {step === 'cu-info' && (
        <>
          <div style={{ ...s.header, textAlign: 'center' }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: c.primaryBg,
                color: c.primaryText,
                border: `1px solid ${c.primaryBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              <Icon name="mail" size={28} />
            </div>
            <h2 style={s.title}>Continue as a client</h2>
            <p style={s.subtitle}>
              No separate sign-up needed. Enter your email and your photographer&apos;s subdomain
              and we&apos;ll send you a one-time sign-in link — your account is set up
              automatically the first time.
            </p>
          </div>

          <div style={{ ...s.alertInfo, marginBottom: 20 }}>
            Already got a magic link from your photographer? Just click it in your email — no
            password needed.
          </div>

          <Link
            href="/customer/auth/login"
            style={{
              ...s.button,
              ...s.buttonPrimary,
              display: 'block',
              textAlign: 'center',
              textDecoration: 'none',
              boxSizing: 'border-box',
            }}
          >
            Go to client sign in
          </Link>

          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button type="button" onClick={handleBack} style={backButtonStyle}>
              ← Back
            </button>
          </div>
        </>
      )}
    </AuthSplitLayout>
  );
}
