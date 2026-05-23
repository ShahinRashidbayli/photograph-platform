"use client";

import { AuthUser, useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { getColors } from '@/lib/design-tokens';
import api from '@/lib/api';
import React, { useEffect, useMemo, useState } from 'react';

type SectionKey = 'profile' | 'studio';

export default function SettingsPage() {
  const user = useAuthStore(st => st.user);
  const setUser = useAuthStore(st => st.setUser);
  const { theme } = useThemeStore();
  const c = useMemo(() => getColors(theme), [theme]);

  // Controlled inputs — kept in state so we can submit and reset them.
  const [fullNameInput, setFullNameInput] = useState(user?.fullName ?? '');
  const [subdomainInput, setSubdomainInput] = useState(user?.tenant?.subdomain ?? '');

  // Track save feedback per section so saving "Profile" doesn't flip the
  // "Studio" button's label.
  const [savingKey, setSavingKey] = useState<SectionKey | null>(null);
  const [savedKey, setSavedKey] = useState<SectionKey | null>(null);
  // Track which sections have unsaved edits so Save stays disabled until
  // a field actually changes.
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Re-seed the inputs only when the user *identity* changes (i.e. loads on
  // first paint) — not on every field update, which would clobber edits and
  // the post-save state. Field deps are intentionally omitted.
  useEffect(() => {
    setFullNameInput(user?.fullName ?? '');
    setSubdomainInput(user?.tenant?.subdomain ?? '');
    setDirty({});
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
    background: c.isDark ? '#F1F5F9' : '#0F172A',
    color: c.isDark ? '#0F172A' : '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
  };

  const markDirty = (key: SectionKey) => {
    setDirty((d) => (d[key] ? d : { ...d, [key]: true }));
    setSavedKey((k) => (k === key ? null : k));
    setErrors((e) => (e[key] ? { ...e, [key]: '' } : e));
  };

  const handleSave = async (key: SectionKey) => {
    if (savingKey || !dirty[key]) return;
    setSavingKey(key);
    setSavedKey(null);
    setErrors((e) => ({ ...e, [key]: '' }));
    try {
      const payload =
        key === 'profile'
          ? { fullName: fullNameInput.trim() }
          : { subdomain: subdomainInput.trim() };
      const { data } = await api.patch<AuthUser>('/api/auth/me', payload);
      // Update the shared auth store so the dashboard/overview reflect the
      // change immediately, and re-seed the input with the server's
      // normalised value (e.g. a lower-cased subdomain).
      setUser(data);
      if (key === 'profile') setFullNameInput(data.fullName ?? '');
      else setSubdomainInput(data.tenant?.subdomain ?? '');
      setSavedKey(key);
      setDirty((d) => ({ ...d, [key]: false }));
      setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 2000);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Could not save your changes. Please try again.';
      setErrors((e) => ({ ...e, [key]: msg }));
    } finally {
      setSavingKey(null);
    }
  };

  const saveButtonStyle = (key: SectionKey): React.CSSProperties => {
    const isSaved = savedKey === key;
    const isDisabled = !dirty[key] && savingKey !== key;
    return {
      ...saveBtn,
      minWidth: '140px',
      background: isSaved ? c.successBg : saveBtn.background,
      color: isSaved ? c.successText : saveBtn.color,
      border: isSaved ? `1px solid ${c.successBorder}` : 'none',
      cursor: savingKey === key ? 'progress' : isDisabled ? 'not-allowed' : 'pointer',
      opacity: isDisabled ? 0.55 : 1,
    };
  };

  const saveButtonLabel = (key: SectionKey) =>
    savingKey === key ? 'Saving…' : savedKey === key ? 'Saved ✓' : 'Save changes';

  const errorText = (key: SectionKey) =>
    errors[key] ? (
      <span role="alert" style={{ fontSize: '0.82rem', color: c.dangerText, fontWeight: 600 }}>
        {errors[key]}
      </span>
    ) : null;

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
        Manage your account, studio and billing preferences.
      </p>

      {/* Profile */}
      <section style={section} aria-labelledby="settings-profile">
        <h2 id="settings-profile" style={{ fontSize: '1rem', fontWeight: 700, color: c.text, marginBottom: '4px' }}>
          Profile
        </h2>
        <p style={{ fontSize: '0.88rem', color: c.textMuted, marginBottom: '20px' }}>
          Your personal information and display name.
        </p>
        <div className="settings-profile-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="settings-fullname" style={label}>Full name</label>
            <input
              id="settings-fullname"
              value={fullNameInput}
              onChange={(e) => { setFullNameInput(e.target.value); markDirty('profile'); }}
              style={input}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="settings-email" style={label}>Email address</label>
            <input id="settings-email" defaultValue={user?.email ?? ''} style={input} readOnly />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '18px', flexWrap: 'wrap' }}>
          <button
            style={saveButtonStyle('profile')}
            onClick={() => handleSave('profile')}
            disabled={savingKey === 'profile' || !dirty.profile}
            aria-live="polite"
          >
            {saveButtonLabel('profile')}
          </button>
          {errorText('profile')}
        </div>
      </section>

      {/* Studio */}
      <section style={section} aria-labelledby="settings-studio">
        <h2 id="settings-studio" style={{ fontSize: '1rem', fontWeight: 700, color: c.text, marginBottom: '4px' }}>
          Studio
        </h2>
        <p style={{ fontSize: '0.88rem', color: c.textMuted, marginBottom: '20px' }}>
          Details visible to your clients in booking confirmations.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
          <label htmlFor="settings-subdomain" style={label}>Studio name / subdomain</label>
          <input
            id="settings-subdomain"
            value={subdomainInput}
            onChange={(e) => { setSubdomainInput(e.target.value); markDirty('studio'); }}
            style={input}
          />
          <span style={{ fontSize: '0.78rem', color: c.textMuted }}>
            Your public address: {(subdomainInput.trim() || 'your-studio').toLowerCase()}.fotolio.app
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '14px', flexWrap: 'wrap' }}>
          <button
            style={saveButtonStyle('studio')}
            onClick={() => handleSave('studio')}
            disabled={savingKey === 'studio' || !dirty.studio}
            aria-live="polite"
          >
            {saveButtonLabel('studio')}
          </button>
          {errorText('studio')}
        </div>
      </section>

      {/* Billing */}
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

      {/* Danger zone */}
      <section style={{ ...section, borderColor: c.dangerBorder }} aria-labelledby="settings-danger">
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
