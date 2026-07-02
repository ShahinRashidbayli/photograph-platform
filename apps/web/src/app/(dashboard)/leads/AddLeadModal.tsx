'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Lead } from '@/types/api';
import type { ColorTokens } from './leadTypes';

/**
 * Manual lead entry — for enquiries that arrived off-platform (phone,
 * WhatsApp, walk-in). Posts to {@code POST /api/leads} which is the
 * photographer-authenticated path; the public form lives elsewhere
 * (POST /api/public/leads/{subdomain}) and includes honeypot + IP rate-limit
 * we deliberately skip here.
 *
 * <p>Mirrors the field set of the public {@code CreateLeadRequest}: name,
 * email, phone (optional), event date, event type, budget range, message.
 * No internalNotes field — that's a photographer-curated annotation on an
 * existing lead, not part of the enquiry payload itself.
 */
export function AddLeadModal({
  c,
  onClose,
  onCreated,
}: Readonly<{
  c: ColorTokens;
  onClose: () => void;
  onCreated: (_lead: Lead) => void;
}>) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventType, setEventType] = useState<Lead['eventType']>('WEDDING');
  const [budgetRange, setBudgetRange] = useState<Lead['budgetRange']>('200_500');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<Record<string, string>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitError(null);

    // Client-side validation mirrors the backend's @NotBlank / @Email
    // constraints — surfacing them inline saves a round-trip and a generic
    // 400 error message.
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'Name is required.';
    if (!email.trim()) {
      errors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Enter a valid email address.';
    }
    if (!eventDate) errors.eventDate = 'Event date is required.';
    if (!message.trim()) errors.message = 'Add a short note about the enquiry.';
    setFieldError(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await api.post<Lead>('/api/leads', {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        eventDate,
        eventType,
        budgetRange,
        message: message.trim(),
      });
      onCreated(res.data);
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      setSubmitError(message ?? 'Could not save the lead. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Shared inline styles ─────────────────────────────────────────────────────
  const overlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 100,
    background: 'rgba(15, 23, 42, 0.55)',
    backdropFilter: 'blur(2px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  };
  const card: React.CSSProperties = {
    width: '100%',
    maxWidth: '560px',
    maxHeight: '90vh',
    overflow: 'auto',
    background: c.surface,
    borderRadius: '14px',
    border: `1px solid ${c.border}`,
    boxShadow: c.elevatedShadow,
    display: 'flex',
    flexDirection: 'column',
  };
  const header: React.CSSProperties = {
    padding: '20px 24px 12px',
    borderBottom: `1px solid ${c.divider}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
  };
  const body: React.CSSProperties = {
    padding: '16px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  };
  const footer: React.CSSProperties = {
    padding: '16px 24px',
    borderTop: `1px solid ${c.divider}`,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
  };
  const label: React.CSSProperties = {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: c.textMuted,
    letterSpacing: '0.02em',
  };
  const input = (hasError?: boolean): React.CSSProperties => ({
    padding: '9px 12px',
    border: `1px solid ${hasError ? c.danger : c.border}`,
    borderRadius: '8px',
    fontSize: '0.88rem',
    color: c.text,
    background: c.surfaceAlt,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  });
  const fieldGroup: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  };
  const row: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  };
  const ghostBtn: React.CSSProperties = {
    padding: '9px 16px',
    background: 'transparent',
    color: c.text,
    border: `1px solid ${c.border}`,
    borderRadius: '8px',
    fontSize: '0.88rem',
    fontWeight: 600,
    cursor: submitting ? 'not-allowed' : 'pointer',
  };
  const primaryBtn: React.CSSProperties = {
    padding: '9px 18px',
    background: c.isDark ? '#F1F5F9' : '#0F172A',
    color: c.isDark ? '#0F172A' : '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.88rem',
    fontWeight: 600,
    cursor: submitting ? 'wait' : 'pointer',
    opacity: submitting ? 0.7 : 1,
    minWidth: '140px',
  };

  return (
    <div
      style={overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Add a new lead" style={card}>
        <div style={header}>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: c.text }}>
              New lead
            </div>
            <div style={{ fontSize: '0.85rem', color: c.textMuted, marginTop: '4px' }}>
              Add an enquiry that came in off-platform (phone, WhatsApp, walk-in).
            </div>
          </div>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.4rem',
              color: c.textMuted,
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={body}>
          {submitError && (
            <div
              role="alert"
              style={{
                padding: '10px 12px',
                background: c.dangerBg,
                color: c.dangerText,
                border: `1px solid ${c.dangerBorder}`,
                borderRadius: '8px',
                fontSize: '0.85rem',
              }}
            >
              {submitError}
            </div>
          )}

          <div style={fieldGroup}>
            <label style={label} htmlFor="al-name">Client name *</label>
            <input
              id="al-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={input(!!fieldError.name)}
              maxLength={200}
            />
            {fieldError.name && (
              <span style={{ fontSize: '0.78rem', color: c.dangerText }}>{fieldError.name}</span>
            )}
          </div>

          <div style={row}>
            <div style={fieldGroup}>
              <label style={label} htmlFor="al-email">Email *</label>
              <input
                id="al-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={input(!!fieldError.email)}
                maxLength={320}
              />
              {fieldError.email && (
                <span style={{ fontSize: '0.78rem', color: c.dangerText }}>{fieldError.email}</span>
              )}
            </div>
            <div style={fieldGroup}>
              <label style={label} htmlFor="al-phone">Phone</label>
              <input
                id="al-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={input(false)}
                placeholder="+49 ..."
                maxLength={30}
              />
            </div>
          </div>

          <div style={row}>
            <div style={fieldGroup}>
              <label style={label} htmlFor="al-date">Event date *</label>
              <input
                id="al-date"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                style={input(!!fieldError.eventDate)}
              />
              {fieldError.eventDate && (
                <span style={{ fontSize: '0.78rem', color: c.dangerText }}>{fieldError.eventDate}</span>
              )}
            </div>
            <div style={fieldGroup}>
              <label style={label} htmlFor="al-type">Event type</label>
              <select
                id="al-type"
                value={eventType}
                onChange={(e) => setEventType(e.target.value as Lead['eventType'])}
                style={input(false)}
              >
                <option value="WEDDING">Wedding</option>
                <option value="ENGAGEMENT">Engagement</option>
                <option value="PORTRAIT">Portrait</option>
                <option value="FAMILY">Family</option>
                <option value="NEWBORN">Newborn</option>
                <option value="CORPORATE">Corporate</option>
              </select>
            </div>
          </div>

          <div style={fieldGroup}>
            <label style={label} htmlFor="al-budget">Budget range</label>
            <select
              id="al-budget"
              value={budgetRange}
              onChange={(e) => setBudgetRange(e.target.value as Lead['budgetRange'])}
              style={input(false)}
            >
              <option value="UNDER_200">Under €200</option>
              <option value="200_500">€200–500</option>
              <option value="500_1000">€500–1,000</option>
              <option value="OVER_1000">Over €1,000</option>
            </select>
          </div>

          <div style={fieldGroup}>
            <label style={label} htmlFor="al-msg">Notes / message *</label>
            <textarea
              id="al-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{ ...input(!!fieldError.message), minHeight: '90px', resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="What did the client ask for?"
            />
            {fieldError.message && (
              <span style={{ fontSize: '0.78rem', color: c.dangerText }}>{fieldError.message}</span>
            )}
          </div>
        </div>

        <div style={footer}>
          <button type="button" style={ghostBtn} onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="button" style={primaryBtn} onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save lead'}
          </button>
        </div>
      </div>
    </div>
  );
}
