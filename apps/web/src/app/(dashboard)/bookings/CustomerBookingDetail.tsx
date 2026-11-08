'use client';

import React from 'react';
import Link from 'next/link';
import type { Booking, Invoice } from '@/types/api';
import type { getColors } from '@/lib/design-tokens';
import { fontSize, pageTitle, radius, space } from '@/lib/design-tokens';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui';
import {
  contractsFor,
  daysUntil,
  galleryFor,
  icsFor,
  invoicesFor,
  isCancelled,
  moneyText,
  stepsFor,
  type PortalData,
} from './customer.portal';
import { getPortalStyles, linkButton, pill } from './customer.styles';
import {
  BookingStatusPill,
  PortalIcon,
  StepBar,
  initialsOf,
  useOccasion,
  type StudioContact,
} from './PortalParts';
import { relativeDay } from './BookingProgress';

type Colors = ReturnType<typeof getColors>;

type Props = {
  booking: Booking | null;
  data: PortalData;
  studio: StudioContact;
  subdomain: string | null;
  colors: Colors;
  onPay: (_invoice: Invoice) => void;
};

/**
 * One shoot, from the client's side: when and where, then what is left to do
 * in the order it happens — sign, pay, receive the photos.
 *
 * <p>It used to be a side panel of a list copied from the studio's screen, with
 * the contract on another page entirely and a due date that read "11 days
 * before your session" when it was the session's own date.
 */
