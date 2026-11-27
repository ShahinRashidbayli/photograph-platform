'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getColors, type Theme } from '@/lib/design-tokens';
import { eurosToCents, extractApiError } from '@/lib/helpers';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Alert, Button, Modal, ModalHeader } from '@/components/ui';
import { useTranslation, type TranslationKey } from '@/lib/i18n';
import {
  useBillingProfile,
  useBookingInvoices,
  useIssueInvoice,
  useRecordManualPayment,
  useStornoInvoice,
  type CreateInvoiceLineItemInput,
} from '@/hooks/useInvoices';
import { calculateTotals, netFromGross, taxRateFor } from '@/lib/invoice-totals';
import { INVOICE_STATUS, invoiceStatus } from '@/lib/invoice-status';
import type { Booking, Invoice, TaxCategory } from '@/types/api';
import { BookingActionMenu } from './BookingActionMenu';
import { dot, getDetailStyles, pill } from './bookingDetail.styles';
import { getBookingsStyles } from './bookings.styles';

type Colors = ReturnType<typeof getColors>;

/**
 * The invoices issued for one booking, as rows under the payment summary.
 *
 * <p>Everything here is irreversible by design, and the UI says so rather than
 * softening it: issuing consumes a gap-free sequence number and writes a row
 * that a database trigger refuses to update or delete (GoBD), so there is no
 * draft, no edit and no undo — only a Storno, which is itself a second
 * document. That is also why the totals shown are read back from the server
 * after issuing instead of being predicted here: the tax split is computed
 * server-side from the tenant's Kleinunternehmer/Regelbesteuerung setting.
 *
 * <p>Issuing is started from the payment section's header (and from the
 * detail's lead action), which is why this renders only the rows.
 */
export function BookingInvoices({ booking, theme }: { booking: Booking; theme: Theme }) {
  const c = useMemo(() => getColors(theme), [theme]);
  const s = useMemo(() => getDetailStyles(c), [c]);
  const { t } = useTranslation();
  const { data: invoices, isLoading, isError, refetch } = useBookingInvoices(booking.id);

  if (isLoading) return <p style={{ ...s.body, marginTop: 20 }}>{t('invoices.loading')}</p>;

  // A quiet row with a way forward, not a bare sentence: the payment figures
  // above still come from the booking, so the section is not empty — only the
  // document list could not be read.
  if (isError) {
    return (
      <div style={s.quietError} role="status">
        <span>{t('invoices.manage.loadError')}</span>
        <Button variant="secondary" size="sm" onClick={() => refetch()}>
          {t('invoices.manage.retry')}
        </Button>
      </div>
    );
  }

  if (!invoices || invoices.length === 0) {
    return <p style={s.emptyNote}>{t('invoices.manage.empty')}</p>;
  }

  return (
    <div style={s.table}>
      {invoices.map((invoice, i) => (
        <InvoiceRow
          key={invoice.id}
          invoice={invoice}
          booking={booking}
          theme={theme}
          colors={c}
          first={i === 0}
        />
      ))}
    </div>
  );
}

// ── one invoice ──────────────────────────────────────────────────────────────

