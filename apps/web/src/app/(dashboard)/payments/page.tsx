'use client';

import React, { useMemo, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { fontSize, getColors, pageTitle } from '@/lib/design-tokens';
import { startOfToday } from '@/lib/date';
import { useTranslation } from '@/lib/i18n';
import { Alert, Button, Note } from '@/components/ui';
import { StripePaymentModal } from '@/components/StripePaymentModal';
import { useBookings } from '@/hooks/useBookings';
import { useCustomerInvoices } from '@/hooks/useInvoices';
import { usePublicTenantLegal } from '@/hooks/useTenantLegal';
import type { Booking, Invoice } from '@/types/api';
import { daysUntil, isLiveInvoice, moneyText } from '../bookings/customer.portal';
import { getPortalStyles, linkButton, pill } from '../bookings/customer.styles';
import { useOccasion } from '../bookings/PortalParts';

const NO_INVOICES: Invoice[] = [];

const VISUALLY_HIDDEN: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
};

/**
 * The client's invoices — every one, what is open, and the way to pay it.
 *
 * <p>Built on the invoices themselves, not on the bookings' agreed totals. The
 * page before it derived a payment schedule from each booking and put it next
 * to the real invoices, so the same money appeared twice under two different
 * figures, beside a "How payment works" panel and a messaging button that was
 * never built. What is owed is what an invoice says; a booking with no invoice
 * yet owes nothing.
 */
