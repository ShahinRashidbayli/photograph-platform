'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { extractApiError, eurosToCents } from '@/lib/helpers';
import { Booking, Lead, Package } from '@/types/api';
import { EVENT_LABELS, type ColorTokens } from './leadTypes';

export function ConvertLeadModal({
  lead,
  c,
  onClose,
  onConverted,
}: Readonly<{
  lead: Lead;
  c: ColorTokens;
  onClose: () => void;
  onConverted: (_booking: Booking) => void;
}>) {
  const [eventTime, setEventTime] = useState('');
  const [location, setLocation] = useState('');
  const [packageId, setPackageId] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [packages, setPackages] = useState<Package[]>([]);
  const [totalOverridden, setTotalOverridden] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  // Close on Escape — matches the existing modal pattern across the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  // Load active packages so the photographer can auto-price the conversion.
  // Same fail-soft contract as the bookings modal: if the fetch fails the
  // picker just hides — manual price entry still works.
  useEffect(() => {
    let cancelled = false;
    api
      .get<Package[]>('/api/packages', { params: { activeOnly: true } })
      .then(({ data }) => {
        if (!cancelled) setPackages(data);
      })
      .catch(() => {
        if (!cancelled) setPackages([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePackageChange = (id: string) => {
    setPackageId(id);
    const picked = packages.find((p) => p.id === id);
    // Auto-fill the total unless the photographer typed something explicit —
    // their custom price wins, mirroring the backend contract.
    if (picked && !totalOverridden) {
      setTotalAmount(String(picked.priceCents / 100));
    }
  };

  const handleTotalChange = (value: string) => {
    setTotalOverridden(true);
    setTotalAmount(value);
    setFieldError(null);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitError(null);
    setFieldError(null);

    const totalTyped = totalAmount.trim();
    const depositTyped = depositAmount.trim();
    if (depositTyped) {
      const total = totalTyped ? eurosToCents(totalAmount) : 0;
      const deposit = eurosToCents(depositAmount);
      if (deposit > total) {
        setFieldError('Deposit cannot exceed the total.');
        return;
      }
    }

    // Same null-vs-empty contract as the bookings create form: the backend
    // expects null (not "") when a field is absent, and null on
    // totalAmountCents is what triggers auto-pricing from the package.
    const payload = {
      eventTime: eventTime || null,
      location: location.trim() || null,
      packageId: packageId || null,
      totalAmountCents: totalTyped ? eurosToCents(totalAmount) : null,
      depositAmountCents: depositTyped ? eurosToCents(depositAmount) : null,
      internalNotes: internalNotes.trim() || null,
    };

    setSubmitting(true);
    try {
      const res = await api.post<Booking>(`/api/leads/${lead.id}/convert`, payload);
      onConverted(res.data);
    } catch (err) {
      // 409 from the backend means the lead was already converted (idempotency
      // contract). Surface it plainly rather than the generic error.
      setSubmitError(
        extractApiError(err, 'Could not convert the lead. Please try again.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const formattedEventDate = new Date(lead.eventDate).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  // Styles ───────────────────────────────────────────────────────────────────
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
  const fieldGroup: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  };
  const label: React.CSSProperties = {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: c.textMuted,
    letterSpacing: '0.02em',
  };
  const input: React.CSSProperties = {
    padding: '9px 12px',
    border: `1px solid ${c.border}`,
    borderRadius: '8px',
    fontSize: '0.88rem',
    color: c.text,
    background: c.surfaceAlt,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };
  const row: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  };
  const readOnlyRow: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '110px 1fr',
    gap: '8px',
    padding: '6px 0',
    fontSize: '0.85rem',
    alignItems: 'baseline',
  };
  const closeBtn: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    fontSize: '1.4rem',
    color: c.textMuted,
    cursor: 'pointer',
    lineHeight: 1,
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
    minWidth: '160px',
  };

  return (
    <div
      style={overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Convert ${lead.name} to a booking`}
        style={card}
      >
        <div style={header}>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: c.text }}>
              Convert to booking
            </div>
            <div style={{ fontSize: '0.85rem', color: c.textMuted, marginTop: '4px' }}>
              The booking starts as an enquiry — you can advance it afterwards.
            </div>
          </div>
          <button
            type="button"
            style={closeBtn}
            onClick={() => !submitting && onClose()}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div style={body}>
          {/* Lead-derived fields, read-only. Changing these at conversion time
              would put the booking out of sync with the lead's audit trail —
              edit the resulting booking instead. */}
          <div
            style={{
              padding: '12px 14px',
              background: c.surfaceAlt,
              border: `1px solid ${c.borderSoft}`,
              borderRadius: '10px',
            }}
          >
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
              From this lead
            </div>
            <div style={readOnlyRow}>
              <span style={label}>Client</span>
              <span style={{ color: c.text }}>{lead.name}</span>
            </div>
            <div style={readOnlyRow}>
              <span style={label}>Email</span>
              <span style={{ color: c.text }}>{lead.email}</span>
            </div>
            <div style={readOnlyRow}>
              <span style={label}>Event date</span>
              <span style={{ color: c.text }}>{formattedEventDate}</span>
            </div>
            <div style={readOnlyRow}>
              <span style={label}>Event type</span>
              <span style={{ color: c.text }}>
                {EVENT_LABELS[lead.eventType] ?? lead.eventType}
              </span>
            </div>
          </div>

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

          <div style={row}>
            <div style={fieldGroup}>
              <label style={label} htmlFor="cv-time">Event time</label>
              <input
                id="cv-time"
                type="time"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
                style={input}
              />
            </div>
            <div style={fieldGroup}>
              <label style={label} htmlFor="cv-location">Location</label>
              <input
                id="cv-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                style={input}
                maxLength={300}
                placeholder="Standesamt Mitte"
              />
            </div>
          </div>

          {packages.length > 0 && (
            <div style={fieldGroup}>
              <label style={label} htmlFor="cv-package">Package</label>
              <select
                id="cv-package"
                value={packageId}
                onChange={(e) => handlePackageChange(e.target.value)}
                style={input}
              >
                <option value="">No package — custom price</option>
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name} — €{(pkg.priceCents / 100).toFixed(0)}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: '0.78rem', color: c.textMuted }}>
                Picking a package fills the total below. Override the total to use a custom price.
              </span>
            </div>
          )}

          <div style={row}>
            <div style={fieldGroup}>
              <label style={label} htmlFor="cv-total">Total (€)</label>
              <input
                id="cv-total"
                type="number"
                min="0"
                step="1"
                value={totalAmount}
                onChange={(e) => handleTotalChange(e.target.value)}
                style={input}
              />
            </div>
            <div style={fieldGroup}>
              <label style={label} htmlFor="cv-deposit">Deposit (€)</label>
              <input
                id="cv-deposit"
                type="number"
                min="0"
                step="1"
                value={depositAmount}
                onChange={(e) => {
                  setDepositAmount(e.target.value);
                  setFieldError(null);
                }}
                style={{
                  ...input,
                  ...(fieldError ? { borderColor: c.danger } : {}),
                }}
              />
              {fieldError && (
                <span style={{ fontSize: '0.78rem', color: c.dangerText }}>{fieldError}</span>
              )}
            </div>
          </div>

          <div style={fieldGroup}>
            <label style={label} htmlFor="cv-notes">Internal notes</label>
            <textarea
              id="cv-notes"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              style={{ ...input, minHeight: '80px', resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="Only visible to you."
            />
          </div>
        </div>

        <div style={footer}>
          <button type="button" style={ghostBtn} onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            style={primaryBtn}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Converting…' : 'Convert to booking'}
          </button>
        </div>
      </div>
    </div>
  );
}
