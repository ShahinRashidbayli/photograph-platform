'use client';

import React, { useMemo, useState } from 'react';
import { getColors, type Theme } from '@/lib/design-tokens';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { asyncError, asyncErrorText, type AsyncError } from '@/lib/async-error';
import { extractApiError } from '@/lib/helpers';
import { useTranslation } from '@/lib/i18n';
import { Alert, Button, Field, Input } from '@/components/ui';
import type { Package } from '@/types/api';
import { useDeletePackage, usePackages, useSavePackage } from '@/hooks/usePackages';

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

export function PackagesSection({ theme }: { readonly theme: Theme }) {
  const { t } = useTranslation();
  const c = useMemo(() => getColors(theme), [theme]);

  const packagesQuery = usePackages();
  const savePackage = useSavePackage();
  const deletePackage = useDeletePackage();
  // null while the first read is in flight. A failed read is an empty list with
  // the error above it, not an endless "loading".
  const packages: Package[] | null = packagesQuery.data ?? (packagesQuery.isError ? [] : null);
  const loadError: AsyncError | null = packagesQuery.isError
    ? asyncError(packagesQuery.error, 'settings.packages.loadError')
    : null;
  const [editingId, setEditingId] = useState<string | null>(null);
  // `creating` opens an inline create form. Mutually exclusive with editing
  // any existing row so the photographer can't accidentally edit two things
  // at once.
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<PackageFormState>(EMPTY_PACKAGE_FORM);
  const submitting = savePackage.isPending;
  // Belongs to the open form only.
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Package | null>(null);
  const deleting = deletePackage.isPending;
  // Its own state, shown above the list. A delete failure used to be written
  // to `submitError`, which renders inside the edit form — and Delete is
  // disabled while a form is open, so that message could never be seen at the
  // moment it happened. It surfaced later, in the next "new package" form.
  const [deleteError, setDeleteError] = useState<AsyncError | null>(null);

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

  const handleSubmit = () => {
    if (submitting) return;
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setSubmitError(t('settings.packages.nameRequired'));
      return;
    }
    const euros = Number(form.priceEuros);
    if (!Number.isFinite(euros) || euros <= 0) {
      // Backend allows 0 today; the UI is stricter on purpose — a €0 package
      // is almost always a typo and easier to catch here than in invoices.
      setSubmitError(t('settings.packages.priceInvalid'));
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

    setSubmitError(null);
    savePackage.mutate(
      { id: editingId ?? undefined, payload },
      {
        onSuccess: cancelEdit,
        onError: (err) => setSubmitError(extractApiError(err, t('settings.packages.saveError'))),
      }
    );
  };

  const confirmDelete = () => {
    if (!pendingDelete || deleting) return;
    setDeleteError(null);
    deletePackage.mutate(pendingDelete.id, {
      onSuccess: () => setPendingDelete(null),
      onError: (err) => {
        // Closed either way: a dialog left open on a failure, saying nothing,
        // reads as a button that did not register.
        setPendingDelete(null);
        setDeleteError(asyncError(err, 'settings.packages.deleteError'));
      },
    });
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
  const label: React.CSSProperties = {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: c.textMuted,
    letterSpacing: '0.02em',
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
        <div style={{ gridColumn: 'span 2' }}>
          <Field label={t('settings.packages.name')}>
            {(props) => (
              <Input
                {...props}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                maxLength={200}
                placeholder={t('settings.packages.namePlaceholder')}
                style={{ background: c.surfaceHover }}
              />
            )}
          </Field>
        </div>
        <div>
          <Field label={t('settings.packages.price')}>
            {(props) => (
              <Input
                {...props}
                type="number"
                min="1"
                step="1"
                value={form.priceEuros}
                onChange={(e) => setForm((f) => ({ ...f, priceEuros: e.target.value }))}
                placeholder={t('settings.packages.pricePlaceholder')}
                style={{ background: c.surfaceHover }}
              />
            )}
          </Field>
        </div>
        <div>
          <Field label={t('settings.packages.duration')}>
            {(props) => (
              <Input
                {...props}
                type="number"
                min="0"
                step="0.5"
                value={form.durationHours}
                onChange={(e) => setForm((f) => ({ ...f, durationHours: e.target.value }))}
                placeholder={t('settings.packages.durationPlaceholder')}
                style={{ background: c.surfaceHover }}
              />
            )}
          </Field>
        </div>
        <div>
          <Field label={t('settings.packages.includedPhotos')}>
            {(props) => (
              <Input
                {...props}
                type="number"
                min="0"
                step="1"
                value={form.includedPhotos}
                onChange={(e) => setForm((f) => ({ ...f, includedPhotos: e.target.value }))}
                placeholder={t('settings.packages.includedPhotosPlaceholder')}
                style={{ background: c.surfaceHover }}
              />
            )}
          </Field>
        </div>
        <div>
          <Field label={t('settings.packages.sortOrder')}>
            {(props) => (
              <Input
                {...props}
                type="number"
                min="0"
                step="1"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                style={{ background: c.surfaceHover }}
              />
            )}
          </Field>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', paddingBottom: '4px' }}>
          <label
            htmlFor="pkg-active"
            style={{
              ...label,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
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
                accentColor: c.primary,
              }}
            />
            {t('settings.packages.active')}
          </label>
        </div>
      </div>

      {submitError && (
        <Alert tone="danger" style={{ marginTop: 20 }}>
          {submitError}
        </Alert>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '14px',
          marginTop: '24px',
          paddingTop: '20px',
          borderTop: `1px solid ${c.borderSoft}`,
        }}
      >
        <Button variant="ghost" onClick={cancelEdit} disabled={submitting}>
          {t('settings.packages.cancel')}
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          busy={submitting}
          busyLabel={t('settings.packages.submitting')}
        >
          {editingId ? t('settings.packages.save') : t('settings.packages.create')}
        </Button>
      </div>
    </div>
  );

  return (
    <section style={section} aria-labelledby="settings-packages">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div>
          <h2
            id="settings-packages"
            style={{ fontSize: '1rem', fontWeight: 600, color: c.text, marginBottom: '4px' }}
          >
            {t('settings.packages.title')}
          </h2>
          <p style={{ fontSize: '0.88rem', color: c.textMuted, margin: 0 }}>
            {t('settings.packages.subtitle')}
            the total.
          </p>
        </div>
        {!creating && !editingId && (
          <button
            type="button"
            style={{
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
              gap: '6px',
            }}
            onClick={startCreate}
          >
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
              <path
                d="M7 1v12M1 7h12"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
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
          {asyncErrorText(loadError, t)}
        </div>
      )}

      {deleteError && (
        <Alert tone="danger" style={{ marginBottom: 12 }}>
          {asyncErrorText(deleteError, t)}
        </Alert>
      )}

      {packages === null ? (
        <div
          style={{ padding: '40px', fontSize: '0.9rem', color: c.textMuted, textAlign: 'center' }}
        >
          <div style={{ marginBottom: '16px', opacity: 0.5 }}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                d="M3 4h13M3 8h9m-9 4h6m4 0h4M4 16h16M5 20h14"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          {t('settings.packages.loading')}
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
          <p
            style={{ fontSize: '0.95rem', color: c.textMuted, margin: '0 0 20px', fontWeight: 500 }}
          >
            {t('settings.packages.empty')}
          </p>
          <p
            style={{
              fontSize: '0.88rem',
              color: c.textMuted,
              margin: '0 0 24px',
              maxWidth: '320px',
              marginInline: 'auto',
            }}
          >
            {t('settings.packages.emptyBody')}
            when booking your services.
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
              transition: 'all 0.2s ease',
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
              <tr
                style={{
                  textAlign: 'left',
                  color: c.textMuted,
                  borderBottom: `2px solid ${c.divider}`,
                }}
              >
                <th
                  style={{
                    padding: '14px 12px 14px 0',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                  }}
                >
                  Name
                </th>
                <th
                  style={{
                    padding: '14px 12px',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                  }}
                >
                  {t('settings.packages.price')}
                </th>
                <th
                  style={{
                    padding: '14px 12px',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                  }}
                >
                  {t('settings.packages.duration')}
                </th>
                <th
                  style={{
                    padding: '14px 12px',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                  }}
                >
                  {t('settings.packages.photos')}
                </th>
                <th
                  style={{
                    padding: '14px 12px',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                  }}
                >
                  {t('settings.packages.status')}
                </th>
                <th
                  style={{
                    padding: '14px 12px',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                  }}
                  aria-label={t('settings.packages.actions')}
                />
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <React.Fragment key={pkg.id}>
                  <tr
                    style={{
                      borderBottom: `1px solid ${c.borderSoft}`,
                      transition: 'background 0.2s ease',
                    }}
                  >
                    <td style={{ padding: '16px 12px 16px 0', color: c.text, fontWeight: 600 }}>
                      {pkg.name}
                    </td>
                    <td style={{ padding: '16px 12px', color: c.text, fontWeight: 500 }}>
                      {formatPriceEur(pkg.priceCents, pkg.currency)}
                    </td>
                    <td style={{ padding: '16px 12px', color: c.textMuted }}>
                      {pkg.durationHours != null ? `${pkg.durationHours}h` : '—'}
                    </td>
                    <td style={{ padding: '16px 12px', color: c.textMuted }}>
                      {pkg.includedPhotos != null ? pkg.includedPhotos : '—'}
                    </td>
                    <td style={{ padding: '16px 12px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          padding: '6px 12px',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 550,
                          background: pkg.active ? c.successBg : c.surfaceAlt,
                          color: pkg.active ? c.successText : c.textMuted,
                          border: `1px solid ${pkg.active ? c.successBorder : c.border}`,
                        }}
                      >
                        {pkg.active
                          ? t('settings.packages.active')
                          : t('settings.packages.inactive')}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '16px 0 16px 12px',
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                      }}
                    >
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
                        {t('settings.packages.delete')}
                      </button>
                    </td>
                  </tr>
                  {editingId === pkg.id && (
                    <tr>
                      <td colSpan={6} style={{ padding: 0 }}>
                        {renderForm()}
                      </td>
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
        title={t('settings.packages.deleteConfirm')}
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
