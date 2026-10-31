'use client';

import React, { useEffect, useState } from 'react';
import { Lead } from '@/types/api';
import { useCreateLead } from '@/hooks/useLeads';
import { extractApiError } from '@/lib/helpers';
import { useTranslation } from '@/lib/i18n';
import { DateField } from '@/components/DateField';
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
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventType, setEventType] = useState<Lead['eventType']>('WEDDING');
  const [budgetRange, setBudgetRange] = useState<Lead['budgetRange']>('200_500');
  const [message, setMessage] = useState('');
  const createLead = useCreateLead();
  const submitting = createLead.isPending;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<Record<string, string>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  const handleSubmit = () => {
    if (submitting) return;
    setSubmitError(null);

    // Client-side validation mirrors the backend's @NotBlank / @Email
    // constraints — surfacing them inline saves a round-trip and a generic
    // 400 error message.
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = t('addLead.errName');
    if (!email.trim()) {
      errors.email = t('addLead.errEmail');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = t('createBooking.errEmailInvalid');
    }
    if (!eventDate) errors.eventDate = t('createBooking.errDate');
    if (!message.trim()) errors.message = t('addLead.errMessage');
    setFieldError(errors);
    if (Object.keys(errors).length > 0) return;

    createLead.mutate(
      {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        eventDate,
        eventType,
        budgetRange,
        message: message.trim(),
      },
      {
        onSuccess: onCreated,
        onError: (err) => setSubmitError(extractApiError(err, t('addLead.errSubmit'))),
      }
    );
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
    background: c.primarySolid,
    color: '#fff',
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
      <div role="dialog" aria-modal="true" aria-label={t('addLead.aria')} style={card}>
        <div style={header}>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: c.text }}>
              {t('addLead.title')}
            </div>
            <div style={{ fontSize: '0.85rem', color: c.textMuted, marginTop: '4px' }}>
              {t('addLead.subtitle')}
            </div>
          </div>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            aria-label={t('common.close')}
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
            <label style={label} htmlFor="al-name">
              {t('addLead.name')}
            </label>
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
              <label style={label} htmlFor="al-email">
                {t('addLead.email')}
              </label>
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
              <label style={label} htmlFor="al-phone">
                {t('addLead.phone')}
              </label>
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
              <label style={label} htmlFor="al-date">
                {t('addLead.eventDate')}
              </label>
              <DateField
                id="al-date"
                value={eventDate}
                onChange={setEventDate}
                invalid={!!fieldError.eventDate}
                style={input(!!fieldError.eventDate)}
              />
              {fieldError.eventDate && (
                <span style={{ fontSize: '0.78rem', color: c.dangerText }}>
                  {fieldError.eventDate}
                </span>
              )}
            </div>
            <div style={fieldGroup}>
              <label style={label} htmlFor="al-type">
                {t('addLead.eventType')}
              </label>
              <select
                id="al-type"
                value={eventType}
                onChange={(e) => setEventType(e.target.value as Lead['eventType'])}
                style={input(false)}
              >
                <option value="WEDDING">{t('leadEvent.WEDDING')}</option>
                <option value="ENGAGEMENT">{t('leadEvent.ENGAGEMENT')}</option>
                <option value="PORTRAIT">{t('leadEvent.PORTRAIT')}</option>
                <option value="FAMILY">{t('leadEvent.FAMILY')}</option>
                <option value="NEWBORN">{t('leadEvent.NEWBORN')}</option>
                <option value="CORPORATE">{t('leadEvent.CORPORATE')}</option>
              </select>
            </div>
          </div>

          <div style={fieldGroup}>
            <label style={label} htmlFor="al-budget">
              {t('addLead.budget')}
            </label>
            <select
              id="al-budget"
              value={budgetRange}
              onChange={(e) => setBudgetRange(e.target.value as Lead['budgetRange'])}
              style={input(false)}
            >
              <option value="UNDER_200">{t('addLead.budget.UNDER_200')}</option>
              <option value="200_500">{t('addLead.budget.200_500')}</option>
              <option value="500_1000">{t('addLead.budget.500_1000')}</option>
              <option value="OVER_1000">{t('addLead.budget.OVER_1000')}</option>
            </select>
          </div>

          <div style={fieldGroup}>
            <label style={label} htmlFor="al-msg">
              {t('addLead.message')}
            </label>
            <textarea
              id="al-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{
                ...input(!!fieldError.message),
                minHeight: '90px',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
              placeholder={t('addLead.messagePlaceholder')}
            />
            {fieldError.message && (
              <span style={{ fontSize: '0.78rem', color: c.dangerText }}>{fieldError.message}</span>
            )}
          </div>
        </div>

        <div style={footer}>
          <button type="button" style={ghostBtn} onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </button>
          <button type="button" style={primaryBtn} onClick={handleSubmit} disabled={submitting}>
            {submitting ? t('common.saving') : t('addLead.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
