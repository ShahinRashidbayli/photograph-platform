'use client';

import { useAcceptInvitation, useInvitationPreview } from '@/hooks/useAuth';
import { AuthSplitLayout } from '@/components/AuthSplitLayout';
import { AuthStatusCard } from '@/components/AuthStatusCard';
import { PasswordField } from '@/components/PasswordField';
import { getColors } from '@/lib/design-tokens';
import { extractApiError } from '@/lib/helpers';
import { useTranslation } from '@/lib/i18n';
import { useThemeStore } from '@/store/themeStore';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { getAuthStyles } from '../auth.styles';

/**
 * Claiming a seat in someone else's studio.
 *
 * <p>Lives in the `(auth)` group so it inherits the split layout, the theme
 * handling and the form styling the other credential screens already use —
 * this is a sign-up, just one that joins an existing studio instead of
 * creating one.
 *
 * <p>The email is never an input. It comes from the token, and is shown
 * read-only: an invitation is addressed to a person, and letting the form
 * change the address would make a forwarded email a way into a studio that
 * invited someone else.
 */
function InviteForm() {
  const { theme } = useThemeStore();
  const c = getColors(theme);
  const s = getAuthStyles(theme);
  const { t } = useTranslation();
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';

  // Expired, spent and unknown tokens answer identically by design — the
  // server will not say which, so neither does this screen.
  const previewQuery = useInvitationPreview(token);
  const preview = previewQuery.data ?? null;
  const checking = previewQuery.isLoading;
  const invalid = !token || previewQuery.isError;
  const accept = useAcceptInvitation();

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  // Held through success: the next screen is on its way.
  const submitting = accept.isPending || accept.isSuccess;
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    accept.mutate(
      { token, fullName, password },
      {
        // The account exists but holds no session: signing in goes through the
        // ordinary login form, which already handles lockout and rate limiting.
        onSuccess: () =>
          router.push(`/login?invited=1&email=${encodeURIComponent(preview?.email ?? '')}`),
        onError: (err) => setError(extractApiError(err, t('invite.error'))),
      }
    );
  }

  if (checking) {
    return <p style={{ color: c.textMuted, fontSize: '0.92rem' }}>{t('invite.checking')}</p>;
  }

  if (invalid || !preview) {
    return (
      <AuthStatusCard
        tone="error"
        title={t('invite.invalidTitle')}
        message={t('invite.invalidBody')}
      >
        <Link href="/login" style={s.link}>
          {t('invite.backToLogin')}
        </Link>
      </AuthStatusCard>
    );
  }

  return (
    <>
      <div style={s.header}>
        <h1 style={s.title}>{t('invite.title', { studio: preview.studioName })}</h1>
        <p style={s.subtitle}>{t('invite.subtitle', { studio: preview.studioName })}</p>
      </div>

      <form onSubmit={submit} noValidate>
        <div style={s.formGroup}>
          <span style={s.label}>{t('invite.emailLabel')}</span>
          {/* Deliberately not an input: the address is what the invitation
              names, and it is not the new colleague's to change. */}
          <p
            style={{
              ...s.input,
              display: 'flex',
              alignItems: 'center',
              background: c.surfaceAlt,
              color: c.textMuted,
              margin: 0,
            }}
          >
            {preview.email}
          </p>
        </div>

        <div style={s.formGroup}>
          <label htmlFor="invite-name" style={s.label}>
            {t('invite.nameLabel')}
          </label>
          <input
            id="invite-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={s.input}
            autoComplete="name"
            required
            maxLength={200}
          />
        </div>

        <PasswordField
          id="invite-password"
          label={t('invite.passwordLabel')}
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
        <p style={s.helperText}>{t('invite.passwordHelp')}</p>

        {error && (
          <div style={s.alertError} role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !fullName.trim() || password.length < 10}
          style={{
            ...s.button,
            ...s.buttonPrimary,
            ...(submitting || !fullName.trim() || password.length < 10 ? s.buttonDisabled : {}),
          }}
        >
          {submitting ? t('invite.joining') : t('invite.join')}
        </button>
      </form>

      <p style={s.centerText}>
        <Link href="/login" style={s.link}>
          {t('invite.haveAccount')}
        </Link>
      </p>
    </>
  );
}

export default function InvitePage() {
  const { t } = useTranslation();
  return (
    <AuthSplitLayout
      visualTitle={t('invite.visualTitle')}
      visualSubtitle={t('invite.visualSubtitle')}
    >
      {/* useSearchParams needs a Suspense boundary to prerender. */}
      <Suspense fallback={null}>
        <InviteForm />
      </Suspense>
    </AuthSplitLayout>
  );
}
