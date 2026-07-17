'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { extractApiError, eurosToCents } from '@/lib/helpers';
import { useTranslation } from '@/lib/i18n';
import { Booking, Package } from '@/types/api';
import { getBookingsColors } from './bookings.styles';

type CreateModalProps = {
  styles: Record<string, React.CSSProperties>;
  colors: ReturnType<typeof getBookingsColors>;
  onClose: () => void;
  onCreated: (_booking: Booking) => void;
  // Pre-fills the event date — set when the modal is opened by clicking a
  // calendar day, so the photographer doesn't re-enter a date they just picked.
  initialDate?: string;
};

const EMPTY_FORM = {
  clientName: '',
  clientEmail: '',
  eventDate: '',
  eventTime: '',
  eventType: '',
  location: '',
  packageId: '',
  totalAmount: '',
  depositAmount: '',
  internalNotes: '',
};

export function CreateBookingModal({
  styles,
  colors,
  onClose,
  onCreated,
  initialDate,
}: CreateModalProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ ...EMPTY_FORM, eventDate: initialDate ?? '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [packages, setPackages] = useState<Package[]>([]);
  // Tracks whether the photographer has manually typed a total. Picking a
  // package auto-fills the total *only when they haven't overridden it*, so a
  // custom quote isn't silently overwritten when they re-pick a package.
  const [totalOverridden, setTotalOverridden] = useState(false);

  // Close on Escape — standard dialog affordance.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Load the active packages once when the modal mounts. We don't refetch on
  // open/close because the modal itself is mounted on demand — each open is a
  // fresh fetch.
  useEffect(() => {
    let cancelled = false;
    api
      .get<Package[]>('/api/packages', { params: { activeOnly: true } })
      .then(({ data }) => {
        if (!cancelled) setPackages(data);
      })
      .catch(() => {
        // A package-list fetch failure shouldn't block manual booking entry —
        // the photographer can still type a total. The picker just hides itself.
        if (!cancelled) setPackages([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function update(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function handlePackageChange(packageId: string) {
    const picked = packages.find((p) => p.id === packageId);
    setForm((prev) => ({
      ...prev,
      packageId,
      // Auto-fill the total from the picked package unless the photographer
      // has already typed something different — their explicit number wins.
      totalAmount:
        picked && !totalOverridden
          ? String(picked.priceCents / 100)
          : prev.totalAmount,
    }));
    setFieldErrors((prev) => {
      if (!prev.packageId) return prev;
      const next = { ...prev };
      delete next.packageId;
      return next;
    });
  }

  function handleTotalChange(value: string) {
    setTotalOverridden(true);
    update('totalAmount', value);
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!form.clientName.trim()) errors.clientName = t('createBooking.errName');
    if (!form.clientEmail.trim()) {
      errors.clientEmail = t('createBooking.errEmail');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.clientEmail.trim())) {
      errors.clientEmail = t('createBooking.errEmailInvalid');
    }
    if (!form.eventDate) errors.eventDate = t('createBooking.errDate');
    const total = eurosToCents(form.totalAmount);
    const deposit = eurosToCents(form.depositAmount);
    if (form.depositAmount.trim() && deposit > total) {
      errors.depositAmount = t('createBooking.errDeposit');
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
      // packageId: when omitted on the wire we must send `null`, not `""`.
      // The backend treats null as "no package" but would 404 on an empty
      // string trying to parse it as a UUID.
      //
      // totalAmountCents: when the photographer left it blank AND picked a
      // package, send `null` so the backend's auto-pricing kicks in and
      // resolves the price from the package. If they typed a number, send it
      // — explicit price always wins, matching the backend contract.
      const totalTyped = form.totalAmount.trim();
      const payload = {
        clientName: form.clientName.trim(),
        clientEmail: form.clientEmail.trim(),
        eventDate: form.eventDate,
        eventTime: form.eventTime || null,
        eventType: form.eventType.trim() || null,
        location: form.location.trim() || null,
        packageId: form.packageId || null,
        totalAmountCents: totalTyped ? eurosToCents(form.totalAmount) : null,
        depositAmountCents: eurosToCents(form.depositAmount),
        internalNotes: form.internalNotes.trim() || null,
      };
      const res = await api.post<Booking>('/api/bookings', payload);
      onCreated(res.data);
    } catch (err) {
      setSubmitError(extractApiError(err, t('createBooking.errSubmit')));
    } finally {
      setSubmitting(false);
    }
  }

  const fieldStyle = (field: keyof typeof EMPTY_FORM): React.CSSProperties => ({
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
        aria-label={t('createBooking.aria')}
      >
        <div style={styles.modalHeader}>
          <div style={{ minWidth: 0 }}>
            <div style={styles.modalTitle}>{t('createBooking.title')}</div>
            <div style={styles.modalSubtitle}>{t('createBooking.subtitle')}</div>
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

        <div style={styles.modalBody}>
          {submitError && (
            <div style={styles.actionError} role="alert">
              {submitError}
            </div>
          )}

          <div style={styles.formField}>
            <label style={styles.formLabel} htmlFor="bk-clientName">
              {t('createBooking.clientName')}
            </label>
            <input
              id="bk-clientName"
              type="text"
              value={form.clientName}
              onChange={(e) => update('clientName', e.target.value)}
              style={fieldStyle('clientName')}
              maxLength={200}
            />
            {fieldErrors.clientName && (
              <span style={styles.fieldError}>{fieldErrors.clientName}</span>
            )}
          </div>

          <div style={styles.formField}>
            <label style={styles.formLabel} htmlFor="bk-clientEmail">
              {t('createBooking.clientEmail')}
            </label>
            <input
              id="bk-clientEmail"
              type="email"
              value={form.clientEmail}
              onChange={(e) => update('clientEmail', e.target.value)}
              style={fieldStyle('clientEmail')}
              maxLength={320}
            />
            {fieldErrors.clientEmail && (
              <span style={styles.fieldError}>{fieldErrors.clientEmail}</span>
            )}
          </div>

          <div className="bk-form-row" style={styles.formRow}>
            <div style={styles.formField}>
              <label style={styles.formLabel} htmlFor="bk-eventDate">
                {t('createBooking.eventDate')}
              </label>
              <input
                id="bk-eventDate"
                type="date"
                value={form.eventDate}
                onChange={(e) => update('eventDate', e.target.value)}
                style={fieldStyle('eventDate')}
              />
              {fieldErrors.eventDate && (
                <span style={styles.fieldError}>{fieldErrors.eventDate}</span>
              )}
            </div>
            <div style={styles.formField}>
              <label style={styles.formLabel} htmlFor="bk-eventTime">
                {t('createBooking.eventTime')}
              </label>
              <input
                id="bk-eventTime"
                type="time"
                value={form.eventTime}
                onChange={(e) => update('eventTime', e.target.value)}
                style={styles.formInput}
              />
            </div>
          </div>

          <div className="bk-form-row" style={styles.formRow}>
            <div style={styles.formField}>
              <label style={styles.formLabel} htmlFor="bk-eventType">
                {t('createBooking.eventType')}
              </label>
              <input
                id="bk-eventType"
                type="text"
                value={form.eventType}
                onChange={(e) => update('eventType', e.target.value)}
                placeholder={t('createBooking.eventTypePlaceholder')}
                style={styles.formInput}
                maxLength={50}
              />
            </div>
            <div style={styles.formField}>
              <label style={styles.formLabel} htmlFor="bk-location">
                {t('createBooking.location')}
              </label>
              <input
                id="bk-location"
                type="text"
                value={form.location}
                onChange={(e) => update('location', e.target.value)}
                style={styles.formInput}
                maxLength={300}
              />
            </div>
          </div>

          {packages.length > 0 && (
            <div style={styles.formField}>
              <label style={styles.formLabel} htmlFor="bk-package">
                {t('createBooking.package')}
              </label>
              <select
                id="bk-package"
                value={form.packageId}
                onChange={(e) => handlePackageChange(e.target.value)}
                style={styles.formInput}
              >
                <option value="">{t('createBooking.noPackage')}</option>
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name} — €{(pkg.priceCents / 100).toFixed(0)}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: '0.78rem', color: colors.textMuted, marginTop: '4px' }}>
                {t('createBooking.packageHelp')}
              </span>
            </div>
          )}

          <div className="bk-form-row" style={styles.formRow}>
            <div style={styles.formField}>
              <label style={styles.formLabel} htmlFor="bk-total">
                {t('createBooking.total')}
              </label>
              <input
                id="bk-total"
                type="number"
                min="0"
                step="1"
                value={form.totalAmount}
                onChange={(e) => handleTotalChange(e.target.value)}
                style={styles.formInput}
              />
            </div>
            <div style={styles.formField}>
              <label style={styles.formLabel} htmlFor="bk-deposit">
                {t('createBooking.deposit')}
              </label>
              <input
                id="bk-deposit"
                type="number"
                min="0"
                step="1"
                value={form.depositAmount}
                onChange={(e) => update('depositAmount', e.target.value)}
                style={fieldStyle('depositAmount')}
              />
              {fieldErrors.depositAmount && (
                <span style={styles.fieldError}>{fieldErrors.depositAmount}</span>
              )}
            </div>
          </div>

          <div style={styles.formField}>
            <label style={styles.formLabel} htmlFor="bk-notes">
              {t('createBooking.notes')}
            </label>
            <textarea
              id="bk-notes"
              value={form.internalNotes}
              onChange={(e) => update('internalNotes', e.target.value)}
              style={styles.formTextarea}
              placeholder={t('createBooking.notesPlaceholder')}
            />
          </div>
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
            {submitting ? t('createBooking.submitting') : t('createBooking.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