export default function PaymentsPage() {
  const { t, format } = useTranslation();
  const { theme } = useThemeStore();
  const c = useMemo(() => getColors(theme), [theme]);
  const s = getPortalStyles(c);
  const occasion = useOccasion();
  const subdomain = useAuthStore((st) => st.user?.tenant?.subdomain ?? null);

  const invoicesQ = useCustomerInvoices();
  const bookingsQ = useBookings(false);
  const legalQ = usePublicTenantLegal(subdomain);
  const [paying, setPaying] = useState<Invoice | null>(null);

  const invoices = useMemo(
    () =>
      (invoicesQ.data ?? NO_INVOICES)
        .filter(isLiveInvoice)
        .sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt)),
    [invoicesQ.data]
  );
  const bookingById = useMemo(
    () => new Map((bookingsQ.data ?? []).map((b) => [b.id, b] as const)),
    [bookingsQ.data]
  );

  const open = invoices.reduce((sum, i) => sum + Math.max(i.outstandingCents, 0), 0);
  const paid = invoices.reduce((sum, i) => sum + i.paidCents, 0);
  // The next thing to pay: the open invoice whose shoot comes first.
  const today = startOfToday();
  const next = invoices
    .filter((i) => i.outstandingCents > 0)
    .map((i) => ({ invoice: i, booking: i.bookingId ? bookingById.get(i.bookingId) : undefined }))
    .sort((a, b) => shootTime(a.booking) - shootTime(b.booking))[0];
  const nextDate =
    next?.booking && daysUntil(next.booking.eventDate, today) >= 0 ? next.booking.eventDate : null;

  const studioName = legalQ.data?.legalName?.trim() || null;
  const studioEmail = legalQ.data?.legalEmail?.trim() || null;

  return (
    <div style={{ ...s.page, maxWidth: 1040, gap: 28 }}>
      <header style={s.headerText}>
        <h1 style={{ ...pageTitle, margin: 0 }}>{t('portal.payments.title')}</h1>
        <p style={s.subtitle}>
          {studioName
            ? t('portal.payments.subtitle', { studio: studioName })
            : t('portal.payments.subtitleNoStudio')}
        </p>
      </header>

      {invoicesQ.isLoading && <Note>{t('invoices.loading')}</Note>}
      {invoicesQ.isError && <Alert tone="danger">{t('invoices.error')}</Alert>}

      {!invoicesQ.isLoading && !invoicesQ.isError && invoices.length === 0 && (
        <div style={s.card}>
          <p style={s.empty}>{t('invoices.empty')}</p>
        </div>
      )}

      {invoices.length > 0 && (
        <>
          <div
            style={{
              ...s.card,
              display: 'flex',
              alignItems: 'center',
              gap: 40,
              padding: '20px 24px',
              flexWrap: 'wrap',
            }}
          >
            <Figure
              label={t('bookings.detail.open')}
              value={moneyText(open, format)}
              muted={c.textSubtle}
            />
            <Figure
              label={t('bookings.detail.paid')}
              value={moneyText(paid, format)}
              muted={c.textSubtle}
            />
            <span style={{ flex: '1 1 200px', fontSize: fontSize.md, color: c.textMuted }}>
              {next
                ? nextDate
                  ? t('portal.payments.nextDue', {
                      amount: moneyText(next.invoice.outstandingCents, format),
                      date: format.dayMonthYearLong(nextDate),
                    })
                  : null
                : t('portal.payments.allPaid')}
            </span>
            {next && (
              <Button variant="primary" onClick={() => setPaying(next.invoice)}>
                {t('invoices.pay', { amount: moneyText(next.invoice.outstandingCents, format) })}
              </Button>
            )}
          </div>

          <section aria-labelledby="pay-invoices" style={s.section}>
            <h2 id="pay-invoices" style={s.h2}>
              {t('invoices.title')}
            </h2>
            <div style={{ ...s.card, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: fontSize.md }}>
                <thead>
                  <tr>
                    {(
                      [
                        ['portal.payments.col.invoice', 'left'],
                        ['portal.payments.col.shoot', 'left'],
                        ['portal.payments.col.date', 'left'],
                        ['portal.payments.col.amount', 'right'],
                        ['portal.payments.col.status', 'left'],
                      ] as const
                    ).map(([key, align]) => (
                      <th
                        key={key}
                        scope="col"
                        style={{
                          textAlign: align,
                          fontWeight: 500,
                          fontSize: fontSize.base,
                          color: c.textSubtle,
                          padding: '10px 16px',
                          borderBottom: `1px solid ${c.border}`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t(key)}
                      </th>
                    ))}
                    <th scope="col" style={{ borderBottom: `1px solid ${c.border}` }}>
                      <span style={VISUALLY_HIDDEN}>{t('portal.payments.col.actions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv, i) => {
                    const booking = inv.bookingId ? bookingById.get(inv.bookingId) : undefined;
                    const settled = inv.outstandingCents <= 0;
                    const cell: React.CSSProperties = {
                      padding: '14px 16px',
                      borderTop: i > 0 ? `1px solid ${c.borderSoft}` : undefined,
                      whiteSpace: 'nowrap',
                      verticalAlign: 'middle',
                    };
                    const pdf = linkButton(c, 'ghost');
                    return (
                      <tr key={inv.id}>
                        <td style={{ ...cell, fontWeight: 500 }}>{inv.invoiceNumber}</td>
                        <td style={{ ...cell, color: c.textMuted }}>
                          {booking ? occasion(booking.eventType) : '—'}
                        </td>
                        <td style={{ ...cell, color: c.textMuted }}>
                          {format.dayMonthYearLong(inv.issuedAt)}
                        </td>
                        <td
                          style={{
                            ...cell,
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {moneyText(inv.totalCents, format)}
                        </td>
                        <td style={cell}>
                          {settled ? (
                            <span style={pill(c.successText, c.successBg)}>
                              {t('invoices.paid')}
                            </span>
                          ) : (
                            <span style={pill(c.warningText, c.warningBg)}>
                              {inv.paidCents > 0
                                ? t('invoices.partiallyPaid', {
                                    amount: moneyText(inv.paidCents, format),
                                  })
                                : t('bookings.detail.open')}
                            </span>
                          )}
                        </td>
                        <td style={{ ...cell, textAlign: 'right' }}>
                          <span style={{ display: 'inline-flex', gap: 8 }}>
                            {!settled && (
                              <Button onClick={() => setPaying(inv)}>
                                {t('portal.todo.payAction')}
                              </Button>
                            )}
                            {inv.pdfDownloadUrl && (
                              <a
                                href={inv.pdfDownloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={t('portal.payments.pdfFor', {
                                  number: inv.invoiceNumber,
                                })}
                                className={pdf.className}
                                style={pdf.style}
                              >
                                PDF
                              </a>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {invoices.some((i) => i.outstandingCents > 0) && (
              <p style={{ ...s.rowMeta, margin: 0 }}>
                {t('invoices.bankTransferHint', {
                  reference: invoices
                    .filter((i) => i.outstandingCents > 0)
                    .map((i) => i.verwendungszweck)
                    .join(', '),
                })}
              </p>
            )}
            {studioEmail && (
              <p style={{ ...s.rowMeta, margin: 0 }}>
                {t('portal.payments.questions')}{' '}
                <a href={`mailto:${studioEmail}`} style={{ color: c.textMuted }}>
                  {studioEmail}
                </a>
              </p>
            )}
          </section>
        </>
      )}

      {paying && (
        <StripePaymentModal
          invoice={paying}
          outstandingCents={paying.outstandingCents}
          onClose={() => setPaying(null)}
        />
      )}
    </div>
  );
}

function shootTime(b: Booking | undefined): number {
  return b ? Date.parse(b.eventDate) : Number.MAX_SAFE_INTEGER;
}

function Figure({ label, value, muted }: { label: string; value: string; muted: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: fontSize.base, color: muted }}>{label}</span>
      <span
        style={{
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  );
}
