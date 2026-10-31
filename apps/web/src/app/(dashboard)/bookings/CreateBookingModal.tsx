'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useBookingConflicts, useSaveBooking } from '@/hooks/useBookings';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePackages } from '@/hooks/usePackages';
import { useResources } from '@/hooks/useResources';
import { useTeam } from '@/hooks/useTeam';
import { extractApiError, eurosToCents, resolveTotalCents, todayIso } from '@/lib/helpers';
import { useTranslation } from '@/lib/i18n';
import { DateField } from '@/components/DateField';
import { Booking } from '@/types/api';
import { getBookingsColors } from './bookings.styles';

type CreateModalProps = {
  styles: Record<string, React.CSSProperties>;
  colors: ReturnType<typeof getBookingsColors>;
  onClose: () => void;
  onCreated: (_booking: Booking) => void;
  // Pre-fills the event date — set when the modal is opened by clicking a
  // calendar day, so the photographer doesn't re-enter a date they just picked.
  initialDate?: string;
  // When set, the modal edits this existing booking (PATCH) instead of creating
  // a new one (POST). This is the path that lets a photographer price a booking
  // created from an accepted inquiry, which starts with no amounts.
  booking?: Booking;
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
  assignedUserId: '',
};

const centsToInput = (cents?: number | null): string =>
  cents && cents > 0 ? String(cents / 100) : '';

function formForBooking(booking: Booking): typeof EMPTY_FORM {
  return {
    clientName: booking.clientName ?? '',
    clientEmail: booking.clientEmail ?? '',
    eventDate: booking.eventDate ?? '',
    // <input type="time"> wants HH:MM; the API may send HH:MM:SS.
    eventTime: (booking.eventTime ?? '').slice(0, 5),
    eventType: booking.eventType ?? '',
    location: booking.location ?? '',
    packageId: booking.packageId ?? '',
    assignedUserId: booking.assignedUserId ?? '',
    totalAmount: centsToInput(booking.totalAmountCents),
    depositAmount: centsToInput(booking.depositAmountCents),
    internalNotes: booking.internalNotes ?? '',
  };
}

