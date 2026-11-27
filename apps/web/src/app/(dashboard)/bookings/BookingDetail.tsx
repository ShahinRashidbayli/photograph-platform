'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getInitials } from '@/lib/avatar';
import { useTranslation, type TranslationKey } from '@/lib/i18n';
import {
  getAllowedTransitions,
  getPaymentStateMeta,
  isNotHappening,
  toneToVisual,
  STATUS_ACTION_LABEL_KEY,
  type BookingStatusKey,
} from '@/lib/booking-status';
import type { Theme } from '@/lib/design-tokens';
import { Alert, Button } from '@/components/ui';
import { useBookingInvoices } from '@/hooks/useInvoices';
import type { Booking } from '@/types/api';
import { BookingActionMenu, type MenuItem } from './BookingActionMenu';
import { BookingContracts } from './BookingContracts';
import { BookingGallery } from './BookingGallery';
import { BookingLanguage } from './BookingLanguage';
import { BookingInvoices, CreateInvoiceModal, RecordPaymentDialog } from './BookingInvoices';
import { BookingNotes } from './BookingNotes';
import { BookingProgress, relativeDay } from './BookingProgress';
import { dot, getDetailStyles, pill } from './bookingDetail.styles';
import { getStatusVisual } from './bookings.filters';
import {
  daysFromToday,
  nextActions,
  uncollectedCents,
  progressSteps,
  type ActionKey,
  type BookingContext,
} from './bookings.insights';
import type { getBookingsColors } from './bookings.styles';

/**
 * The photographer's booking detail pane.
 *
 * <p>Read top to bottom it answers, in order: whose booking and when (header),
 * what to do next (the lead action), how far along it is (progress), the facts
 * of the session and the client, the money, the documents, and the private
 * note. Sections are divided by hairlines; nothing is a card inside the card.
 *
 * <p>The lead action comes from `nextActions`, not from the status machine's
 * first legal move — see `bookings.insights.ts` for why. Every other legal
 * move is still one click away in the "…" menu.
 */

export type DetailProps = {
  booking: Booking;
  ctx: BookingContext;
  /** The linked package's name, resolved by the page from the packages list. */
  packageName: string | null;
  /** How many bookings this client (by email) has with the studio. */
  clientBookingCount: number;
  /** The studio's subdomain, for the client-facing gallery link. */
  subdomain: string | null;
  styles: Record<string, React.CSSProperties>;
  colors: ReturnType<typeof getBookingsColors>;
  theme: Theme;
  /** Phones: actions move to a bar pinned under the content. */
  isNarrow: boolean;
  actionError: string | null;
  onTransition: (_target: BookingStatusKey) => void;
  onEdit: () => void;
};

const ACTION_LABEL: Record<ActionKey, TranslationKey> = {
  confirm: 'statusAction.CONFIRMED',
  decline: 'statusAction.DECLINED',
  complete: 'statusAction.COMPLETED',
  recordPayment: 'bookings.action.recordPayment',
  newInvoice: 'bookings.action.newInvoice',
  createGallery: 'bookings.action.createGallery',
};

/** The lifecycle move an action stands for, so the menu does not repeat it. */
const ACTION_TRANSITION: Partial<Record<ActionKey, BookingStatusKey>> = {
  confirm: 'CONFIRMED',
  decline: 'DECLINED',
  complete: 'COMPLETED',
};

