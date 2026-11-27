'use client';

import { useRequestLoginCode, useVerifyLoginCode } from '@/hooks/useAuth';
import { usePublicTenantLegal } from '@/hooks/useTenantLegal';
import { AuthSplitLayout } from '@/components/AuthSplitLayout';
import { Icon } from '@/components/Icon';
import { getColors } from '@/lib/design-tokens';
import { extractApiError } from '@/lib/helpers';
import { isRateLimited, retryAfterSeconds } from '@/lib/rate-limit';
import { useRetryWait, useWaitText } from '@/lib/useRetryWait';
import { PHOTOGRAPHER_LOGIN, withPreservedNext } from '@/lib/login-redirect';
import { useThemeStore } from '@/store/themeStore';
import { useTranslation } from '@/lib/i18n';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useReducer, useState } from 'react';
import { getAuthStyles } from '../../../(auth)/auth.styles';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

// Apex domains under which each photographer gets a subdomain. When the client
// arrives on anna-foto.fotolio.de the subdomain is authoritative and there is no
// reason to make them type (or guess) it — we lock the field. Reserved hosts
// (the marketing apex, the app shell) are not photographer tenants.
const BASE_DOMAINS = ['fotolio.de'];
const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'admin']);

/**
 * Derives the photographer subdomain from the current host, e.g.
 * `anna-foto.fotolio.de` → `anna-foto`. Returns null on localhost, the apex,
 * reserved hosts, or anything that isn't a single-label tenant subdomain, so
 * the caller falls back to the manual field.
 */
function deriveSubdomainFromHost(): string | null {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname.toLowerCase();
  for (const base of BASE_DOMAINS) {
    if (host.endsWith(`.${base}`)) {
      const sub = host.slice(0, host.length - base.length - 1);
      if (sub && !sub.includes('.') && !RESERVED_SUBDOMAINS.has(sub)) {
        return sub;
      }
    }
  }
  return null;
}

// How long the resend button holds after a code goes out. The server allows 5
// requests an hour; this stops someone burning that allowance on four clicks in
// ten seconds and then being unable to ask again for an hour.
const RESEND_COOLDOWN_SECONDS = 30;

type FocusField = 'email' | 'fullName' | 'code' | null;

const CODE_LENGTH = 6;

/**
 * The studio this browser last signed in to. A client comes back to the same
 * photographer; remembering the studio means the second visit shows its name
 * instead of asking for a subdomain they typed once and forgot. Only a
 * convenience — storage may be blocked, and then the field simply returns.
 */
const LAST_STUDIO_KEY = 'fotolio.customer.lastStudio';

function readLastStudio(): string | null {
  try {
    const v = window.localStorage.getItem(LAST_STUDIO_KEY);
    return v && SUBDOMAIN_REGEX.test(v) ? v : null;
  } catch {
    return null;
  }
}

