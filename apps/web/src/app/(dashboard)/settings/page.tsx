'use client';

import { AuthUser, useAuthStore, useIsPhotographer } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { getColors, type Theme } from '@/lib/design-tokens';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import api from '@/lib/api';
import { asyncError, asyncErrorText, type AsyncError } from '@/lib/async-error';
import { useTranslation } from '@/lib/i18n';
import { Alert, Button, Field, Input } from '@/components/ui';
import type { Package } from '@/types/api';
import { BillingProfileSection, DatevExportSection, StripeConnectSection } from './BillingSettings';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export default function SettingsPage() {
  const { t } = useTranslation();
  const user = useAuthStore((st) => st.user);
  const setUser = useAuthStore((st) => st.setUser);
  const { theme } = useThemeStore();
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
  const [avatarBroken, setAvatarBroken] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Re-seed the inputs only when the user *identity* changes (i.e. loads on
  // first paint) — not on every field update, which would clobber edits and
  // the post-save state. Field deps are intentionally omitted.
  useEffect(() => {
    // Ensure CSRF token is set by making a GET request on mount
    api.get('/api/auth/me').catch(() => {});
  }, []);

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
      }>(`/api/auth/me/avatar/presign?contentType=${encodeURIComponent(contentType)}`);

      if (!presign.uploadUrl || !presign.r2Key) {
        throw new Error(t('settings.account.storageUnavailable'));
      }

      const uploadRes = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
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
      setAvatarBroken(false);
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
    <div
      style={{
        padding: '28px 28px 40px',
        maxWidth: '860px',
        margin: '0 auto',
        fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: c.text,
      }}
    >
      <style>{`
        @media (max-width: 600px) {
          .settings-profile-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: c.text, marginBottom: '6px' }}>
        {t('settings.title')}
      </h1>
      <p style={{ fontSize: '0.95rem', color: c.textMuted, marginBottom: '32px' }}>
        {isPhotographer ? t('settings.subtitle.photographer') : t('settings.subtitle.client')}
      </p>

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
            {user?.avatarUrl && !avatarBroken ? (
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: `3px solid ${c.primary}`,
                  boxShadow: `0 4px 12px rgba(0,0,0,0.15)`,
                }}
              >
                {/* Plain <img>, like every other remote image in this app.
                    next/image refuses any host absent from images.remotePatterns
                    in next.config — which is an empty array — so as soon as a
                    user actually had an avatar it threw "Invalid src prop ...
                    hostname is not configured" and took the settings page with
                    it. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={user.avatarUrl}
                  alt="Profile photo"
                  width={96}
                  height={96}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  // A stored object key is re-signed per response, but an old
                  // row may still hold an expired URL — fall back to the
                  // initials placeholder rather than a broken-image icon.
                  onError={() => setAvatarBroken(true)}
                />
              </div>
            ) : (
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: '50%',
                  background: c.primaryBg,
                  border: `3px solid ${c.primary}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2.4rem',
                  color: c.primaryText,
                  fontWeight: 700,
                  boxShadow: `0 4px 12px rgba(0,0,0,0.15)`,
                }}
              >
                {user?.fullName?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
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

      {/* Packages — photographer-only service catalog */}
      {isPhotographer && <PackagesSection theme={theme} />}

      {/* Invoicing identity and payout account. Both are photographer-only and
          tenant-wide: a client shares the tenant but must never see (let alone
          rewrite) the tax numbers that go on invoices, or the Stripe account
          their own money lands in. The API enforces that too. */}
      {isPhotographer && <BillingProfileSection />}
      {isPhotographer && (
        // useSearchParams needs a Suspense boundary — Stripe sends the browser
        // back here with ?stripe=return after hosted onboarding.
        <React.Suspense fallback={null}>
          <StripeConnectSection />
        </React.Suspense>
      )}

      {/* Bookkeeping handover. Sits under the invoicing identity because the
          export's header carries the business name configured above. */}
      {isPhotographer && <DatevExportSection />}

      {/* Billing — the tenant's subscription; never shown to clients */}
      {isPhotographer && (
        <section style={section} aria-labelledby="settings-billing">
          <h2
            id="settings-billing"
            style={{ fontSize: '1rem', fontWeight: 700, color: c.text, marginBottom: '4px' }}
          >
            {t('settings.plan.title')}
          </h2>
          <p style={{ fontSize: '0.88rem', color: c.textMuted, marginBottom: '20px' }}>
            {t('settings.plan.subtitle')}
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div>
              <div
                style={{ fontSize: '0.9rem', fontWeight: 600, color: c.text, marginBottom: '4px' }}
              >
                {t('settings.plan.current')}
              </div>
              <span
                style={{
                  display: 'inline-flex',
                  padding: '4px 12px',
                  borderRadius: '999px',
                  background: c.primaryBg,
                  color: c.primaryText,
                  border: `1px solid ${c.primaryBorder}`,
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {user?.tenant?.plan ?? 'Starter'}
              </span>
            </div>
            <button
              style={{
                padding: '9px 20px',
                background: c.surface,
                color: c.text,
                border: `1px solid ${c.border}`,
                borderRadius: '10px',
                fontSize: '0.88rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('settings.plan.upgrade')}
            </button>
          </div>
          <div style={{ height: '1px', background: c.divider, margin: '20px 0' }} />
          <div style={{ fontSize: '0.88rem', color: c.textMuted }}>{t('settings.plan.note')}</div>
        </section>
      )}

      {/* Danger zone */}
      <section
        style={{ ...section, borderColor: c.dangerBorder, marginTop: '20px' }}
        aria-labelledby="settings-danger"
      >
        <h2
          id="settings-danger"
          style={{ fontSize: '1rem', fontWeight: 700, color: c.danger, marginBottom: '4px' }}
        >
          {t('settings.danger.title')}
        </h2>
        <p style={{ fontSize: '0.88rem', color: c.textMuted, marginBottom: '20px' }}>
          {t('settings.danger.subtitle')}
        </p>
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
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Packages section
// ─────────────────────────────────────────────────────────────────────────────

type PackageFormState = {
  name: string;
  /** Euros, as the photographer types it. Converted to cents on submit. */
  priceEuros: string;
  durationHours: string;
  includedPhotos: string;
  active: boolean;
  sortOrder: string;
};

const EMPTY_PACKAGE_FORM: PackageFormState = {
  name: '',
  priceEuros: '',
  durationHours: '',
  includedPhotos: '',
  active: true,
  sortOrder: '0',
};

function formatPriceEur(cents: number, currency: string): string {
  // The catalog is small (single-digit packages); Intl.NumberFormat per call
  // is fine. No need to memoise a formatter per currency.
  try {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    // Fallback if the entity ever holds a non-ISO currency string.
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

function packageToForm(pkg: Package): PackageFormState {
  return {
    name: pkg.name,
    priceEuros: String(pkg.priceCents / 100),
    durationHours: pkg.durationHours != null ? String(pkg.durationHours) : '',
    includedPhotos: pkg.includedPhotos != null ? String(pkg.includedPhotos) : '',
    active: pkg.active,
    sortOrder: String(pkg.sortOrder),
  };
}

function PackagesSection({ theme }: { readonly theme: Theme }) {
  const { t } = useTranslation();
  const c = useMemo(() => getColors(theme), [theme]);

  const [packages, setPackages] = useState<Package[] | null>(null);
  const [loadError, setLoadError] = useState<AsyncError | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // `creating` opens an inline create form. Mutually exclusive with editing
  // any existing row so the photographer can't accidentally edit two things
  // at once.
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<PackageFormState>(EMPTY_PACKAGE_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Package | null>(null);
  const [deleting, setDeleting] = useState(false);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const { data } = await api.get<Package[]>('/api/packages');
      setPackages(data);
    } catch (err) {
      setLoadError(asyncError(err, 'settings.packages.loadError'));
      setPackages([]);
    }
    // Deliberately not depending on `t`: an effect below depends on `reload`,
    // so a `t` here would reload the package list on every language change.
    // The failure is kept as a key and translated where it is rendered.
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const startCreate = () => {
    setCreating(true);
    setEditingId(null);
    setForm(EMPTY_PACKAGE_FORM);
    setSubmitError(null);
  };

  const startEdit = (pkg: Package) => {
    setEditingId(pkg.id);
    setCreating(false);
    setForm(packageToForm(pkg));
    setSubmitError(null);
  };

  const cancelEdit = () => {
    setCreating(false);
    setEditingId(null);
    setSubmitError(null);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setSubmitError(t('settings.packages.nameRequired'));
      return;
    }
    const euros = Number(form.priceEuros);
    if (!Number.isFinite(euros) || euros <= 0) {
      // Backend allows 0 today; the UI is stricter on purpose — a €0 package
      // is almost always a typo and easier to catch here than in invoices.
      setSubmitError(t('settings.packages.priceInvalid'));
      return;
    }
    const payload = {
      name: trimmedName,
      // Banker's rounding could lose half a cent on weird inputs; Math.round
      // matches what the booking form does (eurosToCents).
      priceCents: Math.round(euros * 100),
      durationHours: form.durationHours.trim() ? Number(form.durationHours) : null,
      includedPhotos: form.includedPhotos.trim() ? Number(form.includedPhotos) : null,
      active: form.active,
      sortOrder: form.sortOrder.trim() ? Number(form.sortOrder) : 0,
    };

    setSubmitting(true);
    setSubmitError(null);
    try {
      if (editingId) {
        await api.put<Package>(`/api/packages/${editingId}`, payload);
      } else {
        await api.post<Package>('/api/packages', payload);
      }
      await reload();
      cancelEdit();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        t('settings.packages.saveError');
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      await api.delete(`/api/packages/${pendingDelete.id}`);
      setPendingDelete(null);
      await reload();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        t('settings.packages.deleteError');
      setSubmitError(msg);
    } finally {
      setDeleting(false);
    }
  };

  // Styles ───────────────────────────────────────────────────────────────────
  const section: React.CSSProperties = {
    background: c.surface,
    border: `1px solid ${c.border}`,
    borderRadius: '14px',
    padding: '24px',
    marginBottom: '20px',
    boxShadow: c.overlayShadow,
  };
  const label: React.CSSProperties = {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: c.textMuted,
    letterSpacing: '0.02em',
  };
  const ghostBtn: React.CSSProperties = {
    padding: '8px 16px',
    background: 'transparent',
    color: c.textMuted,
    border: `1px solid ${c.border}`,
    borderRadius: '10px',
    fontSize: '0.88rem',
    fontWeight: 600,
    cursor: 'pointer',
  };
  const dangerBtn: React.CSSProperties = {
    ...ghostBtn,
    color: c.dangerText,
    borderColor: c.dangerBorder,
    background: c.dangerBg,
  };

  const renderForm = () => (
    <div
      style={{
        marginTop: '20px',
        padding: '24px',
        background: c.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        border: `1px solid ${c.borderSoft}`,
        borderRadius: '12px',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '20px',
        }}
      >
        <div style={{ gridColumn: 'span 2' }}>
          <Field label={t('settings.packages.name')}>
            {(props) => (
              <Input
                {...props}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                maxLength={200}
                placeholder={t('settings.packages.namePlaceholder')}
                style={{ background: c.surfaceHover }}
              />
            )}
          </Field>
        </div>
        <div>
          <Field label={t('settings.packages.price')}>
            {(props) => (
              <Input
                {...props}
                type="number"
                min="1"
                step="1"
                value={form.priceEuros}
                onChange={(e) => setForm((f) => ({ ...f, priceEuros: e.target.value }))}
                placeholder={t('settings.packages.pricePlaceholder')}
                style={{ background: c.surfaceHover }}
              />
            )}
          </Field>
        </div>
        <div>
          <Field label={t('settings.packages.duration')}>
            {(props) => (
              <Input
                {...props}
                type="number"
                min="0"
                step="0.5"
                value={form.durationHours}
                onChange={(e) => setForm((f) => ({ ...f, durationHours: e.target.value }))}
                placeholder={t('settings.packages.durationPlaceholder')}
                style={{ background: c.surfaceHover }}
              />
            )}
          </Field>
        </div>
        <div>
          <Field label={t('settings.packages.includedPhotos')}>
            {(props) => (
              <Input
                {...props}
                type="number"
                min="0"
                step="1"
                value={form.includedPhotos}
                onChange={(e) => setForm((f) => ({ ...f, includedPhotos: e.target.value }))}
                placeholder={t('settings.packages.includedPhotosPlaceholder')}
                style={{ background: c.surfaceHover }}
              />
            )}
          </Field>
        </div>
        <div>
          <Field label={t('settings.packages.sortOrder')}>
            {(props) => (
              <Input
                {...props}
                type="number"
                min="0"
                step="1"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                style={{ background: c.surfaceHover }}
              />
            )}
          </Field>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', paddingBottom: '4px' }}>
          <label
            htmlFor="pkg-active"
            style={{
              ...label,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <input
              id="pkg-active"
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              style={{
                width: '18px',
                height: '18px',
                cursor: 'pointer',
                accentColor: c.primary,
              }}
            />
            {t('settings.packages.active')}
          </label>
        </div>
      </div>

      {submitError && (
        <Alert tone="danger" style={{ marginTop: 20 }}>
          {submitError}
        </Alert>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '14px',
          marginTop: '24px',
          paddingTop: '20px',
          borderTop: `1px solid ${c.borderSoft}`,
        }}
      >
        <Button variant="ghost" onClick={cancelEdit} disabled={submitting}>
          {t('settings.packages.cancel')}
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          busy={submitting}
          busyLabel={t('settings.packages.submitting')}
        >
          {editingId ? t('settings.packages.save') : t('settings.packages.create')}
        </Button>
      </div>
    </div>
  );

  return (
    <section style={section} aria-labelledby="settings-packages">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div>
          <h2
            id="settings-packages"
            style={{ fontSize: '1rem', fontWeight: 700, color: c.text, marginBottom: '4px' }}
          >
            {t('settings.packages.title')}
          </h2>
          <p style={{ fontSize: '0.88rem', color: c.textMuted, margin: 0 }}>
            {t('settings.packages.subtitle')}
            the total.
          </p>
        </div>
        {!creating && !editingId && (
          <button
            type="button"
            style={{
              padding: '9px 18px',
              background: c.primaryBg,
              color: c.primaryText,
              border: `1px solid ${c.primaryBorder}`,
              borderRadius: '8px',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onClick={startCreate}
          >
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
              <path
                d="M7 1v12M1 7h12"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            + Add package
          </button>
        )}
      </div>

      {loadError && (
        <div
          role="alert"
          style={{
            padding: '8px 12px',
            background: c.dangerBg,
            color: c.dangerText,
            border: `1px solid ${c.dangerBorder}`,
            borderRadius: '8px',
            fontSize: '0.85rem',
            marginBottom: '12px',
          }}
        >
          {asyncErrorText(loadError, t)}
        </div>
      )}

      {packages === null ? (
        <div
          style={{ padding: '40px', fontSize: '0.9rem', color: c.textMuted, textAlign: 'center' }}
        >
          <div style={{ marginBottom: '16px', opacity: 0.5 }}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                d="M3 4h13M3 8h9m-9 4h6m4 0h4M4 16h16M5 20h14"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          {t('settings.packages.loading')}
        </div>
      ) : packages.length === 0 && !creating ? (
        <div
          style={{
            padding: '48px 32px',
            background: c.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            border: `1px dashed ${c.border}`,
            borderRadius: '12px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.3 }}>📦</div>
          <p
            style={{ fontSize: '0.95rem', color: c.textMuted, margin: '0 0 20px', fontWeight: 500 }}
          >
            {t('settings.packages.empty')}
          </p>
          <p
            style={{
              fontSize: '0.88rem',
              color: c.textMuted,
              margin: '0 0 24px',
              maxWidth: '320px',
              marginInline: 'auto',
            }}
          >
            {t('settings.packages.emptyBody')}
            when booking your services.
          </p>
          <button
            type="button"
            style={{
              padding: '12px 24px',
              background: c.primaryBg,
              color: c.primaryText,
              border: `1px solid ${c.primaryBorder}`,
              borderRadius: '10px',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onClick={startCreate}
          >
            + Add your first package
          </button>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr
                style={{
                  textAlign: 'left',
                  color: c.textMuted,
                  borderBottom: `2px solid ${c.divider}`,
                }}
              >
                <th
                  style={{
                    padding: '14px 12px 14px 0',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Name
                </th>
                <th
                  style={{
                    padding: '14px 12px',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  {t('settings.packages.price')}
                </th>
                <th
                  style={{
                    padding: '14px 12px',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  {t('settings.packages.duration')}
                </th>
                <th
                  style={{
                    padding: '14px 12px',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  {t('settings.packages.photos')}
                </th>
                <th
                  style={{
                    padding: '14px 12px',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  {t('settings.packages.status')}
                </th>
                <th
                  style={{
                    padding: '14px 12px',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                  aria-label={t('settings.packages.actions')}
                />
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <React.Fragment key={pkg.id}>
                  <tr
                    style={{
                      borderBottom: `1px solid ${c.borderSoft}`,
                      transition: 'background 0.2s ease',
                    }}
                  >
                    <td style={{ padding: '16px 12px 16px 0', color: c.text, fontWeight: 600 }}>
                      {pkg.name}
                    </td>
                    <td style={{ padding: '16px 12px', color: c.text, fontWeight: 500 }}>
                      {formatPriceEur(pkg.priceCents, pkg.currency)}
                    </td>
                    <td style={{ padding: '16px 12px', color: c.textMuted }}>
                      {pkg.durationHours != null ? `${pkg.durationHours}h` : '—'}
                    </td>
                    <td style={{ padding: '16px 12px', color: c.textMuted }}>
                      {pkg.includedPhotos != null ? pkg.includedPhotos : '—'}
                    </td>
                    <td style={{ padding: '16px 12px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          padding: '6px 12px',
                          borderRadius: '999px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          background: pkg.active ? c.successBg : c.surfaceAlt,
                          color: pkg.active ? c.successText : c.textMuted,
                          border: `1px solid ${pkg.active ? c.successBorder : c.border}`,
                        }}
                      >
                        {pkg.active
                          ? t('settings.packages.active')
                          : t('settings.packages.inactive')}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '16px 0 16px 12px',
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <button
                        type="button"
                        style={{ ...ghostBtn, marginRight: '8px' }}
                        onClick={() => startEdit(pkg)}
                        disabled={!!editingId || creating}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        style={dangerBtn}
                        onClick={() => setPendingDelete(pkg)}
                        disabled={!!editingId || creating}
                      >
                        {t('settings.packages.delete')}
                      </button>
                    </td>
                  </tr>
                  {editingId === pkg.id && (
                    <tr>
                      <td colSpan={6} style={{ padding: 0 }}>
                        {renderForm()}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && renderForm()}

      <ConfirmDialog
        open={!!pendingDelete}
        theme={theme}
        title={t('settings.packages.deleteConfirm')}
        message={
          pendingDelete
            ? `"${pendingDelete.name}" will be removed. Bookings that referenced this package will keep their total amounts but lose the package link.`
            : ''
        }
        confirmLabel="Delete"
        tone="danger"
        busy={deleting}
        onCancel={() => !deleting && setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
