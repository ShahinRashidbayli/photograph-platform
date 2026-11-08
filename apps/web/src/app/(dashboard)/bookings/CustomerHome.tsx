'use client';

import React from 'react';
import Link from 'next/link';
import type { Booking, Invoice } from '@/types/api';
import type { CustomerInquiryRequest } from '@/hooks/useInquiryRequests';
import type { getColors } from '@/lib/design-tokens';
import { pageTitle } from '@/lib/design-tokens';
import { parseApiDate } from '@/lib/date';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui';
import {
  budgetLabel,
  daysUntil,
  galleryFor,
  moneyText,
  openRequests,
  splitShoots,
  stepsFor,
  todosFor,
  type PortalData,
  type Todo,
} from './customer.portal';
import { getPortalStyles, linkButton, pill } from './customer.styles';
import {
  BookingStatusPill,
  ContactFooter,
  PortalIcon,
  StepBar,
  useOccasion,
  type StudioContact,
} from './PortalParts';
import { relativeDay } from './BookingProgress';

type Colors = ReturnType<typeof getColors>;

type Props = {
  greeting: string | null;
  bookings: Booking[];
  data: PortalData;
  requests: CustomerInquiryRequest[];
  studio: StudioContact;
  subdomain: string | null;
  colors: Colors;
  onPay: (_invoice: Invoice) => void;
  onRequest: () => void;
};

/**
 * The client's front page: what is waiting on them, their shoots, and the
 * requests the photographer has not answered yet.
 *
 * <p>Replaces a list/detail screen copied from the studio's bookings page,
 * where the client had to find out for themselves that a contract was waiting
 * on the Documents page and an invoice on the Payments page.
 */
