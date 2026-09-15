'use client';

import { AuthUser, useAuthStore, useIsPhotographer } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { UserAvatar } from '@/components/UserAvatar';
import { getColors } from '@/lib/design-tokens';
import api from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { Alert, Button, Field, Input } from '@/components/ui';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SettingsSection } from './SettingsSection';

/**
 * Where each pre-split `#settings-*` fragment now lives. Account and the danger
 * zone stayed on this page, so they are deliberately absent — there is nowhere
 * to send them.
 */
const SECTION_ROUTES: Record<string, string> = {
  'settings-branding': '/settings/studio',
  'settings-packages': '/settings/studio',
  'settings-resources': '/settings/studio',
  'settings-invoicing': '/settings/business',
  'settings-legal': '/settings/business',
  'settings-payouts': '/settings/payments',
  'settings-datev': '/settings/payments',
  'settings-subscription': '/settings/plan',
  'settings-team': '/settings/team',
};

export default function SettingsPage() {
  const { t } = useTranslation();
  const user = useAuthStore((st) => st.user);
  const setUser = useAuthStore((st) => st.setUser);
  const { theme } = useThemeStore();
  const router = useRouter();
  const c = useMemo(() => getColors(theme), [theme]);

  // Clients (CUSTOMER role) share this page but must not see the studio,
  // packages or billing surfaces — those are the photographer's tenant-level
  // concerns (subdomain, plan tier). A client only manages their own account.
  const isPhotographer = useIsPhotographer();

  // Controlled inputs — kept in state so we can submit and reset them.
  const [fullNameInput, setFullNameInput] = useState(user?.fullName ?? '');
  const [subdomainInput, setSubdomainInput] = useState(user?.tenant?.subdomain ?? '');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Re-seed the inputs only when the user *identity* changes (i.e. loads on
  // first paint) — not on every field update, which would clobber edits and
  // the post-save state. Field deps are intentionally omitted.
  useEffect(() => {
    // Ensure CSRF token is set by making a GET request on mount
    api.get('/api/auth/me').catch(() => {});
  }, []);

  /**
   * Forwards links minted before Settings was split into panels.
   *
   * <p>Two kinds are still out there: `?stripe=return|refresh`, which Stripe
   * may hold on a hosted onboarding page opened before the change, and the
   * `#settings-*` fragments that upgrade prompts and bookmarks used to point
   * at. Both used to resolve on this one page; sending them on is cheaper than
   * letting someone land on Account wondering where their payout setup went.
   *
   * <p>This replaces a retrying scroll shim that existed only because the
   * subscription section was two thirds of the way down a very long page. The
   * shim is gone with the page it was compensating for.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('stripe')) {
      router.replace(`/settings/payments?${params.toString()}`);
      return;
    }
    const target = SECTION_ROUTES[window.location.hash.slice(1)];
    if (target) router.replace(target);
  }, [router]);

  useEffect(() => {
    setFullNameInput(user?.fullName ?? '');
    setSubdomainInput(user?.tenant?.subdomain ?? '');
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const section: React.CSSProperties = {
    background: c.surface,
    border: `1px solid ${c.border}`,
    borderRadius: '14px',
    padding: '24px',
    marginBottom: '20px',
    boxShadow: c.overlayShadow,
  };

  const saveBtn: React.CSSProperties = {
    padding: '10px 24px',
    background: c.primarySolid,
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
  };

  const markDirty = () => {
    if (!dirty) setDirty(true);
    if (saved) setSaved(false);
    if (error) setError(null);
  };

  const handleAvatarUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError(t('settings.account.avatarTooLarge'));
      return;
    }
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const contentType = file.type || 'image/jpeg';
      const { data: presign } = await api.post<{
        uploadUrl: string;
        viewUrl: string;
        r2Key: string;
        // The type the URL was signed with, which may differ from what we asked
        // for (the API canonicalises image/jpg to image/jpeg). Content-Type is
        // a signed header on the presigned PUT, so the upload below must send
        // this value rather than our own.
        contentType: string;
      }>(
        `/api/auth/me/avatar/presign?contentType=${encodeURIComponent(contentType)}` +
          // Signed into the URL as Content-Length, which is what stops a
          // presigned PUT from being an unbounded write.
          `&fileSizeBytes=${file.size}`
      );

      if (!presign.uploadUrl || !presign.r2Key) {
        throw new Error(t('settings.account.storageUnavailable'));
      }

      const uploadRes = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': presign.contentType },
        body: file,
      });
      if (!uploadRes.ok) throw new Error(t('settings.account.uploadFailed'));
      // Store the OBJECT KEY, not `presign.viewUrl`. That view URL is a
      // pre-signed GET that expires with app.r2.presigned-expiry-minutes (60 by
      // default) — the endpoint's own javadoc says callers must not cache it —
      // so writing it into the profile meant every avatar turned into a 403 an
      // hour after upload, permanently, with no refresh path. The backend
      // re-signs the key on every read instead.
      const { data: updated } = await api.patch<AuthUser>('/api/auth/me', {
        avatarUrl: presign.r2Key,
      });
      setUser(updated);
    } catch (err) {
      const responseError = (err as { response?: { data?: { error?: string } } })?.response?.data
        ?.error;
      const msg = responseError ?? t('settings.account.avatarError');
      setAvatarError(msg);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSave = async () => {
    if (saving || !dirty) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      // Clients can only change their own name — subdomain is a tenant-level
      // field they neither see nor own, so it's omitted from their payload.
      const payload = isPhotographer
        ? { fullName: fullNameInput.trim(), subdomain: subdomainInput.trim() }
        : { fullName: fullNameInput.trim() };
      const { data } = await api.patch<AuthUser>('/api/auth/me', payload);
      setUser(data);
      setFullNameInput(data.fullName ?? '');
      setSubdomainInput(data.tenant?.subdomain ?? '');
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        t('settings.account.saveError');
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const saveButtonLabel = saving
    ? t('settings.account.saving')
    : saved
      ? t('settings.account.saved')
      : t('settings.account.save');

  return (
    <>
      <style>{`
        @media (max-width: 600px) {
          .settings-profile-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Account & Studio */}
      <section style={section} aria-labelledby="settings-account">
        <h2
          id="settings-account"
          style={{ fontSize: '1rem', fontWeight: 700, color: c.text, marginBottom: '4px' }}
        >
          {isPhotographer
            ? t('settings.account.title.photographer')
            : t('settings.account.title.client')}
        </h2>
        <p style={{ fontSize: '0.88rem', color: c.textMuted, marginBottom: '20px' }}>
          {isPhotographer
            ? t('settings.account.subtitle.photographer')
            : t('settings.account.subtitle.client')}
        </p>

        {/* Avatar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            marginBottom: '24px',
            padding: '16px',
            background: c.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            borderRadius: '12px',
            border: `1px solid ${c.borderSoft}`,
          }}
        >
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {/* Same component as the sidebar and the header, so a photo that
                shows here shows there too — which it did not, for exactly as
                long as this screen had its own copy of the markup. */}
            <UserAvatar
              name={user?.fullName ?? user?.email ?? '?'}
              src={user?.avatarUrl}
              size={96}
              background={c.primaryBg}
              color={c.primaryText}
              style={{
                border: `3px solid ${c.primary}`,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            />
            {avatarUploading && (
              <div
                style={{
                  position: 'absolute',
                  inset: -3,
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  color: '#fff',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  backdropFilter: 'blur(2px)',
                }}
              >
                uploading
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ marginBottom: '12px' }}>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleAvatarUpload(file);
                  e.target.value = '';
                }}
              />
              <button
                style={{
                  ...saveBtn,
                  padding: '9px 18px',
                  fontSize: '0.88rem',
                  background: c.primaryBg,
                  color: c.primaryText,
                  border: `1px solid ${c.primaryBorder}`,
                }}
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
              >
                {avatarUploading
                  ? t('settings.account.uploading')
                  : t('settings.account.changePhoto')}
              </button>
            </div>
            {avatarError && (
              <div
                role="alert"
                style={{
                  padding: '10px 14px',
                  background: c.isDark ? 'rgba(220, 38, 38, 0.15)' : 'rgba(220, 38, 38, 0.08)',
                  border: `1px solid ${c.isDark ? '#F87171' : '#FCA5A5'}`,
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  color: c.dangerText,
                  marginBottom: '10px',
                }}
              >
                {avatarError.includes('Storage not configured') ||
                avatarError.includes('R2 storage') ? (
                  <>
                    ⚠️ Avatar upload requires Cloudflare R2 storage. Set R2_ENDPOINT, R2_ACCESS_KEY,
                    and R2_SECRET_KEY in your environment to enable this feature.
                  </>
                ) : (
                  avatarError
                )}
              </div>
            )}
            <p style={{ fontSize: '0.8rem', color: c.textMuted, margin: 0 }}>
              JPG, PNG or WebP · max 5 MB · Recommended: 400×400px square
            </p>
          </div>
        </div>
        <div
          className="settings-profile-grid"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}
        >
          <Field label={t('settings.account.fullName')}>
            {(props) => (
              <Input
                {...props}
                value={fullNameInput}
                onChange={(e) => {
                  setFullNameInput(e.target.value);
                  markDirty();
                }}
              />
            )}
          </Field>
          <Field label={t('settings.account.email')}>
            {(props) => <Input {...props} defaultValue={user?.email ?? ''} readOnly />}
          </Field>
        </div>

        {/* Studio subdomain — photographer/tenant-level, hidden from clients */}
        {isPhotographer && (
          <>
            <div style={{ height: '1px', background: c.divider, margin: '24px 0' }} />
            <div
              style={{
                padding: '16px',
                background: c.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                borderRadius: '12px',
                border: `1px solid ${c.borderSoft}`,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Field label={t('settings.account.subdomain')}>
                  {(props) => (
                    <Input
                      {...props}
                      value={subdomainInput}
                      onChange={(e) => {
                        setSubdomainInput(e.target.value);
                        markDirty();
                      }}
                      style={{ fontWeight: 500, background: c.surfaceHover }}
                    />
                  )}
                </Field>
                <div
                  style={{
                    padding: '10px 14px',
                    background: c.primaryBg,
                    border: `1px solid ${c.primaryBorder}`,
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    color: c.primaryText,
                    marginTop: '8px',
                  }}
                >
                  {t('settings.account.publicAddress')}{' '}
                  <strong style={{ color: c.primaryStrong }}>
                    {(subdomainInput.trim() || 'your-studio').toLowerCase()}.fotolio.app
                  </strong>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Save button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            marginTop: '24px',
            flexWrap: 'wrap',
          }}
        >
          <Button
            variant="primary"
            onClick={handleSave}
            busy={saving}
            busyLabel={t('settings.account.saving')}
            disabled={!dirty}
            aria-live="polite"
            style={
              saved
                ? {
                    background: c.successBg,
                    color: c.successText,
                    border: `1px solid ${c.successBorder}`,
                  }
                : undefined
            }
          >
            {saveButtonLabel}
          </Button>
          {error && <Alert tone="danger">{error}</Alert>}
        </div>
      </section>

      {/* Danger zone */}
      <SettingsSection
        id="settings-danger"
        tone="danger"
        title={t('settings.danger.title')}
        description={t('settings.danger.subtitle')}
        colors={c}
      >
        <button
          style={{
            padding: '9px 20px',
            background: c.dangerBg,
            color: c.dangerText,
            border: `1px solid ${c.dangerBorder}`,
            borderRadius: '10px',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t('settings.danger.deleteAccount')}
        </button>
      </SettingsSection>
    </>
  );
}