export function CustomerBookingDetail({
  booking,
  data,
  studio,
  subdomain,
  colors: c,
  onPay,
}: Props) {
  const { t, tPlural, format } = useTranslation();
  const s = getPortalStyles(c);
  const occasion = useOccasion();

  const back = (
    <Link
      href="/bookings"
      style={{
        alignSelf: 'flex-start',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: fontSize.md,
        color: c.textMuted,
        textDecoration: 'none',
        padding: '6px 0',
      }}
    >
      {PortalIcon.back}
      {t('portal.detail.back')}
    </Link>
  );

  if (!booking) {
    return (
      <div style={{ ...s.page, gap: space.xxl }}>
        {back}
        <div style={s.card}>
          <p style={s.empty}>{t('portal.detail.notFound')}</p>
        </div>
      </div>
    );
  }

  const cancelled = isCancelled(booking);
  const days = daysUntil(booking.eventDate, data.today);
  const ahead = !cancelled && days >= 0 && booking.status !== 'COMPLETED';
  const contracts = contractsFor(booking.id, data.contracts);
  const invoices = invoicesFor(booking.id, data.invoices);
  const gallery = galleryFor(booking.id, data.galleries);
  const total = booking.totalAmountCents;
  const paid = booking.amountPaidCents ?? 0;
  const open = Math.max(total - paid, 0);
  const paidInFull = booking.paymentState === 'PAID' || (total > 0 && open === 0);
  const showPayment = !cancelled && (total > 0 || invoices.length > 0);
  const time = booking.eventTime?.slice(0, 5) ?? null;

  // Numbered in the order the client meets them; a section that does not
  // apply takes no number, so the count never skips.
  let n = 0;
  const number = () => ++n;

  return (
    <div style={{ ...s.page, maxWidth: 1040, gap: 28 }}>
      {back}

      <header style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={s.shootTop}>
          <div style={s.headerText}>
            <h1 style={{ ...pageTitle, margin: 0 }}>{occasion(booking.eventType)}</h1>
            <p style={s.subtitle}>
              {[
                format.dayMonthYearLong(booking.eventDate),
                time,
                ahead ? relativeDay(days, t, tPlural) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <BookingStatusPill booking={booking} hasGallery={gallery !== null} colors={c} />
        </div>
        <StepBar steps={stepsFor(booking, data)} booking={booking} colors={c} />
      </header>

      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div
          style={{
            flex: '2 1 520px',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {cancelled ? (
            <div style={s.card}>
              <p style={s.empty}>{t('portal.detail.cancelled')}</p>
            </div>
          ) : (
            <>
              <h2 style={s.h2}>{t('portal.detail.nextSteps')}</h2>

              {contracts.length > 0 && (
                <StepCard
                  number={number()}
                  active={contracts.some((k) => k.status === 'SENT')}
                  title={
                    contracts.some((k) => k.status === 'SENT')
                      ? t('portal.todo.sign')
                      : t('portal.detail.contract')
                  }
                  colors={c}
                >
                  {contracts.map((k) => {
                    const toSign = k.status === 'SENT';
                    const action = linkButton(c, toSign ? 'primary' : 'ghost');
                    const when = toSign ? k.sentAt : k.signedAt;
                    return (
                      <div
                        key={k.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}
                      >
                        <span style={{ ...s.rowText, flex: '1 1 240px' }}>
                          <span style={{ ...s.rowTitle, fontSize: fontSize.md }}>{k.title}</span>
                          {when && (
                            <span style={s.rowMeta}>
                              {toSign
                                ? t('portal.detail.contractSent', {
                                    date: format.dayMonthYearLong(when),
                                  })
                                : t('portal.detail.contractSigned', {
                                    date: format.dayMonthYearLong(when),
                                  })}
                            </span>
                          )}
                        </span>
                        <Link
                          href={`/documents?id=${k.id}`}
                          className={action.className}
                          style={action.style}
                        >
                          {toSign ? t('portal.todo.signAction') : t('portal.detail.contractView')}
                        </Link>
                      </div>
                    );
                  })}
                  {contracts.some((k) => k.status === 'SENT') && (
                    <p style={{ ...s.rowMeta, margin: 0 }}>{t('portal.detail.contractNote')}</p>
                  )}
                </StepCard>
              )}

              {showPayment && (
                <StepCard
                  number={number()}
                  active={!paidInFull}
                  title={paidInFull ? t('portal.detail.paidTitle') : t('portal.detail.payTitle')}
                  colors={c}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                      gap: 12,
                    }}
                  >
                    <Figure
                      label={t('bookings.detail.total')}
                      value={moneyText(total, format)}
                      colors={c}
                    />
                    <Figure
                      label={t('bookings.detail.paid')}
                      value={moneyText(paid, format)}
                      colors={c}
                    />
                    <Figure
                      label={t('bookings.detail.open')}
                      value={moneyText(open, format)}
                      colors={c}
                    />
                  </div>
                  {total > 0 && (
                    <div
                      role="progressbar"
                      aria-label={t('bookings.detail.paid')}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.min(100, Math.round((paid / total) * 100))}
                      style={{
                        height: 6,
                        borderRadius: 3,
                        background: c.borderSoft,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, (paid / total) * 100)}%`,
                          height: 6,
                          background: c.primarySolid,
                        }}
                      />
                    </div>
                  )}
                  {!paidInFull && open > 0 && ahead && (
                    <p style={{ ...s.rowMeta, margin: 0 }}>
                      {t('portal.detail.dueBy', {
                        date: format.dayMonthYearLong(booking.eventDate),
                      })}
                    </p>
                  )}
                  {invoices.length === 0 ? (
                    <p style={{ ...s.rowMeta, margin: 0 }}>{t('invoices.emptyForBooking')}</p>
                  ) : (
                    <div style={{ borderTop: `1px solid ${c.borderSoft}` }}>
                      {invoices.map((inv) => (
                        <InvoiceRow key={inv.id} invoice={inv} colors={c} onPay={onPay} />
                      ))}
                    </div>
                  )}
                </StepCard>
              )}

              <StepCard
                number={number()}
                active={gallery !== null}
                muted={gallery === null}
                title={t('portal.detail.photos')}
                colors={c}
              >
                {gallery ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    {gallery.coverUrl && (
                      // eslint-disable-next-line @next/next/no-img-element -- a presigned R2 URL; the image optimizer stays off for these
                      <img
                        src={gallery.coverUrl}
                        alt=""
                        style={{ width: 72, height: 72, borderRadius: 10, objectFit: 'cover' }}
                      />
                    )}
                    <span style={{ ...s.rowText, flex: '1 1 200px' }}>
                      <span style={{ ...s.rowTitle, fontSize: fontSize.md }}>
                        {tPlural('portal.meta.photos', gallery.photoCount)}
                      </span>
                      {gallery.expiresAt && (
                        <span style={s.rowMeta}>
                          {t('portal.meta.until', {
                            date: format.dayMonthYearLong(gallery.expiresAt),
                          })}
                        </span>
                      )}
                    </span>
                    {subdomain && (
                      <a
                        href={`/g/${subdomain}/${gallery.accessToken}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        {...linkButton(c, 'primary')}
                      >
                        {t('portal.todo.photosAction')}
                      </a>
                    )}
                  </div>
                ) : (
                  <p style={{ ...s.rowMeta, margin: 0, fontSize: fontSize.md }}>
                    {t('portal.detail.photosPending')}
                  </p>
                )}
              </StepCard>
            </>
          )}
        </div>

        <aside
          style={{
            flex: '1 1 280px',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <section
            aria-labelledby="portal-when"
            style={{
              ...s.card,
              padding: '20px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <h2 id="portal-when" style={{ ...s.h2, fontSize: '15px' }}>
              {t('portal.detail.when')}
            </h2>
            <dl
              style={{
                margin: 0,
                display: 'grid',
                gridTemplateColumns: '76px 1fr',
                gap: '10px 12px',
                fontSize: fontSize.md,
              }}
            >
              <dt style={{ color: c.textSubtle }}>{t('portal.detail.date')}</dt>
              <dd style={{ margin: 0 }}>{format.fullDate(booking.eventDate)}</dd>
              {time && (
                <>
                  <dt style={{ color: c.textSubtle }}>{t('portal.detail.time')}</dt>
                  <dd style={{ margin: 0 }}>{time}</dd>
                </>
              )}
              {booking.location && (
                <>
                  <dt style={{ color: c.textSubtle }}>{t('portal.detail.place')}</dt>
                  <dd style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span>{booking.location}</span>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: fontSize.base, color: c.textMuted }}
                    >
                      {t('portal.detail.map')}
                    </a>
                  </dd>
                </>
              )}
            </dl>
            {ahead && (
              <Button
                style={{ alignSelf: 'flex-start' }}
                onClick={() => downloadIcs(booking, occasion(booking.eventType))}
              >
                {t('portal.detail.addToCalendar')}
              </Button>
            )}
          </section>

          {(studio.name || studio.email || studio.phone) && (
            <section
              aria-labelledby="portal-contact"
              style={{
                ...s.card,
                padding: '20px 22px',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <h2 id="portal-contact" style={{ ...s.h2, fontSize: '15px' }}>
                {t('portal.contact.heading')}
              </h2>
              {studio.name && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span aria-hidden style={s.avatar}>
                    {initialsOf(studio.name)}
                  </span>
                  <span style={{ fontSize: fontSize.md, fontWeight: 500 }}>{studio.name}</span>
                </div>
              )}
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: fontSize.md }}
              >
                {studio.email && (
                  <a href={`mailto:${studio.email}`} style={{ color: c.text }}>
                    {studio.email}
                  </a>
                )}
                {studio.phone && (
                  <a href={`tel:${studio.phone.replace(/[^\d+]/g, '')}`} style={{ color: c.text }}>
                    {studio.phone}
                  </a>
                )}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

/** Hands the browser a one-event .ics, which every calendar app opens. */
function downloadIcs(booking: Booking, title: string) {
  const blob = new Blob([icsFor(booking, title, new Date())], {
    type: 'text/calendar;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'shooting'}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function StepCard({
  number,
  title,
  active,
  muted = false,
  colors: c,
  children,
}: {
  number: number;
  title: string;
  active: boolean;
  muted?: boolean;
  colors: Colors;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: muted ? c.surfaceAlt : c.surface,
        border: `1px ${muted ? 'dashed' : 'solid'} ${c.border}`,
        borderRadius: radius.card,
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <h3
        style={{
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: '15px',
          fontWeight: 600,
          color: muted ? c.textMuted : c.text,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: fontSize.sm,
            fontWeight: 600,
            ...(active
              ? { background: c.primarySolid, color: c.onPrimary }
              : { border: `1px solid ${c.border}`, color: c.textMuted }),
          }}
        >
          {number}
        </span>
        {title}
      </h3>
      <div style={{ paddingLeft: 34, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {children}
      </div>
    </section>
  );
}

function Figure({ label, value, colors: c }: { label: string; value: string; colors: Colors }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: fontSize.base, color: c.textSubtle }}>{label}</span>
      <span
        style={{
          fontSize: fontSize.xl,
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

/**
 * One invoice: what it is, whether it is settled, its PDF, and — while money
 * is open — the pay action and the transfer reference for those who prefer
 * their bank.
 */
function InvoiceRow({
  invoice,
  colors: c,
  onPay,
}: {
  invoice: Invoice;
  colors: Colors;
  onPay: (_invoice: Invoice) => void;
}) {
  const { t, format } = useTranslation();
  const s = getPortalStyles(c);
  const settled = invoice.outstandingCents <= 0;
  const pdf = linkButton(c, 'ghost');
  return (
    <div
      style={{
        padding: '12px 0',
        borderBottom: `1px solid ${c.borderSoft}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ ...s.rowText, flex: '1 1 220px' }}>
          <span style={{ ...s.rowTitle, fontSize: fontSize.md }}>
            {t('invoices.number', { number: invoice.invoiceNumber })} ·{' '}
            {moneyText(invoice.totalCents, format)}
          </span>
          <span style={s.rowMeta}>
            {[
              t('portal.detail.invoiceIssued', { date: format.dayMonthYearLong(invoice.issuedAt) }),
              !settled && invoice.paidCents > 0
                ? t('invoices.partiallyPaid', { amount: moneyText(invoice.paidCents, format) })
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
        {settled ? (
          <span style={pill(c.successText, c.successBg)}>{t('invoices.paid')}</span>
        ) : (
          <span style={pill(c.warningText, c.warningBg)}>{t('bookings.detail.open')}</span>
        )}
        {invoice.pdfDownloadUrl && (
          <a
            href={invoice.pdfDownloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('portal.payments.pdfFor', { number: invoice.invoiceNumber })}
            className={pdf.className}
            style={pdf.style}
          >
            PDF
          </a>
        )}
        {!settled && (
          <Button onClick={() => onPay(invoice)}>
            {t('invoices.pay', { amount: moneyText(invoice.outstandingCents, format) })}
          </Button>
        )}
      </div>
      {!settled && (
        <p style={{ ...s.rowMeta, margin: 0 }}>
          {t('invoices.bankTransferHint', { reference: invoice.verwendungszweck })}
        </p>
      )}
    </div>
  );
}