function InvoiceRow({
  invoice,
  booking,
  theme,
  colors: c,
  first,
}: {
  invoice: Invoice;
  booking: Booking;
  theme: Theme;
  colors: Colors;
  first: boolean;
}) {
  const { t, format } = useTranslation();
  const s = useMemo(() => getDetailStyles(c), [c]);
  const menuStyles = useMemo(() => getBookingsStyles(theme), [theme]);
  const storno = useStornoInvoice(booking.id);
  const [confirmStorno, setConfirmStorno] = useState(false);
  const [confirmPayment, setConfirmPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live, Collectable, Overdue and the Due date are the server's Settlement,
  // carried on the invoice itself (ADR-004); fetching them per row cost one
  // request per invoice. `invoiceStatus` only reads them.
  const { live, collectable } = invoice;
  const { labelKey, tone } = INVOICE_STATUS[invoiceStatus(invoice)];
  const [fg, bg] = {
    neutral: [c.neutralText, c.neutralBg],
    danger: [c.dangerText, c.dangerBg],
    warning: [c.warningText, c.warningBg],
    success: [c.successText, c.successBg],
  }[tone];

  const menuItems = [
    ...(collectable
      ? [
          {
            key: 'record',
            label: t('invoices.manage.recordTransfer'),
            onSelect: () => setConfirmPayment(true),
          },
        ]
      : []),
    ...(live
      ? [
          {
            key: 'storno',
            label: t('invoices.manage.storno'),
            danger: true,
            onSelect: () => setConfirmStorno(true),
          },
        ]
      : []),
  ];

  return (
    <div style={{ borderTop: first ? undefined : `1px solid ${c.borderSoft}` }}>
      <div className="bk-inv-row" style={s.invoiceRow}>
        <div style={{ minWidth: 0 }}>
          <div style={s.invoiceNumber}>{invoice.invoiceNumber}</div>
          <div style={s.invoiceMeta}>
            {format.monthDayYear(invoice.issuedAt)}
            {invoice.dueDate && (
              <>
                {' · '}
                {t('invoices.manage.dueOn', { date: format.monthDayYear(invoice.dueDate) })}
              </>
            )}
            {/* "€0.00 of €700.00 paid" and "€450.00 of €450.00 paid" say
                nothing the badge does not; only a part payment earns a line.
                The reference is shown when it is not just the number again. */}
            {collectable && invoice.paidCents > 0 && (
              <>
                {' · '}
                {t('invoices.manage.paidOf', {
                  paid: format.eurExact(invoice.paidCents),
                  total: format.eurExact(invoice.totalCents),
                })}
              </>
            )}
            {live && invoice.verwendungszweck !== invoice.invoiceNumber && (
              <>
                {' · '}
                {t('invoices.manage.reference', { reference: invoice.verwendungszweck })}
              </>
            )}
          </div>
        </div>
        <span style={s.amount}>{format.eurExact(invoice.totalCents)}</span>
        {/* Its own width, not the grid cell's — on a phone the cell is half the row. */}
        <span style={{ ...pill(fg, bg), justifySelf: 'start' }}>
          <span style={dot(fg)} />
          {t(labelKey)}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          {invoice.pdfDownloadUrl && (
            <a
              href={invoice.pdfDownloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${t('invoices.downloadPdf')} — ${invoice.invoiceNumber}`}
              className="ui-row-hover"
              style={{ ...s.iconLink, ['--ui-row-hover' as string]: c.surfaceHover }}
            >
              <DownloadIcon />
            </a>
          )}
          {menuItems.length > 0 && (
            <BookingActionMenu
              // Named for its invoice: the detail's own "More actions" menu is
              // on the same screen, and two controls with one name are one
              // control to a screen reader.
              label={t('invoices.manage.actionsFor', { number: invoice.invoiceNumber })}
              styles={menuStyles}
              colors={c}
              items={menuItems}
            />
          )}
        </span>
      </div>

      {error && (
        <Alert tone="danger" style={{ margin: '0 16px 12px' }}>
          {error}
        </Alert>
      )}

      <RecordPaymentDialog
        invoice={invoice}
        booking={booking}
        theme={theme}
        open={confirmPayment}
        onClose={() => setConfirmPayment(false)}
        onError={setError}
      />

      <ConfirmDialog
        open={confirmStorno}
        theme={theme}
        title={t('invoices.manage.stornoTitle', { number: invoice.invoiceNumber })}
        message={t('invoices.manage.stornoBody')}
        confirmLabel={t('invoices.manage.stornoConfirm')}
        busy={storno.isPending}
        onCancel={() => setConfirmStorno(false)}
        onConfirm={() => {
          setError(null);
          storno.mutate(invoice.id, {
            onSuccess: () => setConfirmStorno(false),
            onError: (err) => {
              setError(extractApiError(err, t('invoices.manage.stornoError')));
              setConfirmStorno(false);
            },
          });
        }}
      />
    </div>
  );
}

/**
 * "This money is in my account" for one invoice. Shared by the invoice row and
 * the detail's lead action, so both ask the same question with the same
 * warning. Closes on failure too and hands the error to the caller, which
 * shows it outside the dialog.
 */
export function RecordPaymentDialog({
  invoice,
  booking,
  theme,
  open,
  onClose,
  onError,
}: {
  invoice: Invoice;
  booking: Booking;
  theme: Theme;
  open: boolean;
  onClose: () => void;
  onError: (_message: string | null) => void;
}) {
  const { t, format } = useTranslation();
  const recordPayment = useRecordManualPayment(booking.id);
  return (
    <ConfirmDialog
      open={open}
      theme={theme}
      tone="primary"
      title={t('invoices.manage.recordTitle')}
      message={t('invoices.manage.recordBody', {
        amount: format.eurExact(invoice.outstandingCents),
        number: invoice.invoiceNumber,
      })}
      confirmLabel={t('invoices.manage.recordConfirm')}
      busy={recordPayment.isPending}
      onCancel={onClose}
      onConfirm={() => {
        onError(null);
        recordPayment.mutate(
          { invoiceId: invoice.id, amountCents: null },
          {
            onSuccess: onClose,
            onError: (err) => {
              onError(extractApiError(err, t('invoices.manage.recordError')));
              onClose();
            },
          }
        );
      }}
    />
  );
}

function DownloadIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />
    </svg>
  );
}

// ── create ───────────────────────────────────────────────────────────────────

interface LineDraft {
  description: string;
  quantity: string;
  unitPriceEuros: string;
  taxCategory: TaxCategory;
}

const TAX_LABEL: Record<TaxCategory, TranslationKey> = {
  STANDARD: 'invoices.create.tax.STANDARD',
  REDUCED: 'invoices.create.tax.REDUCED',
  EXEMPT: 'invoices.create.tax.EXEMPT',
};

// Printed on the invoice itself, which goes to a German client whatever
// language the photographer's screen is in — so it is document text, not UI.
const DEFAULT_PAYMENT_TERMS = 'Zahlbar innerhalb von 14 Tagen ohne Abzug.';

export function CreateInvoiceModal({
  booking,
  colors: c,
  onClose,
}: {
  booking: Booking;
  colors: Colors;
  onClose: () => void;
}) {
  const { t, format } = useTranslation();
  const issue = useIssueInvoice(booking.id);
  const { data: profile, isLoading: profileLoading } = useBillingProfile();
  const [error, setError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);

  const [lines, setLines] = useState<LineDraft[]>([
    {
      description: booking.eventType?.trim() || t('invoices.create.defaultLine'),
      quantity: '1',
      unitPriceEuros: '0.00',
      taxCategory: 'STANDARD',
    },
  ]);

  // The booking total is what the client agreed to pay — gross, as German
  // consumer prices must be quoted (PAngV). An invoice line takes a NET price
  // and has VAT added on top, so seeding the line with the booking total
  // directly would bill a Regelbesteuerung client 19% over the agreed price, on
  // a document nobody can edit afterwards. Wait for the tax mode, then seed the
  // net that grosses back up to it — once, so a later render never clobbers an
  // edit in progress.
  useEffect(() => {
    if (!profile || seeded) return;
    setLines((prev) =>
      prev.map((line, i) =>
        i === 0
          ? {
              ...line,
              unitPriceEuros: (
                netFromGross(booking.totalAmountCents ?? 0, line.taxCategory, profile.taxMode) / 100
              ).toFixed(2),
            }
          : line
      )
    );
    setSeeded(true);
  }, [profile, seeded, booking.totalAmountCents]);
  const [buyer, setBuyer] = useState({
    addressLine1: '',
    addressLine2: '',
    postalCode: '',
    city: '',
    country: 'DE',
    reference: '',
  });
  const [paymentTerms, setPaymentTerms] = useState(DEFAULT_PAYMENT_TERMS);

  const taxMode = profile?.taxMode ?? 'KLEINUNTERNEHMER';
  const totals = calculateTotals(
    lines.map((l) => ({
      quantity: Number.parseFloat(l.quantity) || 0,
      unitPriceCents: eurosToCents(l.unitPriceEuros),
      taxCategory: l.taxCategory,
    })),
    taxMode
  );

  const updateLine = (index: number, patch: Partial<LineDraft>) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload: CreateInvoiceLineItemInput[] = lines
      .filter((l) => l.description.trim())
      .map((l) => ({
        description: l.description.trim(),
        quantity: Number.parseFloat(l.quantity) || 0,
        unitPriceCents: eurosToCents(l.unitPriceEuros),
        taxCategory: l.taxCategory,
      }));

    if (payload.length === 0) {
      setError(t('invoices.create.errNoLines'));
      return;
    }
    if (payload.some((l) => l.quantity <= 0)) {
      setError(t('invoices.create.errQuantity'));
      return;
    }

    issue.mutate(
      {
        lineItems: payload,
        buyerAddressLine1: buyer.addressLine1.trim() || null,
        buyerAddressLine2: buyer.addressLine2.trim() || null,
        buyerPostalCode: buyer.postalCode.trim() || null,
        buyerCity: buyer.city.trim() || null,
        buyerCountry: buyer.country.trim() || null,
        buyerReference: buyer.reference.trim() || null,
        paymentTerms: paymentTerms.trim() || null,
      },
      {
        onSuccess: onClose,
        onError: (err) => setError(extractApiError(err, t('invoices.create.errIssue'))),
      }
    );
  };

  const input: React.CSSProperties = {
    padding: '8px 11px',
    border: `1px solid ${c.border}`,
    borderRadius: '9px',
    fontSize: '0.85rem',
    color: c.text,
    background: c.surfaceAlt,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };
  const label: React.CSSProperties = {
    fontSize: '0.74rem',
    fontWeight: 600,
    color: c.textMuted,
    display: 'block',
    marginBottom: 4,
  };

  return (
    <Modal label={t('invoices.create.title')} onClose={onClose} onSubmit={submit} maxWidth={560}>
      <ModalHeader title={t('invoices.create.title')} onClose={onClose} />
      {profile && !profile.complete && (
        <Alert tone="warning" style={{ marginTop: 12 }}>
          {t('invoices.create.profileIncomplete')}
        </Alert>
      )}
      <p style={{ fontSize: '0.83rem', color: c.textMuted, margin: '4px 0 18px', lineHeight: 1.5 }}>
        {t('invoices.create.intro', { name: booking.clientName })}
      </p>

      <div style={{ ...sectionLabel(c) }}>{t('invoices.create.lineItems')}</div>
      {lines.map((line, i) => (
        <div
          key={i}
          style={{
            border: `1px solid ${c.borderSoft}`,
            borderRadius: '11px',
            padding: '12px',
            marginBottom: '10px',
            display: 'grid',
            gap: '10px',
          }}
        >
          <div>
            <label style={label} htmlFor={`line-desc-${i}`}>
              {t('invoices.create.description')}
            </label>
            <input
              id={`line-desc-${i}`}
              style={input}
              value={line.description}
              onChange={(e) => updateLine(i, { description: e.target.value })}
              placeholder={t('invoices.create.descriptionPlaceholder')}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '8px' }}>
            <div>
              <label style={label} htmlFor={`line-qty-${i}`}>
                {t('invoices.create.quantity')}
              </label>
              <input
                id={`line-qty-${i}`}
                style={input}
                type="number"
                min="0.01"
                step="0.01"
                value={line.quantity}
                onChange={(e) => updateLine(i, { quantity: e.target.value })}
              />
            </div>
            <div>
              <label style={label} htmlFor={`line-price-${i}`}>
                {t('invoices.create.unitPrice')}
              </label>
              <input
                id={`line-price-${i}`}
                style={input}
                type="number"
                min="0"
                step="0.01"
                value={line.unitPriceEuros}
                onChange={(e) => updateLine(i, { unitPriceEuros: e.target.value })}
              />
            </div>
            <div>
              <label style={label} htmlFor={`line-tax-${i}`}>
                {t('invoices.create.tax')}
              </label>
              <select
                id={`line-tax-${i}`}
                style={input}
                value={line.taxCategory}
                onChange={(e) => {
                  // Changing the rate on a seeded line keeps the gross the
                  // client agreed to and moves the net instead — switching
                  // 19%→7% must not quietly hand them a 12% discount.
                  const next = e.target.value as TaxCategory;
                  const grossNow = Math.round(
                    eurosToCents(line.unitPriceEuros) *
                      (1 + taxRateFor(line.taxCategory, taxMode) / 100)
                  );
                  updateLine(i, {
                    taxCategory: next,
                    unitPriceEuros: (netFromGross(grossNow, next, taxMode) / 100).toFixed(2),
                  });
                }}
              >
                {(Object.keys(TAX_LABEL) as TaxCategory[]).map((key) => (
                  <option key={key} value={key}>
                    {t(TAX_LABEL[key])}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {lines.length > 1 && (
            <Button
              variant="danger"
              size="sm"
              style={{ justifySelf: 'start' }}
              onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
            >
              {t('invoices.create.removeLine')}
            </Button>
          )}
        </div>
      ))}

      <Button
        variant="secondary"
        size="sm"
        style={{ marginBottom: 18 }}
        onClick={() =>
          setLines((prev) => [
            ...prev,
            { description: '', quantity: '1', unitPriceEuros: '0.00', taxCategory: 'STANDARD' },
          ])
        }
      >
        {t('invoices.create.addLine')}
      </Button>

      {/* What the client will actually be billed. Shown before issuing
            because the document is immutable afterwards — and because the
            figure the photographer has in their head is the gross one they
            quoted, which is not the net they just typed. */}
      <div
        style={{
          border: `1px solid ${c.borderSoft}`,
          borderRadius: '11px',
          padding: '12px 14px',
          marginBottom: 18,
          fontSize: '0.84rem',
          color: c.textMuted,
        }}
      >
        <Row
          label={t('invoices.create.net')}
          value={format.eurExact(totals.subtotalCents)}
          colors={c}
        />
        {taxMode === 'REGELBESTEUERUNG' && (
          <Row
            label={t('invoices.create.vat')}
            value={format.eurExact(totals.taxCents)}
            colors={c}
          />
        )}
        <Row
          label={t('invoices.create.clientPays')}
          value={format.eurExact(totals.totalCents)}
          colors={c}
          strong
        />
        {taxMode === 'KLEINUNTERNEHMER' && (
          <div style={{ marginTop: 8, fontSize: '0.78rem' }}>
            {t('invoices.create.smallBusiness')}
          </div>
        )}
        {totals.totalCents !== (booking.totalAmountCents ?? 0) && (
          <div style={{ marginTop: 8, fontSize: '0.78rem' }}>
            {t('invoices.create.agreedTotal', {
              amount: format.eurExact(booking.totalAmountCents ?? 0),
            })}
          </div>
        )}
      </div>

      <div style={sectionLabel(c)}>{t('invoices.create.address')}</div>
      <div style={{ display: 'grid', gap: '10px', marginBottom: 18 }}>
        <input
          style={input}
          placeholder={t('invoices.create.street')}
          aria-label={t('invoices.create.street')}
          value={buyer.addressLine1}
          onChange={(e) => setBuyer((b) => ({ ...b, addressLine1: e.target.value }))}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '8px' }}>
          <input
            style={input}
            placeholder={t('invoices.create.postalCode')}
            aria-label={t('invoices.create.postalCode')}
            value={buyer.postalCode}
            onChange={(e) => setBuyer((b) => ({ ...b, postalCode: e.target.value }))}
          />
          <input
            style={input}
            placeholder={t('invoices.create.city')}
            aria-label={t('invoices.create.city')}
            value={buyer.city}
            onChange={(e) => setBuyer((b) => ({ ...b, city: e.target.value }))}
          />
          <input
            style={input}
            placeholder="DE"
            aria-label={t('invoices.create.country')}
            maxLength={2}
            value={buyer.country}
            onChange={(e) => setBuyer((b) => ({ ...b, country: e.target.value.toUpperCase() }))}
          />
        </div>
        <input
          style={input}
          placeholder={t('invoices.create.paymentTerms')}
          aria-label={t('invoices.create.paymentTerms')}
          value={paymentTerms}
          onChange={(e) => setPaymentTerms(e.target.value)}
        />
      </div>

      {error && (
        <Alert tone="danger" style={{ marginBottom: 14 }}>
          {error}
        </Alert>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Button variant="secondary" size="sm" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          variant="primary"
          busy={issue.isPending}
          busyLabel={t('invoices.create.submitting')}
          disabled={profileLoading || profile?.complete === false}
        >
          {t('invoices.create.submit')}
        </Button>
      </div>
    </Modal>
  );
}

function Row({
  label,
  value,
  colors: c,
  strong,
}: {
  label: string;
  value: string;
  colors: Colors;
  strong?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        marginTop: strong ? 6 : 2,
        paddingTop: strong ? 6 : 0,
        borderTop: strong ? `1px solid ${c.borderSoft}` : undefined,
        color: strong ? c.text : undefined,
        fontWeight: strong ? 600 : 400,
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function sectionLabel(c: Colors): React.CSSProperties {
  return {
    fontSize: '0.75rem',
    fontWeight: 550,
    color: c.textMuted,
    marginBottom: 10,
  };
}
