'use client';

import { useRegister, useSubdomainAvailability } from '@/hooks/useAuth';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { AuthSplitLayout } from '@/components/AuthSplitLayout';
import { AuthStatusCard } from '@/components/AuthStatusCard';
import { PasswordField } from '@/components/PasswordField';
import { Trans } from '@/components/Trans';
import { getColors } from '@/lib/design-tokens';
import { extractApiError } from '@/lib/helpers';
import { isRateLimited } from '@/lib/rate-limit';
import { useRetryWait } from '@/lib/useRetryWait';
import { useThemeStore } from '@/store/themeStore';
import { useTranslation } from '@/lib/i18n';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { getAuthStyles } from '../auth.styles';
import {
  MIN_PASSWORD_LENGTH,
  getPasswordStrength,
  meetsPasswordPolicy,
  slugifySubdomain,
} from './password-policy';

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

type SubdomainStatus = 'idle' | 'tooShort' | 'checking' | 'available' | 'taken' | 'reserved';

type FieldKey = 'fullName' | 'email' | 'subdomain' | 'password' | 'confirm' | 'terms';
type FieldErrors = Partial<Record<FieldKey, string>>;

// Focus order after a failed submit is DOM order, so the user is taken to the
// first thing to fix rather than the last rule that happened to run.
const FIELD_ORDER: FieldKey[] = ['fullName', 'email', 'subdomain', 'password', 'confirm', 'terms'];
const FIELD_IDS: Record<FieldKey, string> = {
  fullName: 'reg-fullname',
  email: 'reg-email',
  subdomain: 'reg-subdomain',
  password: 'reg-password',
  confirm: 'reg-confirm',
  terms: 'reg-terms',
};

// How long to wait after the last keystroke before asking the server whether a
// subdomain is free. Long enough not to fire on every letter, short enough that
// the answer arrives while the user is still looking at the field.
const SUBDOMAIN_DEBOUNCE_MS = 400;

