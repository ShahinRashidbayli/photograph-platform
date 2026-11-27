'use client';

import React from 'react';
import Link from 'next/link';
import { useClient } from '@/hooks/useClients';
import { Badge } from '@/components/ui';
import { getBookingStatusMeta } from '@/lib/booking-status';
import { parseApiDate } from '@/lib/date';
import { useTranslation, type TranslationKey } from '@/lib/i18n';
import type { Invoice } from '@/types/api';

type Styles = Record<string, React.CSSProperties>;

/**
 * What the studio holds on one client: their bookings in every status, and
 * the galleries, invoices and contracts on those bookings. Every row links to
 * the screen that owns it. Invoices and contracts are managed on their
 * booking, so that is where they lead.
 */
export function ClientRecords({ clientId, s }: Readonly<{ clientId: string; s: Styles }>) {
  const { t, tPlural, format } = useTranslation();
  const detail = useClient(clientId);

  if (detail.isLoading) {
    return <div style={s.recordEmpty}>{t('clientDetail.records.loading')}</div>;
  }
  if (detail.isError || !detail.data) {
    return <div style={s.recordEmpty}>{t('clientDetail.records.error')}</div>;
  }
  const { bookings, galleries, invoices, contracts } = detail.data;

  return (
    <>
      <RecordSection
        title={t('clientDetail.records.bookings')}
        empty={t('clientDetail.records.noBookings')}
        s={s}
        rows={bookings.map((b) => ({
          key: b.id,
          href: `/bookings?id=${encodeURIComponent(b.id)}`,
          title: b.eventType || b.clientName,
          meta: format.monthDayYear(parseApiDate(b.eventDate)),
          badge: t(getBookingStatusMeta(b.status).labelKey),
        }))}
      />
      <RecordSection
        title={t('clientDetail.records.galleries')}
        empty={t('clientDetail.records.noGalleries')}
        s={s}
        rows={galleries.map((g) => ({
          key: g.id,
          href: `/galleries?id=${encodeURIComponent(g.id)}`,
          title: g.eventType || g.bookingName,
          meta: [
            g.shootDate ? format.monthDayYear(parseApiDate(g.shootDate)) : null,
            tPlural('galleries.photoCount', g.photoCount),
          ]
            .filter(Boolean)
            .join(' · '),
          badge: g.expiryState === 'ACTIVE' ? null : t('galleries.expiry.expired'),
        }))}
      />
      <RecordSection
        title={t('clientDetail.records.invoices')}
        empty={t('clientDetail.records.noInvoices')}
        s={s}
        rows={invoices.map((i) => ({
          key: i.id,
          href: i.bookingId ? `/bookings?id=${encodeURIComponent(i.bookingId)}` : null,
          title: i.invoiceNumber,
          meta: `${format.eur(i.totalCents)} · ${format.monthDayYear(i.issuedAt)}`,
          badge: t(invoiceLabelKey(i)),
        }))}
      />
      <RecordSection
        title={t('clientDetail.records.contracts')}
        empty={t('clientDetail.records.noContracts')}
        s={s}
        rows={contracts.map((k) => ({
          key: k.id,
          href: `/bookings?id=${encodeURIComponent(k.bookingId)}`,
          title: k.title,
          meta: format.monthDayYear(k.signedAt ?? k.sentAt ?? k.createdAt),
          badge: t(`contracts.status.${k.status}` as TranslationKey),
        }))}
      />
    </>
  );
}

/**
 * The same label `BookingInvoices` gives the invoice, read off the server's
 * Settlement flags (ADR-004) — never worked out here.
 */
function invoiceLabelKey(invoice: Invoice): TranslationKey {
  if (!invoice.live) {
    return invoice.stornoOfId !== null
      ? 'invoices.manage.status.storno'
      : 'invoices.manage.status.cancelled';
  }
  if (invoice.overdue) return 'invoices.manage.status.overdue';
  return invoice.collectable ? 'invoices.manage.status.open' : 'invoices.manage.status.paid';
}

interface RecordRow {
  key: string;
  /** Null for a record with nowhere to go, e.g. an invoice whose booking was deleted. */
  href: string | null;
  title: string;
  meta: string;
  badge: string | null;
}

function RecordSection({
  title,
  empty,
  rows,
  s,
}: Readonly<{ title: string; empty: string; rows: RecordRow[]; s: Styles }>) {
  return (
    <section style={s.section} aria-label={title}>
      <span style={s.sectionTitle}>
        {title} · {rows.length}
      </span>
      {rows.length === 0 ? (
        <div style={s.recordEmpty}>{empty}</div>
      ) : (
        <div style={s.recordList}>
          {rows.map((row, index) => {
            const style = { ...s.recordRow, ...(index === 0 ? { borderTop: 'none' } : {}) };
            const content = (
              <>
                <span style={s.recordMain}>
                  <span style={s.recordTitle}>{row.title}</span>
                  <span style={s.recordMeta}>{row.meta}</span>
                </span>
                {row.badge ? <Badge>{row.badge}</Badge> : null}
              </>
            );
            return row.href ? (
              <Link key={row.key} href={row.href} className="ui-row-hover" style={style}>
                {content}
              </Link>
            ) : (
              <div key={row.key} style={style}>
                {content}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
