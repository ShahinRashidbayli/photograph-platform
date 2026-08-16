'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { extractApiError, todayIso } from '@/lib/helpers';
import { useTranslation, type TranslationKey } from '@/lib/i18n';
import { DateField } from '@/components/DateField';
import { getBookingsColors } from './bookings.styles';

type RequestSessionModalProps = {
  styles: Record<string, React.CSSProperties>;
  colors: ReturnType<typeof getBookingsColors>;
  onClose: () => void;
  // Fired after a request is accepted by the backend, so the page can refresh
  // the list (once the list surfaces pending requests).
  onSubmitted: () => void;
};

// Roadmap §4.5.4 — the request form the client fills after logging in. Labels
// are shown to the client; the value is the enum the backend persists on
// InquiryRequest (event_type / budget_range).
const EVENT_TYPES: ReadonlyArray<{ value: string; labelKey: TranslationKey }> = [
  { value: 'HOCHZEIT', labelKey: 'requestSession.type.HOCHZEIT' },
  { value: 'PORTRAIT', labelKey: 'requestSession.type.PORTRAIT' },
  { value: 'FAMILIE', labelKey: 'requestSession.type.FAMILIE' },
  { value: 'EVENT', labelKey: 'requestSession.type.EVENT' },
  { value: 'ANDERES', labelKey: 'requestSession.type.ANDERES' },
];

const BUDGET_RANGES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'UNDER_500', label: '€200–500' },
  { value: '500_1000', label: '€500–1000' },
  { value: '1000_2000', label: '€1000–2000' },
  { value: 'OVER_2000', label: '€2000+' },
];

const EMPTY_FORM = {
  eventType: '',
  budgetRange: '',
  proposedDate: '',
  location: '',
  message: '',
  // Honeypot — must stay empty. A bot that auto-fills every field trips this
  // and the backend rejects the request.
  website: '',
};