// How long the success screen holds before moving on. Long enough to read the
// note about confirming the address — the pause used to be 1.2s, which is not
// enough to read anything, so the screen may as well not have said it. There is
// a button to skip ahead, because a fixed wait is only ever right for one
// reading speed.
const SUCCESS_REDIRECT_MS = 4500;

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = readPlan(searchParams.get('plan'));
  const register = useRegister();
  const theme = useThemeStore((st) => st.theme);
  const c = getColors(theme);
  const s = getAuthStyles(theme);
  const { t } = useTranslation();
  const retryWait = useRetryWait();

  const [step, setStep] = useState<Step>('ph-form');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const loading = register.isPending;
  const [focused, setFocused] = useState<FieldKey | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirm: '',
    subdomain: '',
  });

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    // Clear this field's complaint as soon as it is being addressed; leaving it
    // under a field the user is actively fixing reads as the form arguing back.
    setFieldErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field as FieldKey];
      return next;
    });
  };

  // Ask the server whether the subdomain is free, while the user is still on the
  // field. Without this, the one value nobody can know in advance was the last
  // thing they found out about: fill in five fields, submit, get a 409.
  const subdomainValue = form.subdomain.trim();
  const subdomainValid = SUBDOMAIN_REGEX.test(subdomainValue);
  const debouncedSubdomain = useDebouncedValue(subdomainValue, SUBDOMAIN_DEBOUNCE_MS);
  const availability = useSubdomainAvailability(
    subdomainValid && debouncedSubdomain === subdomainValue ? subdomainValue : null
  );
  const subdomainCheck: { status: SubdomainStatus; subdomain: string } = (() => {
    if (!subdomainValue) return { status: 'idle', subdomain: '' };
    if (!subdomainValid) return { status: 'tooShort', subdomain: subdomainValue };
    if (debouncedSubdomain !== subdomainValue || availability.isPending) {
      return { status: 'checking', subdomain: subdomainValue };
    }
    // Advisory only — register still enforces uniqueness, so a failed check
    // must not block a legitimate sign-up or claim a name is taken.
    const data = availability.data;
    if (!data) return { status: 'idle', subdomain: subdomainValue };
    return {
      subdomain: subdomainValue,
      status: data.available
        ? 'available'
        : data.reason === 'RESERVED'
          ? 'reserved'
          : data.reason === 'TAKEN'
            ? 'taken'
            : 'tooShort',
    };
  })();

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    const email = form.email.trim();
    const subdomain = form.subdomain.trim();

    if (!form.fullName.trim()) errors.fullName = t('register.errorFullName');
    if (!EMAIL_REGEX.test(email)) errors.email = t('register.errorEmail');

    if (!SUBDOMAIN_REGEX.test(subdomain)) {
      errors.subdomain = t('register.errorSubdomain');
    } else if (subdomainCheck.subdomain === subdomain) {
      // Only trust a verdict that belongs to the value being submitted.
      if (subdomainCheck.status === 'taken') errors.subdomain = t('register.subdomainTaken');
      if (subdomainCheck.status === 'reserved') errors.subdomain = t('register.subdomainReserved');
    }

    if (form.password.length < MIN_PASSWORD_LENGTH) {
      errors.password = t('register.errorPasswordLength');
    } else if (!meetsPasswordPolicy(form.password)) {
      errors.password = t('register.errorPasswordComposition');
    }

    if (!form.confirm) {
      errors.confirm = t('register.errorConfirmRequired');
    } else if (form.confirm !== form.password) {
      errors.confirm = t('register.errorConfirmMismatch');
    }

    if (!acceptedTerms) errors.terms = t('register.errorTerms');

    return errors;
  };

  const handlePhSubmit = () => {
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('');
      // Take the user to the first problem. A form that reports six errors and
      // leaves the caret where it was makes them hunt for the one to fix.
      const first = FIELD_ORDER.find((key) => key in errors);
      if (first) document.getElementById(FIELD_IDS[first])?.focus();
      return;
    }

    setFieldErrors({});
    setError('');
    register.mutate(
      {
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        subdomain: form.subdomain.trim(),
        role: 'PHOTOGRAPHER',
        // Null when they came from the nav/footer rather than a pricing card;
        // the backend then applies its STARTER default.
        plan: plan ? plan.toUpperCase() : null,
      },
      {
        onSuccess: () => setStep('ph-success'),
        onError: (err) => {
          const status = (err as { response?: { status?: number } })?.response?.status;
          if (isRateLimited(err)) {
            const wait = retryWait(err);
            setError(
              wait ? t('register.errorRateLimitedFor', { wait }) : t('register.errorRateLimited')
            );
          } else if (status === 409) {
            // Lost the race for a name the live check had said was free, or the
            // email is already a studio account. Put it on the field it belongs to.
            setFieldErrors({ subdomain: extractApiError(err, t('register.subdomainTaken')) });
            document.getElementById(FIELD_IDS.subdomain)?.focus();
          } else {
            setError(extractApiError(err, t('register.errorGeneric')));
          }
        },
      }
    );
  };

  // The success step pauses briefly before moving on. Driven by an effect
  // rather than a bare setTimeout in the submit handler so unmounting cancels
  // it: otherwise a user who clicked away during that window (the page still
  // has links) was yanked to /dashboard a moment later, overriding the
  // navigation they actually chose.
  useEffect(() => {
    if (step !== 'ph-success') return;
    const id = window.setTimeout(() => router.push('/dashboard'), SUCCESS_REDIRECT_MS);
    return () => window.clearTimeout(id);
  }, [step, router]);

  const passwordStrength = getPasswordStrength(form.password);
  const strengthColor = { weak: c.danger, medium: c.warning, strong: c.success }[
    passwordStrength.level || 'weak'
  ];

  const textInput = (
    field: 'fullName' | 'email',
    type: string,
    label: string,
    placeholder: string,
    autoComplete: string,
    extra?: { autoFocus?: boolean }
  ) => {
    const invalid = fieldErrors[field];
    return (
      <div style={s.formGroup}>
        <label style={s.label} htmlFor={FIELD_IDS[field]}>
          {label}
        </label>
        <input
          id={FIELD_IDS[field]}
          type={type}
          style={{
            ...s.input,
            ...(focused === field ? s.inputFocus : {}),
            ...(invalid ? { border: `1px solid ${c.danger}` } : {}),
          }}
          placeholder={placeholder}
          value={form[field]}
          onChange={(e) => updateForm(field, e.target.value)}
          onFocus={() => setFocused(field)}
          onBlur={() => setFocused(null)}
          autoComplete={autoComplete}
          autoFocus={extra?.autoFocus}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={invalid ? `${FIELD_IDS[field]}-error` : undefined}
        />
        {invalid && (
          <div
            id={`${FIELD_IDS[field]}-error`}
            style={{ ...s.helperText, color: c.danger }}
            role="alert"
          >
            {invalid}
          </div>
        )}
      </div>
    );
  };

  const subdomainHint = (() => {
    if (fieldErrors.subdomain) return null; // the error below says it instead
    const { status, subdomain } = subdomainCheck;
    if (status === 'checking')
      return { text: t('register.subdomainChecking'), color: c.textSubtle };
    if (status === 'tooShort')
      return { text: t('register.subdomainTooShort'), color: c.textSubtle };
    if (status === 'available')
      return { text: t('register.subdomainAvailable', { subdomain }), color: c.success };
    if (status === 'taken') return { text: t('register.subdomainTaken'), color: c.danger };
    if (status === 'reserved') return { text: t('register.subdomainReserved'), color: c.danger };
    return null;
  })();

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

          {error && (
            <div style={s.alertError} role="alert">
              {error}
            </div>
          )}

          {/* noValidate: the browser's own bubbles are unstyled, untranslated
              and stop at the first field, which is exactly what the per-field
              messages below replace. */}
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (!loading) handlePhSubmit();
            }}
          >
            {textInput('fullName', 'text', t('register.fullNameLabel'), 'Anna Fischer', 'name', {
              autoFocus: true,
            })}
            {textInput(
              'email',
              'email',
              t('register.emailLabel'),
              t('auth.emailPlaceholder'),
              'email'
            )}

            <div style={s.formGroup}>
              <label style={s.label} htmlFor={FIELD_IDS.subdomain}>
                {t('register.subdomainLabel')}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input
                  id={FIELD_IDS.subdomain}
                  type="text"
                  style={{
                    ...s.input,
                    ...(focused === 'subdomain' ? s.inputFocus : {}),
                    ...(fieldErrors.subdomain ? { border: `1px solid ${c.danger}` } : {}),
                  }}
                  placeholder="anna-foto"
                  value={form.subdomain}
                  onChange={(e) => updateForm('subdomain', slugifySubdomain(e.target.value))}
                  onFocus={() => setFocused('subdomain')}
                  onBlur={() => setFocused(null)}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={fieldErrors.subdomain ? true : undefined}
                  aria-describedby="reg-subdomain-status"
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
              {/*
                One live region for the field, so a verdict that arrives while
                the user is still typing is announced rather than only painted.
                `polite` — it must not cut across the letters being typed.
              */}
              <div id="reg-subdomain-status" role="status" aria-live="polite">
                {fieldErrors.subdomain ? (
                  <span style={{ ...s.helperText, color: c.danger }}>{fieldErrors.subdomain}</span>
                ) : subdomainHint ? (
                  <span style={{ ...s.helperText, color: subdomainHint.color }}>
                    {subdomainHint.text}
                  </span>
                ) : (
                  <span style={s.helperText}>{t('register.subdomainHelper')}</span>
                )}
              </div>
            </div>

            <PasswordField
              id={FIELD_IDS.password}
              label={t('register.passwordLabel')}
              value={form.password}
              onChange={(v) => updateForm('password', v)}
              autoComplete="new-password"
              error={fieldErrors.password}
            >
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
                        background: strengthColor,
                        transition: 'width 0.2s ease, background 0.2s ease',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: strengthColor,
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
                  {/* The requirement stays on screen while they type — it used
                      to be replaced by the meter at the first keystroke, which
                      is precisely when it is needed. */}
                  <div style={s.helperText}>{t('register.passwordHelper')}</div>
                </div>
              ) : (
                <div style={s.helperText}>{t('register.passwordHelper')}</div>
              )}
            </PasswordField>

            {/* A mistyped password on a page that signs you straight in is only
                discovered on the *next* sign-in, by which point the fix is a
                password reset. */}
            <PasswordField
              id={FIELD_IDS.confirm}
              label={t('register.confirmLabel')}
              value={form.confirm}
              onChange={(v) => updateForm('confirm', v)}
              autoComplete="new-password"
              error={fieldErrors.confirm}
            />

            <div style={{ marginBottom: 20 }}>
              <label
                htmlFor={FIELD_IDS.terms}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  lineHeight: 1.5,
                  color: c.textMuted,
                }}
              >
                <input
                  id={FIELD_IDS.terms}
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => {
                    setAcceptedTerms(e.target.checked);
                    setFieldErrors((prev) => {
                      if (!('terms' in prev)) return prev;
                      const next = { ...prev };
                      delete next.terms;
                      return next;
                    });
                  }}
                  style={{
                    marginTop: 2,
                    width: 16,
                    height: 16,
                    accentColor: c.primarySolid,
                    flexShrink: 0,
                    cursor: 'pointer',
                  }}
                  aria-invalid={fieldErrors.terms ? true : undefined}
                  aria-describedby={fieldErrors.terms ? 'reg-terms-error' : undefined}
                />
                <span>
                  <Trans
                    template={t('register.terms')}
                    values={{
                      agb: (
                        <Link href="/agb" style={s.link} target="_blank" rel="noopener noreferrer">
                          {t('register.termsAgb')}
                        </Link>
                      ),
                      privacy: (
                        <Link
                          href="/datenschutz"
                          style={s.link}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t('register.termsPrivacy')}
                        </Link>
                      ),
                    }}
                  />
                </span>
              </label>
              {fieldErrors.terms && (
                <div
                  id="reg-terms-error"
                  style={{ ...s.helperText, color: c.danger, marginTop: 6 }}
                  role="alert"
                >
                  {fieldErrors.terms}
                </div>
              )}
            </div>

            <button
              type="submit"
              style={{ ...s.button, ...s.buttonPrimary, ...(loading ? s.buttonDisabled : {}) }}
              disabled={loading}
              onMouseEnter={(e) => {
                if (!loading) Object.assign(e.currentTarget.style, s.buttonPrimaryHover);
              }}
              onMouseLeave={(e) => {
                if (!loading) Object.assign(e.currentTarget.style, s.buttonPrimary);
              }}
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
        <AuthStatusCard
          tone="success"
          title={t('register.successTitle')}
          message={t('register.successBody', { subdomain: form.subdomain })}
        >
          {/* Say it here, not only on the dashboard banner. The address they
              just typed is the one every booking mail and invoice will be sent
              from, and until it is confirmed those endpoints refuse — which is
              a confusing thing to discover later from a 403. */}
          <div style={{ ...s.alertInfo, marginBottom: 0, textAlign: 'left' }}>
            {t('register.successVerifyNote', { email: form.email.trim().toLowerCase() })}
          </div>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            style={{ ...s.button, ...s.buttonPrimary }}
          >
            {t('register.goToDashboard')}
          </button>
        </AuthStatusCard>
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
