"use client";

import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import React from 'react';

const s: Record<string, React.CSSProperties> = {
  main: {
    padding: '32px 28px',
    maxWidth: '860px',
    margin: '0 auto',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  pageTitle: {
    fontSize: '1.6rem',
    fontWeight: 800,
    color: '#111827',
    marginBottom: '6px',
  },
  pageSubtitle: {
    fontSize: '0.95rem',
    color: '#6B7280',
    marginBottom: '32px',
  },
  section: {
    background: '#fff',
    border: '1px solid #E5E7EB',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '20px',
    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)',
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '4px',
  },
  sectionDesc: {
    fontSize: '0.88rem',
    color: '#9CA3AF',
    marginBottom: '20px',
  },
  fieldRow: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    marginBottom: '18px',
  },
  label: {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: '#374151',
    letterSpacing: '0.02em',
  },
  input: {
    padding: '10px 14px',
    border: '1px solid #D1D5DB',
    borderRadius: '10px',
    fontSize: '0.92rem',
    color: '#111827',
    background: '#F9FAFB',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  saveBtn: {
    padding: '10px 24px',
    background: '#111827',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  divider: {
    height: '1px',
    background: '#F3F4F6',
    margin: '20px 0',
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  planBadge: {
    display: 'inline-flex',
    padding: '4px 12px',
    borderRadius: '999px',
    background: '#E0F2FE',
    color: '#0369A1',
    fontSize: '0.8rem',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  },
  upgradeBtn: {
    padding: '9px 20px',
    background: '#fff',
    color: '#111827',
    border: '1.5px solid #D1D5DB',
    borderRadius: '10px',
    fontSize: '0.88rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
};

export default function SettingsPage() {
  const user = useAuthStore(st => st.user);
  const { theme } = useThemeStore();

  const themeColors = {
    light: { bg: '#F9FAFB', cardBg: '#FFFFFF', text: '#111827', subText: '#6B7280', border: '#E5E7EB', hover: '#F3F4F6' },
    dark: { bg: '#111827', cardBg: '#1F2937', text: '#F3F4F6', subText: '#D1D5DB', border: '#374151', hover: '#374151' },
  };
  const colors = themeColors[theme];

  return (
    <div style={{ ...s.main, background: colors.bg, color: colors.text, transition: 'background 0.3s ease, color 0.3s ease' }}>
      <div style={{ ...s.pageTitle, color: colors.text }}>Settings</div>
      <div style={{ ...s.pageSubtitle, color: colors.subText }}>Manage your account, studio and billing preferences.</div>

      {/* Profile */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Profile</div>
        <div style={s.sectionDesc}>Your personal information and display name.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={s.fieldRow}>
            <label style={s.label}>Full name</label>
            <input defaultValue={user?.fullName ?? ''} style={s.input} />
          </div>
          <div style={s.fieldRow}>
            <label style={s.label}>Email address</label>
            <input defaultValue={user?.email ?? ''} style={s.input} readOnly />
          </div>
        </div>
        <button style={s.saveBtn}>Save changes</button>
      </div>

      {/* Studio */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Studio</div>
        <div style={s.sectionDesc}>Details visible to your clients in booking confirmations.</div>
        <div style={s.fieldRow}>
          <label style={s.label}>Studio name / subdomain</label>
          <input defaultValue={user?.tenant?.subdomain ?? ''} style={s.input} />
        </div>
        <button style={s.saveBtn}>Save changes</button>
      </div>

      {/* Billing */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Plan &amp; Billing</div>
        <div style={s.sectionDesc}>Your current subscription and payment settings.</div>
        <div style={s.badgeRow}>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>Current plan</div>
            <span style={s.planBadge}>{user?.tenant?.plan ?? 'Starter'}</span>
          </div>
          <button style={s.upgradeBtn}>Upgrade plan</button>
        </div>
        <div style={s.divider} />
        <div style={{ fontSize: '0.88rem', color: '#9CA3AF' }}>Billing history and invoice management coming soon.</div>
      </div>

      {/* Danger zone */}
      <div style={{ ...s.section, borderColor: '#FEE2E2' }}>
        <div style={{ ...s.sectionTitle, color: '#DC2626' }}>Danger zone</div>
        <div style={s.sectionDesc}>Irreversible actions. Please proceed with caution.</div>
        <button style={{ padding: '9px 20px', background: '#fff', color: '#DC2626', border: '1.5px solid #FECACA', borderRadius: '10px', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer' }}>
          Delete account
        </button>
      </div>
    </div>
  );
}
