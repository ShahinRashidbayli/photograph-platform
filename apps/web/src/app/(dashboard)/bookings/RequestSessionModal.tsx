'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useCreateInquiryRequest } from '@/hooks/useInquiryRequests';
import { extractApiError, todayIso } from '@/lib/helpers';
import { useTranslation, type TranslationKey } from '@/lib/i18n';
import { useThemeStore } from '@/store/themeStore';
import { DateField } from '@/components/DateField';
import { Button } from '@/components/ui';
import { fontSize, radius } from '@/lib/design-tokens';
import { getBookingsColors, getBookingsStyles } from './bookings.styles';
import { BUDGET_RANGES } from './customer.portal';

type RequestSessionModalProps = {
  /** Where the photographer's answer goes — said in the footer so nobody wonders. */
  email: string | null;
  onClose: () => void;
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

/**
 * A bordered pill: an unselected choice in a form still has to look clickable,
 * which the list filters' borderless chips do not.
 */
function chip(colors: ReturnType<typeof getBookingsColors>, active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 36,
    padding: '0 14px',
    borderRadius: radius.pill,
    border: `1px solid ${active ? colors.primarySolid : colors.border}`,
    background: active ? colors.primarySolid : colors.surface,
    color: active ? colors.onPrimary : colors.text,
    fontFamily: 'inherit',
    fontSize: fontSize.md,
    cursor: 'pointer',
    ['--ui-btn-hover' as string]: colors.surfaceHover,
  };
}

export function RequestSessionModal({ email, onClose }: RequestSessionModalProps) {
  const { t, lang } = useTranslation();
  const { theme } = useThemeStore();
  const styles = useMemo(() => getBookingsStyles(theme), [theme]);
  const colors = useMemo(() => getBookingsColors(theme), [theme]);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const createRequest = useCreateInquiryRequest();
  const submitting = createRequest.isPending;
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

  function handleSubmit() {
    if (submitting) return;
    setSubmitError(null);
    if (!validate()) return;

    createRequest.mutate(
      {
        eventType: form.eventType,
        budgetRange: form.budgetRange,
        proposedDate: form.proposedDate,
        location: form.location.trim() || null,
        message: form.message.trim() || null,
        website: form.website, // honeypot
        // The studio's Customer messages follow the portal language at the time of
        // asking; switching it later does not update the request (v1).
        language: lang,
      },
      {
        onSuccess: () => setSent(true),
        onError: (err) => setSubmitError(extractApiError(err, t('requestSession.errSubmit'))),
      }
    );
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
            <div
              style={{ fontWeight: 600, fontSize: '1.05rem', color: colors.text, marginBottom: 6 }}
            >
              {t('requestSession.sentTitle')}
            </div>
            <p style={{ fontSize: '0.9rem', color: colors.textMuted, margin: 0 }}>
              {t('requestSession.sentBody')}
            </p>
            <div style={{ marginTop: 24 }}>
              <Button variant="primary" onClick={onClose}>
                {t('requestSession.done')}
              </Button>
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

              {/* Occasion — one tap each, like the budget below. */}
              <fieldset style={{ ...styles.formField, border: 0, margin: 0, padding: 0 }}>
                <legend style={{ ...styles.formLabel, padding: 0 }}>
                  {t('requestSession.sessionType')}
                </legend>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {EVENT_TYPES.map((type) => {
                    const active = form.eventType === type.value;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        className={active ? undefined : 'ui-press ui-btn-secondary'}
                        onClick={() => update('eventType', type.value)}
                        aria-pressed={active}
                        style={chip(colors, active)}
                      >
                        {t(type.labelKey)}
                      </button>
                    );
                  })}
                </div>
                {fieldErrors.eventType && (
                  <span style={styles.fieldError}>{fieldErrors.eventType}</span>
                )}
              </fieldset>

              {/* Budget range */}
              <fieldset style={{ ...styles.formField, border: 0, margin: 0, padding: 0 }}>
                <legend style={{ ...styles.formLabel, padding: 0 }}>
                  {t('requestSession.budget')}
                </legend>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {BUDGET_RANGES.map((b) => {
                    const active = form.budgetRange === b.value;
                    return (
                      <button
                        key={b.value}
                        type="button"
                        className={active ? undefined : 'ui-press ui-btn-secondary'}
                        onClick={() => update('budgetRange', b.value)}
                        aria-pressed={active}
                        style={chip(colors, active)}
                      >
                        {b.label}
                      </button>
                    );
                  })}
                </div>
                {fieldErrors.budgetRange && (
                  <span style={styles.fieldError}>{fieldErrors.budgetRange}</span>
                )}
              </fieldset>

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

            <div style={{ ...styles.modalFooter, alignItems: 'center', flexWrap: 'wrap' }}>
              {email && (
                <span
                  style={{ flex: '1 1 200px', fontSize: fontSize.base, color: colors.textSubtle }}
                >
                  {t('requestSession.reply', { email })}
                </span>
              )}
              <Button onClick={onClose} disabled={submitting}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                busy={submitting}
                busyLabel={t('requestSession.submitting')}
              >
                {t('requestSession.submit')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
