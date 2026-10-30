'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getColors, type Theme } from '@/lib/design-tokens';
import { formatEURExact, formatMonthDayYear, eurosToCents, extractApiError } from '@/lib/helpers';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Alert, Button, Modal, ModalHeader, Note } from '@/components/ui';
import {
  useBookingInvoices,
  useBillingProfile,
  useIssueInvoice,
  useStornoInvoice,
  useRecordManualPayment,
  type CreateInvoiceLineItemInput,
} from '@/hooks/useInvoices';
import { calculateTotals, netFromGross, taxRateFor } from '@/lib/invoice-totals';
import type { Booking, Invoice, TaxCategory } from '@/types/api';

type Colors = ReturnType<typeof getColors>;

/**
 * The photographer's invoicing surface for one booking.
 *
 * <p>Everything here is irreversible by design, and the UI says so rather than
 * softening it: issuing consumes a gap-free sequence number and writes a row
 * that a database trigger refuses to update or delete (GoBD), so there is no
 * draft, no edit and no undo — only a Storno, which is itself a second
 * document. That is also why the totals shown are read back from the server
 * after issuing instead of being predicted here: the tax split is computed
 * server-side from the tenant's Kleinunternehmer/Regelbesteuerung setting.
 */
export function BookingInvoices({ booking, theme }: { booking: Booking; theme: Theme }) {
  const c = useMemo(() => getColors(theme), [theme]);
  const { data: invoices, isLoading, isError } = useBookingInvoices(booking.id);
  const [showCreate, setShowCreate] = useState(false);

  const hasInvoices = (invoices?.length ?? 0) > 0;

  return (
    <section style={{ borderTop: `1px solid ${c.divider}`, paddingTop: '18px', marginTop: '18px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: c.textMuted,
          }}
        >
          Invoices
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          style={{
            padding: '7px 14px',
            borderRadius: '9px',
            border: `1px solid ${c.border}`,
            background: c.surface,
            color: c.text,
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          New invoice
        </button>
      </div>

      {isLoading && <Note style={{ marginBottom: 10 }}>Loading invoices…</Note>}
      {isError && (
        <Note style={{ marginBottom: 10 }}>Could not load invoices for this booking.</Note>
      )}
      {!isLoading && !isError && !hasInvoices && (
        <Note style={{ marginBottom: 10 }}>
          Nothing invoiced yet. Issuing an invoice is what starts the payment side — the client can
          pay it by card, SEPA or bank transfer.
        </Note>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {(invoices ?? []).map((invoice) => (
          <InvoiceRow
            key={invoice.id}
            invoice={invoice}
            booking={booking}
            colors={c}
            theme={theme}
          />
        ))}
      </div>

      {showCreate && (
        <CreateInvoiceModal booking={booking} colors={c} onClose={() => setShowCreate(false)} />
      )}
    </section>
  );
}

// ── one invoice ──────────────────────────────────────────────────────────────

function InvoiceRow({
  invoice,
  booking,
  colors: c,
  theme,
}: {
  invoice: Invoice;
  booking: Booking;
  colors: Colors;
  theme: Theme;
}) {
  const storno = useStornoInvoice(booking.id);
  const recordPayment = useRecordManualPayment(booking.id);
  const [confirmStorno, setConfirmStorno] = useState(false);
  const [confirmPayment, setConfirmPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isStorno = invoice.stornoOfId !== null;
  const isCancelled = invoice.status === 'STORNIERT';
  // Off the invoice itself. Fetching a payment summary per row cost one request
  // per invoice, and having the figures arrive after the invoice meant every
  // branch here needed a "not loaded yet" case — with "settled" as the value it
  // fell back to, on the screen the photographer chases money from.
  const outstanding = invoice.outstandingCents;
  // A Storno is a credit note and a cancelled invoice is legally withdrawn —
  // neither is collectable, so no payment affordance on either.
  const collectable = !isStorno && !isCancelled && outstanding > 0;
  const settled = outstanding === 0;

  const tone = isCancelled || isStorno ? c.neutral : settled ? c.success : c.warning;
  const label = isStorno ? 'Storno' : isCancelled ? 'Storniert' : settled ? 'Paid' : 'Open';

  return (
    <div
      style={{
        border: `1px solid ${c.border}`,
        borderLeft: `3px solid ${tone}`,
        borderRadius: '11px',
        padding: '12px 14px',
        background: c.surfaceAlt,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: c.text }}>
            {invoice.invoiceNumber}
          </span>
          <span style={{ fontSize: '0.78rem', color: c.textMuted, marginLeft: 8 }}>
            {formatMonthDayYear(invoice.issuedAt)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: c.text }}>
            {formatEURExact(invoice.totalCents)}
          </span>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: tone,
            }}
          >
            {label}
          </span>
        </div>
      </div>

      {!isStorno && !isCancelled && (
        <div style={{ fontSize: '0.78rem', color: c.textMuted, marginTop: 4 }}>
          {formatEURExact(invoice.paidCents)} collected
          {outstanding > 0 ? ` · ${formatEURExact(outstanding)} outstanding` : ''}
          {' · Verwendungszweck: '}
          <span style={{ fontFamily: 'ui-monospace, monospace' }}>{invoice.verwendungszweck}</span>
        </div>
      )}

      {error && (
        <div role="alert" style={{ fontSize: '0.78rem', color: c.dangerText, marginTop: 6 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        {invoice.pdfDownloadUrl && (
          <a
            href={invoice.pdfDownloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: `1px solid ${c.border}`,
              background: c.surface,
              color: c.text,
              fontSize: '0.78rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            PDF
          </a>
        )}
        {collectable && (
          <button type="button" onClick={() => setConfirmPayment(true)} style={smallButton(c)}>
            Record bank transfer
          </button>
        )}
        {!isStorno && !isCancelled && (
          <button
            type="button"
            onClick={() => setConfirmStorno(true)}
            style={{ ...smallButton(c), color: c.dangerText, borderColor: c.dangerBorder }}
          >
            Storno
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmPayment}
        theme={theme}
        tone="primary"
        title="Record a bank transfer?"
        message={`Marks ${formatEURExact(outstanding)} as received on invoice ${invoice.invoiceNumber}. Only do this once the money is actually in your account — the client sees it as paid immediately.`}
        confirmLabel="Mark as received"
        busy={recordPayment.isPending}
        onCancel={() => setConfirmPayment(false)}
        onConfirm={() => {
          setError(null);
          recordPayment.mutate(
            { invoiceId: invoice.id, amountCents: null },
            {
              onSuccess: () => setConfirmPayment(false),
              onError: (err) => {
                setError(extractApiError(err, 'Could not record the payment.'));
                setConfirmPayment(false);
              },
            }
          );
        }}
      />

      <ConfirmDialog
        open={confirmStorno}
        theme={theme}
        title={`Storno invoice ${invoice.invoiceNumber}?`}
        message="This issues a separate correction invoice that cancels this one out. Neither document can be deleted afterwards — that is what GoBD requires — so both stay in your records and in the DATEV export."
        confirmLabel="Issue Storno"
        busy={storno.isPending}
        onCancel={() => setConfirmStorno(false)}
        onConfirm={() => {
          setError(null);
          storno.mutate(invoice.id, {
            onSuccess: () => setConfirmStorno(false),
            onError: (err) => {
              setError(extractApiError(err, 'Could not issue the Storno.'));
              setConfirmStorno(false);
            },
          });
        }}
      />
    </div>
  );
}

function smallButton(c: Colors): React.CSSProperties {
  return {
    padding: '6px 12px',
    borderRadius: '8px',
    border: `1px solid ${c.border}`,
    background: c.surface,
    color: c.text,
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
  };
}

// ── create ───────────────────────────────────────────────────────────────────

interface LineDraft {
  description: string;
  quantity: string;
  unitPriceEuros: string;
  taxCategory: TaxCategory;
}

const TAX_CATEGORY_LABEL: Record<TaxCategory, string> = {
  STANDARD: '19% USt.',
  REDUCED: '7% USt.',
  EXEMPT: '0% / steuerfrei',
};

function CreateInvoiceModal({
  booking,
  colors: c,
  onClose,
}: {
  booking: Booking;
  colors: Colors;
  onClose: () => void;
}) {
  const issue = useIssueInvoice(booking.id);
  const { data: profile, isLoading: profileLoading } = useBillingProfile();
  const [error, setError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);

  const [lines, setLines] = useState<LineDraft[]>([
    {
      description: booking.eventType?.trim() || 'Fotoshooting',
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
  const [paymentTerms, setPaymentTerms] = useState('Zahlbar innerhalb von 14 Tagen ohne Abzug.');

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
      setError('Add at least one line with a description.');
      return;
    }
    if (payload.some((l) => l.quantity <= 0)) {
      setError('Every line needs a quantity greater than zero.');
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
        onError: (err) => setError(extractApiError(err, 'Could not issue the invoice.')),
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
    <Modal label="Issue an invoice" onClose={onClose} onSubmit={submit} maxWidth={560}>
      <ModalHeader title="Issue an invoice" onClose={onClose} />
      {profile && !profile.complete && (
        <Alert tone="warning" style={{ marginTop: 12 }}>
          Your business details are incomplete, so the invoice would be rejected. Fill them in under
          Settings → Business details first — §14 UStG needs your name, address and either your
          Steuernummer or USt-IdNr.
        </Alert>
      )}
      <p style={{ fontSize: '0.83rem', color: c.textMuted, margin: '4px 0 18px', lineHeight: 1.5 }}>
        For {booking.clientName}. Once issued, the invoice cannot be edited or deleted — only
        corrected with a Storno.
      </p>

      <div style={{ ...sectionLabel(c) }}>Line items</div>
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
              Description
            </label>
            <input
              id={`line-desc-${i}`}
              style={input}
              value={line.description}
              onChange={(e) => updateLine(i, { description: e.target.value })}
              placeholder="Hochzeitsreportage"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '8px' }}>
            <div>
              <label style={label} htmlFor={`line-qty-${i}`}>
                Qty
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
                Unit price €
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
                Tax
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
                {(Object.keys(TAX_CATEGORY_LABEL) as TaxCategory[]).map((key) => (
                  <option key={key} value={key}>
                    {TAX_CATEGORY_LABEL[key]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {lines.length > 1 && (
            <button
              type="button"
              onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
              style={{
                ...smallButton(c),
                justifySelf: 'start',
                color: c.dangerText,
                borderColor: c.dangerBorder,
              }}
            >
              Remove line
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={() =>
          setLines((prev) => [
            ...prev,
            { description: '', quantity: '1', unitPriceEuros: '0.00', taxCategory: 'STANDARD' },
          ])
        }
        style={{ ...smallButton(c), marginBottom: 18 }}
      >
        Add line
      </button>

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
        <Row label="Net" value={formatEURExact(totals.subtotalCents)} colors={c} />
        {taxMode === 'REGELBESTEUERUNG' && (
          <Row label="VAT" value={formatEURExact(totals.taxCents)} colors={c} />
        )}
        <Row label="Client pays" value={formatEURExact(totals.totalCents)} colors={c} strong />
        {taxMode === 'KLEINUNTERNEHMER' && (
          <div style={{ marginTop: 8, fontSize: '0.78rem' }}>
            No VAT — you are registered as Kleinunternehmer (§19 UStG).
          </div>
        )}
        {totals.totalCents !== (booking.totalAmountCents ?? 0) && (
          <div style={{ marginTop: 8, fontSize: '0.78rem' }}>
            The agreed booking total is {formatEURExact(booking.totalAmountCents ?? 0)}.
          </div>
        )}
      </div>

      <div style={sectionLabel(c)}>Client address (optional)</div>
      <div style={{ display: 'grid', gap: '10px', marginBottom: 18 }}>
        <input
          style={input}
          placeholder="Street and number"
          aria-label="Client street and number"
          value={buyer.addressLine1}
          onChange={(e) => setBuyer((b) => ({ ...b, addressLine1: e.target.value }))}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '8px' }}>
          <input
            style={input}
            placeholder="PLZ"
            aria-label="Client postal code"
            value={buyer.postalCode}
            onChange={(e) => setBuyer((b) => ({ ...b, postalCode: e.target.value }))}
          />
          <input
            style={input}
            placeholder="City"
            aria-label="Client city"
            value={buyer.city}
            onChange={(e) => setBuyer((b) => ({ ...b, city: e.target.value }))}
          />
          <input
            style={input}
            placeholder="DE"
            aria-label="Client country code"
            maxLength={2}
            value={buyer.country}
            onChange={(e) => setBuyer((b) => ({ ...b, country: e.target.value.toUpperCase() }))}
          />
        </div>
        <input
          style={input}
          placeholder="Payment terms"
          aria-label="Payment terms"
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
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          busy={issue.isPending}
          busyLabel="Issuing…"
          disabled={profileLoading || profile?.complete === false}
        >
          Issue invoice
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
        fontWeight: strong ? 700 : 400,
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function sectionLabel(c: Colors): React.CSSProperties {
  return {
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    color: c.textMuted,
    marginBottom: 10,
  };
}
