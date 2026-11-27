'use client';

import React from 'react';
import Link from 'next/link';
import { useClient } from '@/hooks/useClients';
import { Badge, useColors } from '@/components/ui';
import { useEntitlements } from '@/hooks/useEntitlements';
import { getBookingStatusMeta } from '@/lib/booking-status';
import { parseApiDate } from '@/lib/date';
import { useTranslation, type TranslationKey } from '@/lib/i18n';
import { INVOICE_STATUS, invoiceStatus, invoiceToneColors } from '@/lib/invoice-status';
import type { Gallery } from '@/hooks/useGalleries';

type Styles = Record<string, React.CSSProperties>;

// The galleries screen's own labels, so a deleted gallery is not called expired.
const GALLERY_STATE_LABEL: Record<Gallery['expiryState'], TranslationKey | null> = {
  ACTIVE: null,
  EXPIRED: 'galleries.detail.statusExpired',
  PURGED: 'galleries.detail.statusPurged',
};

/**
 * What the studio holds on one client: their bookings in every status, and
 * the galleries, invoices and contracts on those bookings. Every row links to
 * the screen that owns it. Invoices and contracts are managed on their
 * booking, so that is where they lead. Contracts are shown only on plans that
 * have them, as on the bookings page.
 */
export function ClientRecords({ clientId, s }: Readonly<{ clientId: string; s: Styles }>) {
  const { t, tPlural, format } = useTranslation();
  const c = useColors();
  const contractsEnabled = useEntitlements().has('CONTRACTS');
  const detail = useClient(clientId);

  if (detail.isLoading) {
    return <div style={s.recordEmpty}>{t('clientDetail.records.loading')}</div>;
  }
  if (detail.isError || !detail.data) {
    return <div style={s.recordEmpty}>{t('clientDetail.records.error')}</div>;
  }
  const { bookings, galleries, invoices, contracts } = detail.data;
  const badgeOf = (key: TranslationKey | null) => (key ? { label: t(key) } : null);
  // Coloured as on the booking's own invoice list: the same invoice, the same pill.
  const invoiceBadge = (invoice: (typeof invoices)[number]) => {
    const { labelKey, tone } = INVOICE_STATUS[invoiceStatus(invoice)];
    const { fg, bg } = invoiceToneColors(tone, c);
    return { label: t(labelKey), tone: fg, background: bg };
  };

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
          badge: { label: t(getBookingStatusMeta(b.status).labelKey) },
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
          badge: badgeOf(GALLERY_STATE_LABEL[g.expiryState]),
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
          badge: invoiceBadge(i),
        }))}
      />
      {contractsEnabled ? (
        <RecordSection
          title={t('clientDetail.records.contracts')}
          empty={t('clientDetail.records.noContracts')}
          s={s}
          rows={contracts.map((k) => ({
            key: k.id,
            href: `/bookings?id=${encodeURIComponent(k.bookingId)}`,
            title: k.title,
            meta: format.monthDayYear(k.signedAt ?? k.sentAt ?? k.createdAt),
            badge: { label: t(`contracts.status.${k.status}` as TranslationKey) },
          }))}
        />
      ) : null}
    </>
  );
}

interface RecordRow {
  key: string;
  /** Null for a record with nowhere to go — `Invoice.bookingId` is nullable in the type. */
  href: string | null;
  title: string;
  meta: string;
  badge: { label: string; tone?: string; background?: string } | null;
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
                {row.badge ? (
                  <Badge tone={row.badge.tone} background={row.badge.background}>
                    {row.badge.label}
                  </Badge>
                ) : null}
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