export function CustomerHome({
  greeting,
  bookings,
  data,
  requests,
  studio,
  subdomain,
  colors: c,
  onPay,
  onRequest,
}: Props) {
  const { t, tPlural, format } = useTranslation();
  const s = getPortalStyles(c);
  const occasion = useOccasion();

  const todos = todosFor(bookings, data);
  const { upcoming, past } = splitShoots(bookings, data.today);
  const waiting = openRequests(requests);

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.headerText}>
          <h1 style={{ ...pageTitle, margin: 0 }}>
            {greeting ? t('portal.hello', { name: greeting }) : t('portal.welcome')}
          </h1>
          <p style={s.subtitle}>
            {studio.name
              ? t('portal.subtitle', { studio: studio.name })
              : t('portal.subtitleNoStudio')}
          </p>
        </div>
        <Button onClick={onRequest}>
          {PortalIcon.plus}
          {t('portal.request')}
        </Button>
      </header>

      <section aria-labelledby="portal-todo" style={s.section}>
        <div style={s.sectionHead}>
          <h2 id="portal-todo" style={s.h2}>
            {t('portal.todo.title')}
          </h2>
          {todos.length > 0 && <span style={s.count}>{todos.length}</span>}
        </div>
        <div style={s.card}>
          {todos.length === 0 ? (
            <p style={s.empty}>{t('portal.todo.none')}</p>
          ) : (
            todos.map((todo, i) => (
              <TodoRow
                key={`${todo.kind}:${todo.id}`}
                todo={todo}
                primary={i === 0}
                divided={i > 0}
                subdomain={subdomain}
                today={data.today}
                colors={c}
                onPay={onPay}
              />
            ))
          )}
        </div>
      </section>

      <section aria-labelledby="portal-shoots" style={s.section}>
        <h2 id="portal-shoots" style={s.h2}>
          {t('portal.shoots.title')}
        </h2>
        {bookings.length === 0 && (
          <div style={s.card}>
            <p style={s.empty}>{t('portal.shoots.none')}</p>
          </div>
        )}
        {upcoming.map((b) => {
          const date = parseApiDate(b.eventDate);
          const days = daysUntil(b.eventDate, data.today);
          const where = [b.eventTime?.slice(0, 5), b.location].filter(Boolean).join(' · ');
          return (
            <Link key={b.id} href={`/bookings?id=${b.id}`} className="ui-row-hover" style={s.shoot}>
              <div style={s.dateBlock}>
                <span style={s.dateSmall}>{format.weekdayShort(date)}</span>
                <span style={s.dateDay}>{date.getDate()}</span>
                <span style={s.dateSmall}>{format.monthYear(date)}</span>
              </div>
              <div style={s.shootBody}>
                <div style={s.shootTop}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                    <span style={s.shootTitle}>{occasion(b.eventType)}</span>
                    {where && <span style={s.shootMeta}>{where}</span>}
                  </div>
                  <span style={pill(c.neutralText, c.neutralBg)}>
                    {relativeDay(days, t, tPlural)}
                  </span>
                </div>
                <StepBar steps={stepsFor(b, data)} booking={b} colors={c} />
              </div>
            </Link>
          );
        })}
        {past.map((b) => (
          <Link key={b.id} href={`/bookings?id=${b.id}`} className="ui-row-hover" style={s.pastRow}>
            <span style={s.pastDate}>{format.monthDayYear(b.eventDate)}</span>
            <span style={{ ...s.rowText, flex: '1 1 240px' }}>
              <span style={s.rowTitle}>{occasion(b.eventType)}</span>
              {b.location && <span style={s.rowMeta}>{b.location}</span>}
            </span>
            <BookingStatusPill
              booking={b}
              hasGallery={galleryFor(b.id, data.galleries) !== null}
              colors={c}
            />
            <span style={s.chevron}>{PortalIcon.chevron}</span>
          </Link>
        ))}
      </section>

      {waiting.length > 0 && (
        <section aria-labelledby="portal-requests" style={s.section}>
          <h2 id="portal-requests" style={s.h2}>
            {t('portal.requests.title')}
          </h2>
          <div style={s.card}>
            {waiting.map((r, i) => (
              <div key={r.id} style={{ ...s.row, ...(i > 0 ? s.rowDivider : null) }}>
                <span style={{ ...s.pastDate, width: 84 }}>
                  {r.proposedDate ? format.monthDayYear(r.proposedDate) : '—'}
                </span>
                <span style={s.rowText}>
                  <span style={s.rowTitle}>
                    {t('portal.requests.wish', { occasion: occasion(r.eventType) })}
                  </span>
                  <span style={s.rowMeta}>
                    {[
                      t('portal.requests.sent', { date: format.dayMonth(r.createdAt) }),
                      r.location,
                      budgetLabel(r.budgetRange),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                {r.status === 'PENDING' ? (
                  <span style={pill(c.neutralText, c.neutralBg)}>
                    {t('portal.requests.pending')}
                  </span>
                ) : (
                  <span style={pill(c.textSubtle, c.surfaceAlt)}>
                    {t('portal.requests.declined')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <ContactFooter studio={studio} colors={c} />
    </div>
  );
}

function TodoRow({
  todo,
  primary,
  divided,
  subdomain,
  today,
  colors: c,
  onPay,
}: {
  todo: Todo;
  primary: boolean;
  divided: boolean;
  subdomain: string | null;
  today: Date;
  colors: Colors;
  onPay: (_invoice: Invoice) => void;
}) {
  const { t, tPlural, format } = useTranslation();
  const s = getPortalStyles(c);
  const occasion = useOccasion();
  const action = linkButton(c, primary ? 'primary' : 'secondary');
  const rowStyle = { ...s.row, ...(divided ? s.rowDivider : null) };
  const shootOf = (b: Booking | null) =>
    b ? `${occasion(b.eventType)}, ${format.dayMonthYearLong(b.eventDate)}` : null;
  const join = (parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(' · ');

  if (todo.kind === 'sign') {
    return (
      <div style={rowStyle}>
        <span aria-hidden style={s.rowIcon}>
          {PortalIcon.contract}
        </span>
        <span style={s.rowText}>
          <span style={s.rowTitle}>{t('portal.todo.sign')}</span>
          <span style={s.rowMeta}>{join([todo.contract.title, shootOf(todo.booking)])}</span>
        </span>
        <Link
          href={`/documents?id=${todo.contract.id}`}
          className={action.className}
          style={action.style}
        >
          {t('portal.todo.signAction')}
        </Link>
      </div>
    );
  }

  if (todo.kind === 'pay') {
    const { invoice, booking } = todo;
    const ahead = booking && daysUntil(booking.eventDate, today) >= 0;
    return (
      <div style={rowStyle}>
        <span aria-hidden style={s.rowIcon}>
          {PortalIcon.card}
        </span>
        <span style={s.rowText}>
          <span style={s.rowTitle}>
            {t('portal.todo.pay', { amount: moneyText(invoice.outstandingCents, format) })}
          </span>
          <span style={s.rowMeta}>
            {join([
              t('invoices.number', { number: invoice.invoiceNumber }),
              booking && occasion(booking.eventType),
              ahead &&
                booking &&
                t('portal.meta.dueBy', { date: format.dayMonthYearLong(booking.eventDate) }),
            ])}
          </span>
        </span>
        <Button variant={primary ? 'primary' : 'secondary'} onClick={() => onPay(invoice)}>
          {t('portal.todo.payAction')}
        </Button>
      </div>
    );
  }

  const { gallery } = todo;
  return (
    <div style={rowStyle}>
      {gallery.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a presigned R2 URL; the image optimizer stays off for these
        <img src={gallery.coverUrl} alt="" style={s.rowIcon} />
      ) : (
        <span aria-hidden style={s.rowIcon}>
          {PortalIcon.photo}
        </span>
      )}
      <span style={s.rowText}>
        <span style={s.rowTitle}>{t('portal.todo.photos')}</span>
        <span style={s.rowMeta}>
          {join([
            occasion(gallery.eventType),
            tPlural('portal.meta.photos', gallery.photoCount),
            gallery.expiresAt &&
              t('portal.meta.until', { date: format.dayMonthYearLong(gallery.expiresAt) }),
          ])}
        </span>
      </span>
      {subdomain && (
        <a
          href={`/g/${subdomain}/${gallery.accessToken}`}
          target="_blank"
          rel="noopener noreferrer"
          className={action.className}
          style={action.style}
        >
          {t('portal.todo.photosAction')}
        </a>
      )}
    </div>
  );
}