function rememberStudio(subdomain: string) {
  try {
    window.localStorage.setItem(LAST_STUDIO_KEY, subdomain);
  } catch {
    // Private mode or blocked storage: the next visit asks again, nothing more.
  }
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function CustomerLoginInner() {
  const searchParams = useSearchParams();
  const initialSubdomain = (searchParams.get('subdomain') ?? '').trim().toLowerCase();

  const theme = useThemeStore((st) => st.theme);
  const colors = getColors(theme);
  const s = getAuthStyles(theme);
  const { t } = useTranslation();
  const retryWait = useRetryWait();
  const waitText = useWaitText();

  const [email, setEmail] = useState('');
  const [subdomain, setSubdomain] = useState(initialSubdomain);
  const [subdomainLocked, setSubdomainLocked] = useState(false);
  // A link from the studio (`?subdomain=`), the studio's own host, or this
  // browser's last sign-in may already say who the photographer is; the client
  // then sees the studio. Otherwise — or after "Change" — they give only their
  // email, and the server finds the studios that know it.
  //
  // The studio the code was requested for, fixed at submit: verifying must ask
  // the same question the request did, even if the card changes meanwhile.
  const [requestedFor, setRequestedFor] = useState<string | null>(null);
  const [changingStudio, setChangingStudio] = useState(false);
  const [rememberedStudio, setRememberedStudio] = useState(false);
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  // Two instances: the first request and a resend show their busy state apart.
  const requestCode = useRequestLoginCode();
  const resendCode = useRequestLoginCode();
  const loading = requestCode.isPending;
  const [submitted, setSubmitted] = useState(false);
  const resendBusy = resendCode.isPending;
  const [resendDone, setResendDone] = useState(false);
  const [resendError, setResendError] = useState('');
  /**
   * When another link may be requested, as an absolute timestamp.
   *
   * A deadline rather than a counter that ticks down by one each second,
   * because the very next thing this user does is switch to their email tab —
   * and browsers throttle timers in background tabs to roughly one tick a
   * minute. A decrementing counter simply stops there, so they come back to a
   * button still claiming "Resend in 27 seconds" long after the wait is over.
   * Recomputing from the clock is correct no matter how few ticks arrive.
   */
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [, tick] = useReducer((n: number) => n + 1, 0);
  const [focused, setFocused] = useState<FocusField>(null);

  // Step 2 lives on this same page rather than behind an emailed link. The
  // client arrived from an Instagram bio link, so this tab is inside
  // Instagram's in-app browser — sending them to their mail app and back
  // through Safari or Chrome is where the funnel bleeds. They read the code
  // and come back to this tab, which is still exactly where they left it.
  const [code, setCode] = useState('');
  const verifyCode = useVerifyLoginCode();
  const verifying = verifyCode.isPending;

  // Host-derived subdomain wins over the ?subdomain hint and is authoritative,
  // so we lock the field. Done in an effect (not useState init) because the
  // hostname is only known client-side — reading it during render would break
  // SSR/hydration. The query-param prefill stays editable for the localhost /
  // shared-domain fallback where the host carries no tenant.
  useEffect(() => {
    const fromHost = deriveSubdomainFromHost();
    if (fromHost) {
      setSubdomain(fromHost);
      setSubdomainLocked(true);
      return;
    }
    // No studio in the host or the link: fall back to the one this browser
    // signed in to last time.
    if (!initialSubdomain) {
      const last = readLastStudio();
      if (last) {
        setSubdomain(last);
        setRememberedStudio(true);
      }
    }
    // initialSubdomain is read once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render twice a second while a cooldown is running, so the label counts
  // down; the interval clears itself once the deadline passes.
  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const id = window.setInterval(() => {
      tick();
      if (Date.now() >= cooldownUntil) window.clearInterval(id);
    }, 500);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const cooldown = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));

  const linkedStudio = SUBDOMAIN_REGEX.test(subdomain.trim().toLowerCase())
    ? subdomain.trim().toLowerCase()
    : null;
  const showStudio =
    linkedStudio !== null &&
    (subdomainLocked || ((initialSubdomain !== '' || rememberedStudio) && !changingStudio));
  const legal = usePublicTenantLegal(showStudio ? linkedStudio : null);
  const studioName =
    legal.data?.legalName?.trim() ||
    (linkedStudio ?? '')
      .split('-')
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setError(t('customerLogin.errorRequired'));
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError(t('customerLogin.errorEmail'));
      return;
    }

    setError('');
    const studio = showStudio ? linkedStudio : null;
    requestCode.mutate(
      {
        email: trimmedEmail,
        subdomain: studio,
        fullName: fullName.trim() || null,
      },
      {
        onSuccess: () => {
          setRequestedFor(studio);
          setSubmitted(true);
          // The first link counts against the same limit as a resend, so the
          // cooldown starts here too.
          setCooldownUntil(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
        },
        onError: (err) => {
          if (isRateLimited(err)) {
            const wait = retryWait(err);
            setError(
              wait
                ? t('customerLogin.resendLimitedFor', { wait })
                : t('customerLogin.resendLimited')
            );
          } else {
            setError(extractApiError(err, t('customerLogin.errorSend')));
          }
        },
      }
    );
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== CODE_LENGTH) {
      setError(t('customerLogin.errorCodeFormat'));
      return;
    }

    setError('');
    verifyCode.mutate(
      {
        email: email.trim().toLowerCase(),
        subdomain: requestedFor,
        code,
      },
      {
        onSuccess: (res) => {
          // The studio the code opened — by email alone, the server decided it.
          const opened = res.data?.tenant?.subdomain ?? requestedFor;
          if (opened) rememberStudio(opened);
          // The session lands as cookies on this response. A full navigation (not a
          // router push) so the app shell boots with the cookies already attached.
          window.location.href = '/bookings';
        },
        onError: (err) => {
          // A wrong, spent or expired code is a 401. Ours, not the server's
          // sentence: that one is English-only.
          const status = (err as { response?: { status?: number } })?.response?.status;
          setError(
            status === 401
              ? t('customerLogin.errorCodeInvalid')
              : extractApiError(err, t('customerLogin.errorCodeInvalid'))
          );
          // Clear so the next attempt starts from an empty box rather than the
          // client having to select and delete six wrong digits on a phone.
          setCode('');
        },
      }
    );
  };

  const handleResend = () => {
    setResendDone(false);
    setResendError('');
    setError('');
    setCode('');
    resendCode.mutate(
      {
        email: email.trim().toLowerCase(),
        subdomain: requestedFor,
        fullName: fullName.trim() || null,
      },
      {
        onSuccess: () => {
          setResendDone(true);
          setCooldownUntil(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
        },
        onError: (err) => {
          // This used to report success on *every* failure, on the reasoning that
          // the endpoint is 204-always. But that contract is about not revealing
          // whether an address exists — it says nothing about rate limits or an
          // outage, both of which reach here. So the button claimed "Sent! Check
          // your inbox again." while nothing had been sent, and the user sat
          // waiting for a mail that was never coming. Not revealing the account is
          // still honoured: none of these messages depends on it.
          if (isRateLimited(err)) {
            const seconds = retryAfterSeconds(err);
            const wait = retryWait(err);
            setResendError(
              wait
                ? t('customerLogin.resendLimitedFor', { wait })
                : t('customerLogin.resendLimited')
            );
            // Hold the button for as long as the server says, not for our own guess.
            if (seconds !== null) setCooldownUntil(Date.now() + seconds * 1000);
          } else {
            setResendError(extractApiError(err, t('customerLogin.resendError')));
          }
        },
      }
    );
  };

  const resendDisabled = resendBusy || cooldown > 0;

  const inputStyle = (field: FocusField) => ({
    ...s.input,
    ...(focused === field ? s.inputFocus : {}),
  });

  return (
    <AuthSplitLayout
      crossLink={{
        href: withPreservedNext(PHOTOGRAPHER_LOGIN, `?${searchParams}`),
        label: t('customerLogin.photographerSignIn'),
      }}
      // The result rather than the gear: a client cares about their photos.
      // The photographer sign-in keeps the camera.
      visualImage="/brand/auth-client.webp"
      visualTitle={t('customerLogin.visualTitle')}
      visualSubtitle={t('customerLogin.visualSubtitle')}
    >
      {!submitted ? (
        <>
          <div style={s.header}>
            <h2 style={s.title}>{t('customerLogin.title')}</h2>
            <p style={s.subtitle}>{t('customerLogin.subtitle')}</p>
          </div>

          {error && (
            <div style={s.alertError} role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {showStudio ? (
              <div style={s.formGroup}>
                <span style={s.label} id="cust-studio-label">
                  {t('customerLogin.studioLabel')}
                </span>
                <div
                  aria-labelledby="cust-studio-label"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    border: `1px solid ${colors.border}`,
                    borderRadius: 10,
                    background: colors.surface,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: colors.primarySolid,
                      color: colors.onPrimary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {initialsOf(studioName)}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 500, color: colors.text }}>
                      {studioName}
                    </span>
                    <span style={{ fontSize: 12, color: colors.textSubtle }}>
                      {subdomain}.fotolio.de
                    </span>
                  </span>
                  {!subdomainLocked && (
                    <button
                      type="button"
                      onClick={() => setChangingStudio(true)}
                      style={{
                        border: 0,
                        background: 'transparent',
                        color: colors.textMuted,
                        fontSize: 13,
                        fontFamily: 'inherit',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        padding: '8px 4px',
                      }}
                    >
                      {t('customerLogin.studioChange')}
                    </button>
                  )}
                </div>
              </div>
            ) : null}

            <div style={s.formGroup}>
              <label style={s.label} htmlFor="cust-email">
                {t('customerLogin.emailLabel')}
              </label>
              <input
                id="cust-email"
                type="email"
                style={inputStyle('email')}
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                autoComplete="email"
                autoFocus
              />
            </div>

            <div style={s.formGroup}>
              <label style={s.label} htmlFor="cust-fullname">
                {t('customerLogin.fullNameLabel')}{' '}
                <span style={{ fontWeight: 400, color: colors.textSubtle }}>
                  {t('customerLogin.optional')}
                </span>
              </label>
              <input
                id="cust-fullname"
                type="text"
                style={inputStyle('fullName')}
                placeholder="Maria Klein"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onFocus={() => setFocused('fullName')}
                onBlur={() => setFocused(null)}
                autoComplete="name"
              />
              <div style={s.helperText}>{t('customerLogin.fullNameHelper')}</div>
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
              {loading ? t('customerLogin.submitLoading') : t('customerLogin.submit')}
            </button>
          </form>

          <p style={{ ...s.centerText, marginTop: 18 }}>{t('customerLogin.footer')}</p>
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
          <h2 style={s.title}>{t('customerLogin.sentTitle')}</h2>
          <p style={s.subtitle}>
            {requestedFor
              ? t('customerLogin.sentBody', { email })
              : t('customerLogin.sentBodyAny', { email })}
          </p>
          <div style={{ ...s.alertInfo, marginTop: 20 }}>{t('customerLogin.sentHint')}</div>

          {error && (
            <div style={{ ...s.alertError, marginTop: 16 }} role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleVerify} style={{ marginTop: 20 }}>
            <div style={s.formGroup}>
              <label style={s.label} htmlFor="login-code">
                {t('customerLogin.codeLabel')}
              </label>
              <input
                id="login-code"
                // inputMode numeric brings up the digit keypad on mobile, and
                // one-time-code lets iOS and Android offer the code straight
                // from the notification — so on a phone the client often never
                // opens their mail app at all.
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d*"
                maxLength={CODE_LENGTH}
                value={code}
                // Strip non-digits rather than rejecting: pasted codes often
                // carry a stray space from the email client.
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
                onFocus={() => setFocused('code')}
                onBlur={() => setFocused(null)}
                style={{
                  ...inputStyle('code'),
                  textAlign: 'center',
                  fontSize: '1.6rem',
                  letterSpacing: '0.5em',
                  // The trailing letter-space would otherwise push the digits
                  // visually off-centre.
                  textIndent: '0.5em',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                }}
                aria-describedby="login-code-hint"
                autoFocus
              />
              <div id="login-code-hint" style={s.helperText}>
                {t('customerLogin.sentHint')}
              </div>
            </div>

            <button
              type="submit"
              style={{
                ...s.button,
                ...s.buttonPrimary,
                ...(verifying || code.length !== CODE_LENGTH ? s.buttonDisabled : {}),
              }}
              disabled={verifying || code.length !== CODE_LENGTH}
            >
              {verifying ? t('customerLogin.codeSubmitLoading') : t('customerLogin.codeSubmit')}
            </button>
          </form>

          <button
            type="button"
            style={{
              ...s.button,
              background: 'transparent',
              color: colors.textMuted,
              marginTop: 12,
              ...(resendDisabled ? s.buttonDisabled : {}),
            }}
            disabled={resendDisabled}
            onClick={handleResend}
          >
            {resendBusy
              ? t('customerLogin.resendLoading')
              : cooldown > 0
                ? t('customerLogin.resendIn', { wait: waitText(cooldown) })
                : t('customerLogin.resend')}
          </button>
          {/*
            One live region for both outcomes, so a screen reader hears the
            result of pressing the button. `polite` — it must not interrupt.
          */}
          <div role="status" aria-live="polite">
            {resendError ? (
              <div style={{ ...s.alertError, marginTop: 12 }}>{resendError}</div>
            ) : resendDone ? (
              <div style={{ ...s.alertInfo, marginTop: 12 }}>{t('customerLogin.resendDone')}</div>
            ) : null}
          </div>

          <button
            type="button"
            style={{
              ...s.button,
              background: 'transparent',
              color: colors.textMuted,
              marginTop: 4,
            }}
            onClick={() => {
              setSubmitted(false);
              setCode('');
              setError('');
              setResendDone(false);
              setResendError('');
            }}
          >
            {t('customerLogin.changeEmail')}
          </button>
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
