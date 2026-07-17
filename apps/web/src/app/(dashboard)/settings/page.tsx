"use client";

import { AuthUser, useAuthStore, useIsPhotographer } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { getColors, type Theme } from '@/lib/design-tokens';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import api from '@/lib/api';
import type { Package } from '@/types/api';
import Image from 'next/image';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export default function SettingsPage() {
  const user = useAuthStore(st => st.user);
  const setUser = useAuthStore(st => st.setUser);
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

  const input: React.CSSProperties = {
    padding: '10px 14px',
    border: `1px solid ${c.border}`,
    borderRadius: '10px',
    fontSize: '0.92rem',
    color: c.text,
    background: c.surfaceAlt,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };

  const label: React.CSSProperties = {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: c.textMuted,
    letterSpacing: '0.02em',
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
      setAvatarError('File must be smaller than 5 MB.');
      return;
    }
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const contentType = file.type || 'image/jpeg';
      const { data: presign } = await api.post<{ uploadUrl: string; viewUrl: string }>(
        `/api/auth/me/avatar/presign?contentType=${encodeURIComponent(contentType)}`
      );
      
      // Check if presign response looks valid (has uploadUrl)
      if (!presign.uploadUrl || !presign.viewUrl) {
        throw new Error('Storage not configured. Please contact support.');
      }
      
      const uploadRes = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file,
      });
      if (!uploadRes.ok) throw new Error('Upload to storage failed');
      const { data: updated } = await api.patch<AuthUser>('/api/auth/me', { avatarUrl: presign.viewUrl });
      setUser(updated);
    } catch (err) {
      const responseError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      const msg = responseError ?? 'Could not upload photo. Please try again.';
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
        'Could not save your changes. Please try again.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const saveButtonStyle: React.CSSProperties = {
    ...saveBtn,
    minWidth: '140px',
    background: saved ? c.successBg : saveBtn.background,
    color: saved ? c.successText : saveBtn.color,
    border: saved ? `1px solid ${c.successBorder}` : 'none',
    cursor: saving ? 'progress' : !dirty ? 'not-allowed' : 'pointer',
    opacity: !dirty ? 0.55 : 1,
  };

  const saveButtonLabel = saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes';

  return (
    <div style={{
      padding: '28px 28px 40px',
      maxWidth: '860px',
      margin: '0 auto',
      fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: c.text,
    }}>
      <style>{`
        @media (max-width: 600px) {
          .settings-profile-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: c.text, marginBottom: '6px' }}>
        Settings
      </h1>
      <p style={{ fontSize: '0.95rem', color: c.textMuted, marginBottom: '32px' }}>
        {isPhotographer
          ? 'Manage your account, studio and billing preferences.'
          : 'Manage your account.'}
      </p>

      {/* Account & Studio */}
      <section style={section} aria-labelledby="settings-account">
        <h2 id="settings-account" style={{ fontSize: '1rem', fontWeight: 700, color: c.text, marginBottom: '4px' }}>
          {isPhotographer ? 'Account & Studio' : 'Account'}
        </h2>
        <p style={{ fontSize: '0.88rem', color: c.textMuted, marginBottom: '20px' }}>
          {isPhotographer
            ? 'Your personal information and studio details.'
            : 'Your personal information.'}
        </p>

        {/* Avatar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          marginBottom: '24px',
          padding: '16px',
          background: c.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
          borderRadius: '12px',
          border: `1px solid ${c.borderSoft}`
        }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {user?.avatarUrl ? (
              <div style={{ width: 96, height: 96, borderRadius: '50%', overflow: 'hidden', border: `3px solid ${c.primary}`, boxShadow: `0 4px 12px rgba(0,0,0,0.15)` }}>
                <Image
                  src={user.avatarUrl}
                  alt="Profile photo"
                  fill
                  style={{ objectFit: 'cover' }}
                />
              </div>
            ) : (
              <div style={{
                width: 96, height: 96, borderRadius: '50%',
                background: c.primaryBg,
                border: `3px solid ${c.primary}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '2.4rem', color: c.primaryText, fontWeight: 700,
                boxShadow: `0 4px 12px rgba(0,0,0,0.15)`
              }}>
                {user?.fullName?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            {avatarUploading && (
              <div style={{
                position: 'absolute', inset: -3, borderRadius: '50%',
                background: 'rgba(0,0,0,0.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.7rem', color: '#fff', fontWeight: 700, letterSpacing: '0.04em',
                backdropFilter: 'blur(2px)'
              }}>
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
                  border: `1px solid ${c.primaryBorder}`
                }}
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
              >
                {avatarUploading ? 'Uploading…' : 'Change photo'}
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
                  marginBottom: '10px'
                }}
              >
                {avatarError.includes('Storage not configured') || avatarError.includes('R2 storage') ? (
                  <>
                    ⚠️ Avatar upload requires Cloudflare R2 storage. Set R2_ENDPOINT, R2_ACCESS_KEY, and R2_SECRET_KEY in your environment to enable this feature.
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
        <div className="settings-profile-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="settings-fullname" style={label}>Full name</label>
            <input
              id="settings-fullname"
              value={fullNameInput}
              onChange={(e) => { setFullNameInput(e.target.value); markDirty(); }}
              style={input}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="settings-email" style={label}>Email address</label>
            <input id="settings-email" defaultValue={user?.email ?? ''} style={input} readOnly />
          </div>
        </div>

        {/* Studio subdomain — photographer/tenant-level, hidden from clients */}
        {isPhotographer && (
          <>
            <div style={{ height: '1px', background: c.divider, margin: '24px 0' }} />
            <div style={{
              padding: '16px',
              background: c.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              borderRadius: '12px',
              border: `1px solid ${c.borderSoft}`
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label htmlFor="settings-subdomain" style={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: c.textMuted,
                  letterSpacing: '0.02em'
                }}>
                  Studio name / subdomain
                </label>
                <input
                  id="settings-subdomain"
                  value={subdomainInput}
                  onChange={(e) => { setSubdomainInput(e.target.value); markDirty(); }}
                  style={{
                    ...input,
                    fontSize: '0.95rem',
                    fontWeight: 500,
                    background: c.surfaceHover
                  }}
                />
                <div style={{
                  padding: '10px 14px',
                  background: c.primaryBg,
                  border: `1px solid ${c.primaryBorder}`,
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  color: c.primaryText,
                  marginTop: '8px'
                }}>
                  Your public address: <strong style={{ color: c.primaryStrong }}>
                    {(subdomainInput.trim() || 'your-studio').toLowerCase()}.fotolio.app
                  </strong>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Save button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '24px', flexWrap: 'wrap' }}>
          <button
            style={saveButtonStyle}
            onClick={handleSave}
            disabled={saving || !dirty}
            aria-live="polite"
          >
            {saveButtonLabel}
          </button>
          {error && (
            <span role="alert" style={{ fontSize: '0.82rem', color: c.dangerText, fontWeight: 600 }}>
              {error}
            </span>
          )}
        </div>
      </section>

      {/* Packages — photographer-only service catalog */}
      {isPhotographer && <PackagesSection theme={theme} />}

      {/* Billing — the tenant's subscription; never shown to clients */}
      {isPhotographer && (
      <section style={section} aria-labelledby="settings-billing">
        <h2 id="settings-billing" style={{ fontSize: '1rem', fontWeight: 700, color: c.text, marginBottom: '4px' }}>
          Plan &amp; Billing
        </h2>
        <p style={{ fontSize: '0.88rem', color: c.textMuted, marginBottom: '20px' }}>
          Your current subscription and payment settings.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: c.text, marginBottom: '4px' }}>Current plan</div>
            <span style={{
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
            }}>
              {user?.tenant?.plan ?? 'Starter'}
            </span>
          </div>
          <button style={{
            padding: '9px 20px',
            background: c.surface,
            color: c.text,
            border: `1px solid ${c.border}`,
            borderRadius: '10px',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}>
            Upgrade plan
          </button>
        </div>
        <div style={{ height: '1px', background: c.divider, margin: '20px 0' }} />
        <div style={{ fontSize: '0.88rem', color: c.textMuted }}>
          Billing history and invoice management coming soon.
        </div>
      </section>
      )}

      {/* Danger zone */}
      <section style={{ ...section, borderColor: c.dangerBorder, marginTop: '20px' }} aria-labelledby="settings-danger">
        <h2 id="settings-danger" style={{ fontSize: '1rem', fontWeight: 700, color: c.danger, marginBottom: '4px' }}>
          Danger zone
        </h2>
        <p style={{ fontSize: '0.88rem', color: c.textMuted, marginBottom: '20px' }}>
          Irreversible actions. Please proceed with caution.
        </p>
        <button style={{
          padding: '9px 20px',
          background: c.dangerBg,
          color: c.dangerText,
          border: `1px solid ${c.dangerBorder}`,
          borderRadius: '10px',
          fontSize: '0.88rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}>
          Delete account
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
  const c = useMemo(() => getColors(theme), [theme]);

  const [packages, setPackages] = useState<Package[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
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
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error ?? 'Could not load packages.';
      setLoadError(msg);
      setPackages([]);
    }
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
      setSubmitError('Name is required.');
      return;
    }
    const euros = Number(form.priceEuros);
    if (!Number.isFinite(euros) || euros <= 0) {
      // Backend allows 0 today; the UI is stricter on purpose — a €0 package
      // is almost always a typo and easier to catch here than in invoices.
      setSubmitError('Price must be a positive number of euros.');
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
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error ?? 'Could not save the package.';
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
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error ?? 'Could not delete the package.';
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
  const input: React.CSSProperties = {
    padding: '10px 14px',
    border: `1px solid ${c.border}`,
    borderRadius: '10px',
    fontSize: '0.9rem',
    color: c.text,
    background: c.surfaceAlt,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };
  const label: React.CSSProperties = {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: c.textMuted,
    letterSpacing: '0.02em',
  };
  const primaryBtn: React.CSSProperties = {
    padding: '10px 20px',
    background: c.primarySolid,
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', gridColumn: 'span 2' }}>
          <label style={label} htmlFor="pkg-name">Package name *</label>
          <input
            id="pkg-name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            style={{
              ...input,
              fontSize: '0.95rem',
              background: c.surfaceHover
            }}
            placeholder="e.g. Standard Wedding"
            maxLength={200}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={label} htmlFor="pkg-price">Price (€) *</label>
          <input
            id="pkg-price"
            type="number"
            min="1"
            step="1"
            value={form.priceEuros}
            onChange={(e) => setForm((f) => ({ ...f, priceEuros: e.target.value }))}
            style={{
              ...input,
              fontSize: '0.95rem',
              background: c.surfaceHover
            }}
            placeholder="e.g. 1800"
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={label} htmlFor="pkg-duration">Duration (hours)</label>
          <input
            id="pkg-duration"
            type="number"
            min="0"
            step="0.5"
            value={form.durationHours}
            onChange={(e) => setForm((f) => ({ ...f, durationHours: e.target.value }))}
            style={{
              ...input,
              fontSize: '0.95rem',
              background: c.surfaceHover
            }}
            placeholder="e.g. 8"
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={label} htmlFor="pkg-photos">Included photos</label>
          <input
            id="pkg-photos"
            type="number"
            min="0"
            step="1"
            value={form.includedPhotos}
            onChange={(e) => setForm((f) => ({ ...f, includedPhotos: e.target.value }))}
            style={{
              ...input,
              fontSize: '0.95rem',
              background: c.surfaceHover
            }}
            placeholder="e.g. 300"
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={label} htmlFor="pkg-sort">Sort order</label>
          <input
            id="pkg-sort"
            type="number"
            step="1"
            value={form.sortOrder}
            onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
            style={{
              ...input,
              fontSize: '0.95rem',
              background: c.surfaceHover
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', paddingBottom: '4px' }}>
          <label
            htmlFor="pkg-active"
            style={{ ...label, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
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
                accentColor: c.primary
              }}
            />
            Active
          </label>
        </div>
      </div>

      {submitError && (
        <div
          role="alert"
          style={{
            marginTop: '20px',
            padding: '14px 16px',
            background: c.isDark ? 'rgba(220, 38, 38, 0.15)' : 'rgba(220, 38, 38, 0.08)',
            color: c.dangerText,
            border: `1px solid ${c.isDark ? '#F87171' : '#FCA5A5'}`,
            borderRadius: '10px',
            fontSize: '0.9rem',
          }}
        >
          {submitError}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '14px', marginTop: '24px', paddingTop: '20px', borderTop: `1px solid ${c.borderSoft}` }}>
        <button type="button" style={ghostBtn} onClick={cancelEdit} disabled={submitting}>
          Cancel
        </button>
        <button
          type="button"
          style={{ ...primaryBtn, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'wait' : 'pointer' }}
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? 'Saving…' : editingId ? 'Save changes' : 'Create package'}
        </button>
      </div>
    </div>
  );

  return (
    <section style={section} aria-labelledby="settings-packages">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
        <div>
          <h2 id="settings-packages" style={{ fontSize: '1rem', fontWeight: 700, color: c.text, marginBottom: '4px' }}>
            Packages
          </h2>
          <p style={{ fontSize: '0.88rem', color: c.textMuted, margin: 0 }}>
            Pricing packages your clients can be booked into. Choosing one on a booking
            auto-fills the total.
          </p>
        </div>
        {!creating && !editingId && (
          <button type="button" style={{
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
            gap: '6px'
          }} onClick={startCreate}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
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
          {loadError}
        </div>
      )}

      {packages === null ? (
        <div style={{ padding: '40px', fontSize: '0.9rem', color: c.textMuted, textAlign: 'center' }}>
          <div style={{ marginBottom: '16px', opacity: 0.5 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 4h13M3 8h9m-9 4h6m4 0h4M4 16h16M5 20h14" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          Loading packages...
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
          <p style={{ fontSize: '0.95rem', color: c.textMuted, margin: '0 0 20px', fontWeight: 500 }}>
            No packages yet
          </p>
          <p style={{ fontSize: '0.88rem', color: c.textMuted, margin: '0 0 24px', maxWidth: '320px', marginInline: 'auto' }}>
            Add a pricing package to start using auto-pricing on bookings. Clients will see these when booking your services.
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
              transition: 'all 0.2s ease'
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
              <tr style={{ textAlign: 'left', color: c.textMuted, borderBottom: `2px solid ${c.divider}` }}>
                <th style={{ padding: '14px 12px 14px 0', fontWeight: 600, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Name</th>
                <th style={{ padding: '14px 12px', fontWeight: 600, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Price</th>
                <th style={{ padding: '14px 12px', fontWeight: 600, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Duration</th>
                <th style={{ padding: '14px 12px', fontWeight: 600, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Photos</th>
                <th style={{ padding: '14px 12px', fontWeight: 600, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</th>
                <th style={{ padding: '14px 12px', fontWeight: 600, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.06em' }} aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <React.Fragment key={pkg.id}>
                  <tr style={{ borderBottom: `1px solid ${c.borderSoft}`, transition: 'background 0.2s ease' }}>
                    <td style={{ padding: '16px 12px 16px 0', color: c.text, fontWeight: 600 }}>{pkg.name}</td>
                    <td style={{ padding: '16px 12px', color: c.text, fontWeight: 500 }}>{formatPriceEur(pkg.priceCents, pkg.currency)}</td>
                    <td style={{ padding: '16px 12px', color: c.textMuted }}>{pkg.durationHours != null ? `${pkg.durationHours}h` : '—'}</td>
                    <td style={{ padding: '16px 12px', color: c.textMuted }}>{pkg.includedPhotos != null ? pkg.includedPhotos : '—'}</td>
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
                        {pkg.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 0 16px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
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
                        Delete
                      </button>
                    </td>
                  </tr>
                  {editingId === pkg.id && (
                    <tr>
                      <td colSpan={6} style={{ padding: 0 }}>{renderForm()}</td>
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
        title="Delete this package?"
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
