'use client';

import api from '@/lib/api';
import { AuthSplitLayout } from '@/components/AuthSplitLayout';
import { Icon } from '@/components/Icon';
import { getColors } from '@/lib/design-tokens';
import { AuthUser, useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { useTranslation } from '@/lib/i18n';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { getAuthStyles } from '../auth.styles';

// Registration is photographer-only: creating a studio spins up a tenant and
// schema. Clients never "register" — the magic-link flow creates their account
// just-in-time — so there is no role chooser here; a client who lands on this
// page is nudged to the passwordless sign-in via the footer link below.
type Step = 'ph-form' | 'ph-success';

// Plans the pricing page can hand over via ?plan=… . Anything else (a typo, a
// stale link, someone poking at the URL) falls back to the default rather than
// showing a plan that does not exist — the value reaches the API, so it is
// validated here as well as server-side.
const PLAN_IDS = ['starter', 'pro', 'studio'] as const;
type PlanId = (typeof PLAN_IDS)[number];

const PLAN_LABEL: Record<PlanId, string> = {
  starter: 'Starter',
  pro: 'Pro',
  studio: 'Studio',
};

function readPlan(raw: string | null): PlanId | null {
  const v = raw?.toLowerCase();
  return PLAN_IDS.includes(v as PlanId) ? (v as PlanId) : null;
}

const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface PasswordStrength {
  // Language-neutral level; the visible label is translated at render time.
  level: '' | 'weak' | 'medium' | 'strong';
  score: number;
  color: string;
}

function getPasswordStrength(pw: string): PasswordStrength {
  if (!pw) return { level: '', score: 0, color: '#E5E7EB' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { level: 'weak', score, color: '#EF4444' };
  if (score <= 3) return { level: 'medium', score, color: '#F59E0B' };
  return { level: 'strong', score, color: '#10B981' };
}

function slugifySubdomain(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 63);
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = readPlan(searchParams.get('plan'));
  const setUser = useAuthStore((st) => st.setUser);
  const theme = useThemeStore((st) => st.theme);
  const c = getColors(theme);
  const s = getAuthStyles(theme);
  const { t } = useTranslation();

  const [step, setStep] = useState<Step>('ph-form');
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
      return t('register.errorAllRequired');
    }
    if (!EMAIL_REGEX.test(email)) {
      return t('register.errorEmail');
    }
    if (form.password.length < 10) {
      return t('register.errorPasswordLength');
    }
    if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      return t('register.errorPasswordComposition');
    }
    if (!SUBDOMAIN_REGEX.test(subdomain)) {
      return t('register.errorSubdomain');
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
        // Null when they came from the nav/footer rather than a pricing card;
        // the backend then applies its STARTER default.
        plan: plan ? plan.toUpperCase() : null,
      });
      setUser(user);
      setStep('ph-success');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        t('register.errorGeneric');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // The success step pauses briefly before moving on. Driven by an effect
  // rather than a bare setTimeout in the submit handler so unmounting cancels
  // it: otherwise a user who clicked away during that window (the page still
  // has links) was yanked to /dashboard a moment later, overriding the
  // navigation they actually chose.
  useEffect(() => {
    if (step !== 'ph-success') return;
    const id = window.setTimeout(() => router.push('/dashboard'), 1200);
    return () => window.clearTimeout(id);
  }, [step, router]);

  const passwordStrength = getPasswordStrength(form.password);

  return (
    <AuthSplitLayout
      contentMaxWidth={460}
      crossLink={{ href: '/login', label: t('register.crossLink') }}
      visualTitle={t('register.visualTitle')}
      visualSubtitle={t('register.visualSubtitle')}
    >
      {step === 'ph-form' && (
        <>
          <div style={s.header}>
            <h2 style={s.title}>{t('register.title')}</h2>
            {/* Confirm the plan they clicked. Without this the pricing CTA is a
                dead end: they pick Studio and land on a page that never mentions
                it again. */}
            {plan ? (
              <p style={s.subtitle}>
                {t('register.planNote', { plan: PLAN_LABEL[plan] })}{' '}
                <Link href="/#pricing" style={s.link}>
                  {t('register.planChange')}
                </Link>
              </p>
            ) : (
              <p style={s.subtitle}>{t('register.subtitle')}</p>
            )}
          </div>

          {error && <div style={s.alertError}>{error}</div>}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!loading) handlePhSubmit();
            }}
          >
            <div style={s.formGroup}>
              <label style={s.label} htmlFor="reg-fullname">{t('register.fullNameLabel')}</label>
              <input
                id="reg-fullname"
                type="text"
                style={s.input}
                placeholder="Anna Fischer"
                value={form.fullName}
                onChange={(e) => updateForm('fullName', e.target.value)}
                autoComplete="name"
              />
            </div>

            <div style={s.formGroup}>
              <label style={s.label} htmlFor="reg-email">{t('register.emailLabel')}</label>
              <input
                id="reg-email"
                type="email"
                style={s.input}
                placeholder="anna@fotografie.de"
                value={form.email}
                onChange={(e) => updateForm('email', e.target.value)}
                autoComplete="email"
              />
            </div>

            <div style={s.formGroup}>
              <label style={s.label} htmlFor="reg-subdomain">{t('register.subdomainLabel')}</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input
                  id="reg-subdomain"
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
              <div style={s.helperText}>{t('register.subdomainHelper')}</div>
            </div>

            <div style={s.formGroup}>
              <label style={s.label} htmlFor="reg-password">{t('register.passwordLabel')}</label>
              <input
                id="reg-password"
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
                    {passwordStrength.level === 'weak'
                      ? t('register.pwWeak')
                      : passwordStrength.level === 'medium'
                        ? t('register.pwMedium')
                        : t('register.pwStrong')}
                  </div>
                </div>
              ) : (
                <div style={s.helperText}>{t('register.passwordHelper')}</div>
              )}
            </div>

            <button
              type="submit"
              style={{ ...s.button, ...s.buttonPrimary, ...(loading ? s.buttonDisabled : {}) }}
              disabled={loading}
            >
              {loading ? t('register.submitLoading') : t('register.submit')}
            </button>
          </form>

          <p style={{ ...s.centerText, marginTop: 20 }}>
            {t('register.alreadyAccount')}{' '}
            <Link href="/login" style={s.link}>
              {t('register.signIn')}
            </Link>
          </p>
          <p style={{ ...s.centerText, marginTop: 8 }}>
            {t('register.bookingQuestion')}{' '}
            <Link href="/customer/auth/login" style={s.link}>
              {t('register.clientSignIn')}
            </Link>
          </p>
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
          <h2 style={s.title}>{t('register.successTitle')}</h2>
          <p style={{ ...s.subtitle, marginTop: 8 }}>
            {t('register.successBody', { subdomain: form.subdomain })}
          </p>
        </div>
      )}

    </AuthSplitLayout>
  );
}

/**
 * `useSearchParams` needs a Suspense boundary in the app router — without one
 * the whole route bails out of prerendering and the build fails.
 */
export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