export function RequestSessionModal({
  styles,
  colors,
  onClose,
  onSubmitted,
}: RequestSessionModalProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  // Close on Escape — standard dialog affordance.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function update(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!form.eventType) errors.eventType = t('requestSession.errType');
    if (!form.budgetRange) errors.budgetRange = t('requestSession.errBudget');
    if (!form.proposedDate) {
      errors.proposedDate = t('requestSession.errDate');
    } else if (form.proposedDate < todayIso()) {
      // The backend already refuses this (@FutureOrPresent on
      // CreateInquiryRequest.proposedDate); saying so here saves the round-trip
      // and points at the field instead of showing a form-level error.
      errors.proposedDate = t('requestSession.errDatePast');
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit() {
    if (submitting) return;
    setSubmitError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      // The photographer (tenant) is resolved from the client's own session on
      // the backend — no subdomain is sent. Endpoint contract:
      // POST /api/customer/inquiry-requests (authenticated, CUSTOMER role).
      const payload = {
        eventType: form.eventType,
        budgetRange: form.budgetRange,
        proposedDate: form.proposedDate,
        location: form.location.trim() || null,
        message: form.message.trim() || null,
        website: form.website, // honeypot
      };
      await api.post('/api/customer/inquiry-requests', payload);
      setSent(true);
      onSubmitted();
    } catch (err) {
      setSubmitError(extractApiError(err, t('requestSession.errSubmit')));
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = (field: keyof typeof EMPTY_FORM): React.CSSProperties => ({
    ...styles.formInput,
    ...(fieldErrors[field] ? { borderColor: colors.danger } : {}),
  });

  return (
    <div
      style={styles.modalOverlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={styles.modalCard}
        role="dialog"
        aria-modal="true"
        aria-label={t('requestSession.aria')}
      >
        <div style={styles.modalHeader}>
          <div style={{ minWidth: 0 }}>
            <div style={styles.modalTitle}>{t('requestSession.title')}</div>
            <div style={styles.modalSubtitle}>{t('requestSession.subtitle')}</div>
          </div>
          <button
            type="button"
            style={styles.modalClose}
            onClick={onClose}
            aria-label={t('common.close')}
          >
            ×
          </button>
        </div>

        {sent ? (
          <div style={{ ...styles.modalBody, textAlign: 'center', padding: '40px 24px' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: colors.successBg,
                color: colors.successText,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                margin: '0 auto 16px',
              }}
              aria-hidden
            >
              ✓
            </div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: colors.text, marginBottom: 6 }}>
              {t('requestSession.sentTitle')}
            </div>
            <p style={{ fontSize: '0.9rem', color: colors.textMuted, margin: 0 }}>
              {t('requestSession.sentBody')}
            </p>
            <div style={{ marginTop: 24 }}>
              <button type="button" style={styles.primaryButton} onClick={onClose}>
                {t('requestSession.done')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={styles.modalBody}>
              {submitError && (
                <div style={styles.actionError} role="alert">
                  {submitError}
                </div>
              )}

              {/* Session type */}
              <div style={styles.formField}>
                <label style={styles.formLabel} htmlFor="rq-eventType">
                  {t('requestSession.sessionType')}
                </label>
                <select
                  id="rq-eventType"
                  value={form.eventType}
                  onChange={(e) => update('eventType', e.target.value)}
                  style={inputStyle('eventType')}
                >
                  <option value="">{t('requestSession.choose')}</option>
                  {EVENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {t(type.labelKey)}
                    </option>
                  ))}
                </select>
                {fieldErrors.eventType && (
                  <span style={styles.fieldError}>{fieldErrors.eventType}</span>
                )}
              </div>

              {/* Budget range — chip selection */}
              <div style={styles.formField}>
                <label style={styles.formLabel}>{t('requestSession.budget')}</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {BUDGET_RANGES.map((b) => {
                    const active = form.budgetRange === b.value;
                    // Shared chip styling, so a selected budget reads exactly
                    // like any other selected pill in the product.
                    return (
                      <button
                        key={b.value}
                        type="button"
                        onClick={() => update('budgetRange', b.value)}
                        aria-pressed={active}
                        style={{
                          ...styles.chip,
                          ...(active ? styles.chipActive : {}),
                        }}
                      >
                        {b.label}
                      </button>
                    );
                  })}
                </div>
                {fieldErrors.budgetRange && (
                  <span style={styles.fieldError}>{fieldErrors.budgetRange}</span>
                )}
              </div>

              <div className="bk-form-row" style={styles.formRow}>
                <div style={styles.formField}>
                  <label style={styles.formLabel} htmlFor="rq-date">
                    {t('requestSession.preferredDate')}
                  </label>
                  <DateField
                    id="rq-date"
                    value={form.proposedDate}
                    onChange={(iso) => update('proposedDate', iso)}
                    min={todayIso()}
                    invalid={!!fieldErrors.proposedDate}
                    style={inputStyle('proposedDate')}
                  />
                  {fieldErrors.proposedDate && (
                    <span style={styles.fieldError}>{fieldErrors.proposedDate}</span>
                  )}
                </div>
                <div style={styles.formField}>
                  <label style={styles.formLabel} htmlFor="rq-location">
                    {t('requestSession.location')}
                  </label>
                  <input
                    id="rq-location"
                    type="text"
                    value={form.location}
                    onChange={(e) => update('location', e.target.value)}
                    placeholder={t('requestSession.locationPlaceholder')}
                    style={styles.formInput}
                    maxLength={200}
                  />
                </div>
              </div>

              <div style={styles.formField}>
                <label style={styles.formLabel} htmlFor="rq-message">
                  {t('requestSession.message')}
                </label>
                <textarea
                  id="rq-message"
                  value={form.message}
                  onChange={(e) => update('message', e.target.value)}
                  style={styles.formTextarea}
                  placeholder={t('requestSession.messagePlaceholder')}
                  maxLength={2000}
                />
              </div>

              {/* Honeypot — visually hidden, off the tab order. */}
              <input
                type="text"
                name="website"
                value={form.website}
                onChange={(e) => update('website', e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
              />
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={onClose}
                disabled={submitting}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                style={{
                  ...styles.primaryButton,
                  ...(submitting ? { opacity: 0.6, cursor: 'wait' } : {}),
                }}
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? t('requestSession.submitting') : t('requestSession.submit')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