export function BookingDetail({
  booking,
  ctx,
  packageName,
  clientBookingCount,
  subdomain,
  styles,
  colors: c,
  theme,
  isNarrow,
  actionError,
  onTransition,
  onEdit,
}: DetailProps) {
  const { t, tPlural, format } = useTranslation();
  const router = useRouter();
  const s = useMemo(() => getDetailStyles(c), [c]);

  // Same query (and cache entry) as the invoice list below — this only needs
  // to know whether there is something "Record payment" can settle.
  const { data: invoices } = useBookingInvoices(booking.id);
  const collectable = useMemo(
    () =>
      (invoices ?? [])
        .filter((i) => i.collectable)
        .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt))[0] ?? null,
    [invoices]
  );

  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const days = daysFromToday(booking.eventDate, ctx.today);
  const shootDone = booking.status === 'COMPLETED' || (booking.status !== 'ENQUIRY' && days < 0);
  const status = getStatusVisual(booking.status, c, 'detail');
  const steps = progressSteps(booking, ctx);
  const { primary, secondary } = nextActions(booking, ctx, collectable !== null);
  const notHappening = isNotHappening(booking.status);

  const total = booking.totalAmountCents;
  // Paid comes straight from the backend (derived server-side from real
  // invoice/payment rows). Before anything is invoiced this is 0, so the bar
  // never shows a configured deposit as money already banked.
  const paid = booking.amountPaidCents ?? 0;
  // What is still to come in is the server's figure too (ADR-004): zero on an
  // enquiry, whose total is a quote, and never worked out here from the total.
  const uncollected = uncollectedCents(booking);
  const percent = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const paymentVisual = toneToVisual(getPaymentStateMeta(booking.paymentState).tone, c);
  // Money the studio holds for the client: a payment on an invoice that was
  // Storniert after it was paid, beyond what the Live invoices ask for. The
  // payment state alone cannot say so — a booking with no replacement invoice
  // reads "Not invoiced" while the money is still in the studio's account.
  const credit = booking.creditCents ?? 0;
  const creditVisual = toneToVisual('info', c);

  function run(action: ActionKey) {
    const transition = ACTION_TRANSITION[action];
    if (transition) return onTransition(transition);
    if (action === 'recordPayment') return setRecordOpen(true);
    if (action === 'newInvoice') return setShowCreateInvoice(true);
    if (action === 'createGallery') return router.push('/galleries');
  }

  // Every other legal move, cancelling last — destructive and rare, so never a
  // button competing with the lead action.
  const shown = new Set([primary, secondary].map((a) => (a ? ACTION_TRANSITION[a] : undefined)));
  const menuItems: MenuItem[] = getAllowedTransitions(booking.status)
    .filter((target) => !shown.has(target))
    .sort((a, b) => Number(a === 'CANCELLED') - Number(b === 'CANCELLED'))
    .map((target) => ({
      key: target,
      label: t(STATUS_ACTION_LABEL_KEY[target]),
      danger: target === 'CANCELLED',
      onSelect: () => onTransition(target),
    }));

  const editButton = (
    <Button variant="secondary" onClick={onEdit}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <PencilIcon />
        {t('bookings.detail.edit')}
      </span>
    </Button>
  );
  const leadButtons = (
    <>
      {secondary && (
        <Button variant="secondary" onClick={() => run(secondary)}>
          {t(ACTION_LABEL[secondary])}
        </Button>
      )}
      {primary && (
        <Button
          variant="primary"
          onClick={() => run(primary)}
          style={isNarrow ? { flex: 1 } : undefined}
        >
          {t(ACTION_LABEL[primary])}
        </Button>
      )}
    </>
  );
  const menu = menuItems.length > 0 && (
    <BookingActionMenu
      label={t('bookings.detail.moreActions')}
      styles={styles}
      colors={c}
      items={menuItems}
    />
  );

  const dateTime = [format.fullDate(booking.eventDate), booking.eventTime?.slice(0, 5)]
    .filter(Boolean)
    .join(' · ');

  return (
    <div style={s.scroll}>
      {/* Header: identity, when, and what to do next. */}
      {/* Pinned on wide screens only: on a phone the header is several lines
          tall, and the actions already have their own bar at the bottom. */}
      <header style={isNarrow ? { ...s.header, position: 'static' } : s.header}>
        <span style={s.avatar} aria-hidden>
          {getInitials(booking.clientName)}
        </span>
        <div style={s.identity}>
          <div style={s.titleRow}>
            <h2 style={s.title}>{booking.clientName}</h2>
            <span style={pill(status.color, status.bg)}>
              <span style={dot(status.dot)} />
              {t(status.labelKey)}
            </span>
          </div>
          <div style={s.metaRow}>
            {booking.eventType && (
              <>
                <span>{booking.eventType}</span>
                <span aria-hidden style={s.metaDot}>
                  ·
                </span>
              </>
            )}
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{dateTime}</span>
            {!notHappening && booking.status !== 'COMPLETED' && (
              <span style={days >= 0 && days <= 14 ? s.relChip : s.relChipMuted}>
                {relativeDay(days, t, tPlural)}
              </span>
            )}
          </div>
        </div>
        {!isNarrow && (
          <div style={s.actions}>
            {editButton}
            {leadButtons}
            {menu}
          </div>
        )}
      </header>

      {actionError && (
        <Alert tone="danger" style={{ margin: '0 24px 16px' }}>
          {actionError}
        </Alert>
      )}

      {steps && (
        <BookingProgress
          steps={steps}
          s={s}
          ink={c.primarySolid}
          line={c.border}
          vertical={isNarrow}
        />
      )}

      {/* Session and client: the facts of the shoot on one side, who it is
          for on the other. Email used to sit among the session facts. */}
      <div className="bk-split" style={s.split}>
        <section aria-labelledby="bk-session-title">
          <h3 id="bk-session-title" style={s.eyebrow}>
            {t('bookings.detail.session')}
          </h3>
          <dl style={s.dl}>
            <Fact label={t('bookings.detail.dateTime')} s={s}>
              {dateTime}
            </Fact>
            <Fact label={t('bookings.detail.location')} s={s}>
              {booking.location ?? '—'}
              {booking.location && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={s.inlineLink}
                >
                  {t('bookings.detail.openInMaps')}
                </a>
              )}
            </Fact>
            <Fact label={t('bookings.detail.package')} s={s}>
              {packageName ?? '—'}
            </Fact>
            <Fact label={t('bookings.detail.assignedTo')} s={s} muted={!booking.assignedUserName}>
              {booking.assignedUserName || t('bookings.detail.unassigned')}
            </Fact>
          </dl>
        </section>
        <section aria-labelledby="bk-client-title" className="bk-split-side" style={s.splitSide}>
          <h3 id="bk-client-title" style={s.eyebrow}>
            {t('bookings.detail.client')}
          </h3>
          <p style={s.bodyStrong}>{booking.clientName}</p>
          <a href={`mailto:${booking.clientEmail}`} style={{ ...s.textLink, marginTop: 6 }}>
            <MailIcon />
            {booking.clientEmail}
          </a>
          <p style={{ ...s.body, fontSize: 13, marginTop: 10 }}>
            {clientBookingCount > 1
              ? tPlural('bookings.detail.bookingsWithYou', clientBookingCount)
              : t('bookings.detail.firstBooking')}
          </p>
          <BookingLanguage booking={booking} />
        </section>
      </div>

      {/* Payment: the three figures, then the documents they come from.
          `paymentState` and `amountPaidCents` are derived server-side from the
          invoice rows below, so those rows are the only place they change. */}
      <section style={s.section} aria-labelledby="bk-payment-title">
        <div style={s.sectionHead}>
          <div style={s.sectionTitleRow}>
            <h3 id="bk-payment-title" style={s.h3}>
              {t('bookings.detail.payment')}
            </h3>
            <span style={pill(paymentVisual.color, paymentVisual.bg)}>
              <span style={dot(paymentVisual.dot)} />
              {t(getPaymentStateMeta(booking.paymentState).labelKey)}
            </span>
            {credit > 0 && (
              <span
                style={pill(creditVisual.color, creditVisual.bg)}
                title={t('bookings.detail.creditHint')}
              >
                {t('bookings.detail.credit', { amount: format.eurExact(credit) })}
              </span>
            )}
          </div>
          {!notHappening && (
            <Button variant="secondary" size="sm" onClick={() => setShowCreateInvoice(true)}>
              {t('invoices.manage.new')}
            </Button>
          )}
        </div>

        {paymentError && (
          <Alert tone="danger" style={{ marginBottom: 16 }}>
            {paymentError}
          </Alert>
        )}

        <div style={s.figures}>
          <Figure label={t('bookings.detail.total')} value={format.eur(total)} s={s} />
          {/* A cancelled booking owes nothing — "€X open" would read as a
              balance being chased, so only the total stays. */}
          {!notHappening && (
            <>
              <Figure
                label={t('bookings.detail.paid')}
                value={format.eur(paid)}
                color={paid > 0 ? c.successText : undefined}
                s={s}
              />
              <Figure
                label={t('bookings.detail.open')}
                value={format.eur(uncollected)}
                color={uncollected > 0 ? c.warningText : c.textSubtle}
                s={s}
              />
            </>
          )}
        </div>
        {!notHappening && (
          <div
            style={s.barTrack}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label={t('bookings.detail.paid')}
          >
            <div style={{ ...s.barFill, width: `${percent}%` }} />
          </div>
        )}

        <BookingInvoices booking={booking} theme={theme} />
      </section>

      {/* The documents: what was agreed, and what was delivered. */}
      <div className="bk-docs" style={s.docs}>
        <div className="bk-docs-first" style={s.docCellDivided}>
          <BookingContracts booking={booking} theme={theme} />
        </div>
        <div style={s.docCell}>
          <BookingGallery gallery={ctx.gallery} shootDone={shootDone} subdomain={subdomain} s={s} />
        </div>
      </div>

      <BookingNotes key={booking.id} booking={booking} s={s} />

      {isNarrow && (
        <div style={s.stickyBar}>
          {editButton}
          {leadButtons}
          {menu}
        </div>
      )}

      {showCreateInvoice && (
        <CreateInvoiceModal
          booking={booking}
          colors={c}
          onClose={() => setShowCreateInvoice(false)}
        />
      )}
      {collectable && (
        <RecordPaymentDialog
          invoice={collectable}
          booking={booking}
          theme={theme}
          open={recordOpen}
          onClose={() => setRecordOpen(false)}
          onError={setPaymentError}
        />
      )}
    </div>
  );
}

function Fact({
  label,
  s,
  muted = false,
  children,
}: {
  label: string;
  s: ReturnType<typeof getDetailStyles>;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bk-fact" style={s.dlRow}>
      <dt style={s.dt}>{label}</dt>
      <dd className="bk-info-value" style={muted ? s.ddMuted : s.dd}>
        {children}
      </dd>
    </div>
  );
}

function Figure({
  label,
  value,
  color,
  s,
}: {
  label: string;
  value: string;
  color?: string;
  s: ReturnType<typeof getDetailStyles>;
}) {
  return (
    <div>
      <div style={s.figureLabel}>{label}</div>
      <div style={color ? { ...s.figureValue, color } : s.figureValue}>{value}</div>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
    </svg>
  );
}
