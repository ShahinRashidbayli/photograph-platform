'use client';

import React, { useMemo, useState } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { getColors } from '@/lib/design-tokens';
import { useTranslation } from '@/lib/i18n';
import { useCustomerInvoices } from '@/hooks/useInvoices';
import { StripePaymentModal } from '@/components/StripePaymentModal';
import { Note } from '@/components/ui';
import type { Invoice } from '@/types/api';

type Colors = ReturnType<typeof getColors>;

/**
 * The client's invoices, each with a real pay action.
 *
 * <p>Scoped to one booking when {@code bookingId} is given, otherwise every
 * invoice addressed to the signed-in client. Amounts come from the invoice and
 * its payment summary — not from the booking's agreed total — because those
 * are different numbers whenever only a deposit has been invoiced, and showing
 * the booking total next to a "Pay" button would ask the client for money no
 * document has claimed yet.
 */
export function InvoicePayList({
  bookingId,
  emptyKey = 'invoices.empty',
}: {
  bookingId?: string;
  /** Which "nothing here" line to show — a booking's is more specific. */
  emptyKey?: 'invoices.empty' | 'invoices.emptyForBooking';
}) {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const c = useMemo(() => getColors(theme), [theme]);
  const { data: invoices, isLoading, isError } = useCustomerInvoices();

  const visible = useMemo(() => {
    const all = invoices ?? [];
    const scoped = bookingId ? all.filter((i) => i.bookingId === bookingId) : all;
    // A Storno is a credit note the client never pays, and its original is
    // withdrawn — neither belongs in a "what do I owe" list. Both stay
    // downloadable from the photographer's side, where the audit trail lives.
    return scoped.filter((i) => i.stornoOfId === null && i.status !== 'STORNIERT');
  }, [invoices, bookingId]);

  if (isLoading) {
    return <Note>{t('invoices.loading')}</Note>;
  }
  if (isError) {
    return <Note>{t('invoices.error')}</Note>;
  }
  if (visible.length === 0) {
    return <Note>{t(emptyKey)}</Note>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {visible.map((invoice) => (
        <InvoicePayRow key={invoice.id} invoice={invoice} colors={c} />
      ))}
    </div>
  );
}

function InvoicePayRow({ invoice, colors: c }: { invoice: Invoice; colors: Colors }) {
  const { t, format } = useTranslation();
  const [paying, setPaying] = useState(false);

  // Straight off the invoice. This used to be a `usePaymentSummary(invoice.id)`
  // per row — one request per invoice — and the figures arriving separately
  // from the invoice meant every branch below had to handle "not here yet",
  // with "paid" as the accidental default when the request had merely failed.
  // Now the list either loaded or it didn't, and the caller renders the error.
  const { outstandingCents: outstanding, paidCents } = invoice;
  const settled = outstanding === 0;

  return (
    <div
      style={{
        border: `1px solid ${c.border}`,
        borderLeft: `3px solid ${settled ? c.success : c.warning}`,
        borderRadius: '11px',
        padding: '12px 14px',
        background: c.surfaceAlt,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.87rem', fontWeight: 700, color: c.text }}>
            {t('invoices.number', { number: invoice.invoiceNumber })}
          </div>
          <div style={{ fontSize: '0.78rem', color: c.textMuted, marginTop: 2 }}>
            {format.monthDayYear(invoice.issuedAt)} · {format.eurExact(invoice.totalCents)}
            {paidCents > 0 && outstanding > 0
              ? ` · ${t('invoices.partiallyPaid', { amount: format.eurExact(paidCents) })}`
              : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: '0.95rem',
              fontWeight: 800,
              color: settled ? c.successText : c.warningText,
            }}
          >
            {settled ? t('invoices.paid') : format.eurExact(outstanding)}
          </div>
          {!settled && (
            <div style={{ fontSize: '0.72rem', color: c.textMuted }}>
              {t('invoices.outstanding')}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {outstanding > 0 && (
          <button
            type="button"
            onClick={() => setPaying(true)}
            style={{
              padding: '8px 18px',
              borderRadius: '9px',
              border: 'none',
              background: c.primarySolid,
              color: '#fff',
              fontSize: '0.83rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {t('invoices.pay', { amount: format.eurExact(outstanding) })}
          </button>
        )}
        {invoice.pdfDownloadUrl && (
          <a
            href={invoice.pdfDownloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '8px 14px',
              borderRadius: '9px',
              border: `1px solid ${c.border}`,
              background: c.surface,
              color: c.text,
              fontSize: '0.83rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            {t('invoices.downloadPdf')}
          </a>
        )}
      </div>

      {outstanding > 0 && (
        <div style={{ fontSize: '0.75rem', color: c.textMuted, marginTop: 10, lineHeight: 1.5 }}>
          {t('invoices.bankTransferHint', { reference: invoice.verwendungszweck })}
        </div>
      )}

      {paying && (
        <StripePaymentModal
          invoice={invoice}
          outstandingCents={outstanding}
          onClose={() => setPaying(false)}
        />
      )}
    </div>
  );
}