export function CreateBookingModal({
  styles,
  colors,
  onClose,
  onCreated,
  initialDate,
  booking,
}: CreateModalProps) {
  const { t } = useTranslation();
  const isEdit = !!booking;
  const [form, setForm] = useState(
    booking ? formForBooking(booking) : { ...EMPTY_FORM, eventDate: initialDate ?? '' }
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const saveBooking = useSaveBooking();
  const submitting = saveBooking.isPending;
  // Each of these is best-effort: a failure loses an optional picker, not the
  // form. A missing package list means typing the total by hand; a missing
  // team means leaving the booking unassigned, which can be set later.
  const packages = usePackages({ activeOnly: true }).data ?? [];
  // The studio's photographers, for the assignment picker. Read from the team
  // endpoint every colleague may already call — a booking form does not need a
  // second, narrower list of the same people.
  const staff = useTeam().data?.members ?? [];
  // Rooms and kit — active only (see useResources).
  const resources = useResources().data ?? [];
  const [selectedResources, setSelectedResources] = useState<string[]>(booking?.resourceIds ?? []);
  // Tracks whether the photographer has manually typed a total. Picking a
  // package auto-fills the total *only when they haven't overridden it*, so a
  // custom quote isn't silently overwritten when they re-pick a package. In edit
  // mode we start "overridden" so the existing total is never clobbered by a
  // package that happens to already be linked.
  const [totalOverridden, setTotalOverridden] = useState(isEdit);

  // Close on Escape — standard dialog affordance.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /**
   * Asks whether the chosen photographer is already working that day.
   *
   * <p>Debounced, because the date field changes on every keystroke. The
   * result never blocks the save: it is rendered as a warning above the
   * buttons and the photographer decides. Two shoots in a day is normal work.
   */
  const conflictQuery = useMemo(
    () =>
      form.eventDate && (form.assignedUserId || selectedResources.length > 0)
        ? {
            eventDate: form.eventDate,
            assignedUserId: form.assignedUserId || null,
            resourceIds: selectedResources,
            excludeBookingId: booking?.id,
          }
        : null,
    [form.eventDate, form.assignedUserId, selectedResources, booking?.id]
  );
  const debouncedConflictQuery = useDebouncedValue(conflictQuery, 300);
  const conflictAnswer = useBookingConflicts(debouncedConflictQuery).data;
  // Cleared at once rather than after the debounce: with no date, or no one
  // and nothing to clash, there is nothing left to warn about.
  const conflicts = conflictQuery ? (conflictAnswer?.conflicts ?? []) : [];
  const resourceClashes = conflictQuery ? (conflictAnswer?.resourceClashes ?? []) : [];

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
      totalAmount: picked && !totalOverridden ? String(picked.priceCents / 100) : prev.totalAmount,
    }));
    setFieldErrors((prev) => {
      if (!prev.packageId) return prev;
      const next = { ...prev };
      delete next.packageId;
      return next;
    });
  }

  function handleTotalChange(value: string) {
    // Empty is not an override — it means "let the package price it", which is
    // the not-overridden state. Latching on '' left auto-fill permanently off,
    // so picking a different package no longer updated the total. (In edit
    // mode the flag starts true: an existing booking already has its own
    // stored price and must not be silently re-priced.)
    setTotalOverridden(isEdit || value.trim() !== '');
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
    if (!form.eventDate) {
      errors.eventDate = t('createBooking.errDate');
    } else if (!isEdit && form.eventDate < todayIso()) {
      // Creation only. An existing booking whose date has passed still has to
      // be editable (pricing it, fixing the location, adding notes), so the
      // rule never applies in edit mode — matching the backend, where
      // @FutureOrPresent sits on CreateBookingRequest and not on the update.
      errors.eventDate = t('createBooking.errDatePast');
    }
    // Compare against the total the *server* will resolve, not just what's
    // typed: a blank total with a package linked means "price it from the
    // package", and treating that as 0 rejected every deposit.
    const total = resolveTotalCents(form.totalAmount, form.packageId, packages);
    const deposit = eurosToCents(form.depositAmount);
    if (form.depositAmount.trim() && deposit > total) {
      errors.depositAmount = t('createBooking.errDeposit');
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleSubmit() {
    if (submitting) return;
    setSubmitError(null);
    if (!validate()) return;

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
      // Empty means unassigned, which the API stores as null rather than
      // rejecting — a booking without a photographer is a normal state.
      assignedUserId: form.assignedUserId || null,
      // Always sent, so clearing the last one is possible — the API reads an
      // empty list as "none" and an absent field as "leave them".
      resourceIds: selectedResources,
    };
    saveBooking.mutate(
      { id: booking?.id, payload },
      {
        onSuccess: onCreated,
        onError: (err) => setSubmitError(extractApiError(err, t('createBooking.errSubmit'))),
      }
    );
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
        aria-label={isEdit ? t('editBooking.aria') : t('createBooking.aria')}
      >
        <div style={styles.modalHeader}>
          <div style={{ minWidth: 0 }}>
            <div style={styles.modalTitle}>
              {isEdit ? t('editBooking.title') : t('createBooking.title')}
            </div>
            <div style={styles.modalSubtitle}>
              {isEdit ? t('editBooking.subtitle') : t('createBooking.subtitle')}
            </div>
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
              <DateField
                id="bk-eventDate"
                value={form.eventDate}
                onChange={(iso) => update('eventDate', iso)}
                // Disables past days in the picker when creating. Left open in
                // edit mode so an existing past booking stays editable.
                min={isEdit ? undefined : todayIso()}
                invalid={!!fieldErrors.eventDate}
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

          {/* Only offered once there is somebody to choose between. A studio
              of one has nothing to assign — the work is theirs by definition. */}
          {staff.length > 1 && (
            <div style={styles.formField}>
              <label style={styles.formLabel} htmlFor="bk-assignee">
                {t('createBooking.assignee')}
              </label>
              <select
                id="bk-assignee"
                value={form.assignedUserId}
                onChange={(e) => setForm((prev) => ({ ...prev, assignedUserId: e.target.value }))}
                style={styles.formInput}
              >
                <option value="">{t('createBooking.unassigned')}</option>
                {staff.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName || m.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Checkboxes rather than a multi-select: a shoot uses two or three
              things and a native multi-select hides that behind a scroll and a
              modifier key most people do not know. */}
          {resources.length > 0 && (
            <div style={styles.formField}>
              <span style={styles.formLabel}>{t('createBooking.resources')}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: 4 }}>
                {resources.map((r) => (
                  <label
                    key={r.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: '0.88rem',
                      color: colors.text,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedResources.includes(r.id)}
                      onChange={(e) =>
                        setSelectedResources((prev) =>
                          e.target.checked ? [...prev, r.id] : prev.filter((id) => id !== r.id)
                        )
                      }
                    />
                    {r.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Named one by one: "the studio is taken" and "the lighting kit is
              taken" are different decisions. Like the photographer clash, it
              warns and never blocks. */}
          {resourceClashes.length > 0 && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: colors.warningBg,
                color: colors.warningText,
                fontSize: '0.85rem',
                lineHeight: 1.5,
              }}
              role="status"
            >
              {t('createBooking.resourceConflictWarning')}
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {resourceClashes.map((rc, i) => (
                  <li key={`${rc.resourceName}-${i}`}>
                    <strong>{rc.resourceName}</strong> · {rc.clientName}
                    {rc.eventTime ? ` · ${rc.eventTime.slice(0, 5)}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* A warning, never a block: two shoots in one day is ordinary work,
              and sometimes an overlap is deliberate. The times are shown so the
              photographer can judge rather than be told. */}
          {conflicts.length > 0 && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: colors.warningBg,
                color: colors.warningText,
                fontSize: '0.85rem',
                lineHeight: 1.5,
              }}
              role="status"
            >
              {t('createBooking.conflictWarning')}
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {conflicts.map((cf) => (
                  <li key={cf.id}>
                    {cf.clientName}
                    {cf.eventTime ? ` · ${cf.eventTime.slice(0, 5)}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

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
            {submitting
              ? t(isEdit ? 'editBooking.submitting' : 'createBooking.submitting')
              : t(isEdit ? 'editBooking.submit' : 'createBooking.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
