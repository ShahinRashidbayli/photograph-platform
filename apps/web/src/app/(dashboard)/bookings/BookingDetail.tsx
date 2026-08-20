'use client';

import React from 'react';
import { getInitials, pickAvatarColor } from '@/lib/avatar';
import { useTranslation } from '@/lib/i18n';
import {
  getAllowedTransitions,
  getPaymentStateMeta,
  toneToVisual,
  STATUS_ACTION_LABEL_KEY,
  type BookingStatusKey,
} from '@/lib/booking-status';
import type { Theme } from '@/lib/design-tokens';
import type { Booking } from '@/types/api';
import { BookingActionMenu } from './BookingActionMenu';
import { BookingInvoices } from './BookingInvoices';
import { getStatusVisual } from './bookings.filters';
import type { getBookingsColors } from './bookings.styles';

/**
 * The photographer's booking detail pane: identity, lifecycle actions, the
 * session facts, payment progress, invoices and internal notes.
 */

export type DetailProps = {
  booking: Booking;
  styles: Record<string, React.CSSProperties>;
  colors: ReturnType<typeof getBookingsColors>;
  /** Needed by BookingInvoices, which uses the shared token palette. */
  theme: Theme;
  isPhotographer: boolean;
  actionError: string | null;
  onTransition: (_target: BookingStatusKey) => void;
  onEdit: () => void;
};

export function BookingDetail({
  booking,
  styles,
  colors,
  theme,
  isPhotographer,
  actionError,
  onTransition,
  onEdit,
}: DetailProps) {
  const { t, format } = useTranslation();
  // The full date lives in the details grid below, not in a header subtitle
  // that repeated what the grid already lists.
  const dateLabel = [format.dayMonthYearLong(booking.eventDate), booking.eventTime]
    .filter(Boolean)
    .join(' · ');
  const status = getStatusVisual(booking.status, colors, 'detail');
  const total = booking.totalAmountCents;
  // Paid comes straight from the backend (derived server-side from real
  // invoice/payment rows). Before anything is invoiced this is 0, so the
  // progress bar never shows a configured deposit as money already banked.
  const paid = booking.amountPaidCents ?? 0;
  const remaining = Math.max(total - paid, 0);
  const paymentStateMeta = getPaymentStateMeta(booking.paymentState);
  const paymentStateVisual = toneToVisual(paymentStateMeta.tone, colors);
  const percent = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const notes = booking.internalNotes?.trim();
  const palette = pickAvatarColor(booking.id, colors.isDark);

  const progressColor =
    percent === 0 ? colors.warning : percent >= 100 ? colors.success : colors.primary;

  // Photographer-only: lifecycle actions, mirrored from the backend state
  // machine. Customers get a read-only view (the API would 403 the PATCH
  // anyway — this just keeps the UI honest).
  //
  // Payment progress is no longer part of the lifecycle state machine at all
  // — it's derived server-side from real invoice/payment rows (paymentState,
  // above) and driven by Stripe webhooks / manual payment recording through
  // the invoice API, not by transitioning the booking's status. So every
  // allowed transition here is a true management action: accept the enquiry,
  // mark the shoot completed, cancel.
  const transitions = isPhotographer ? getAllowedTransitions(booking.status) : [];
  // One filled action leads (confirm / mark completed); any further lifecycle
  // move is a neutral secondary, and cancelling — destructive and rare — is
  // reached through the "…" menu instead of a fourth competing button.
  const [primaryTarget, ...secondaryTargets] = transitions.filter(
    (target) => target !== 'CANCELLED'
  );
  const canCancel = transitions.includes('CANCELLED');
  const isTerminal = isPhotographer && transitions.length === 0;

  return (
    <>
      {/* Header carries identity only — name + status. Event type, date and
          location used to be repeated here and again in the grid below. */}
      <div style={styles.detailHeader}>
        <div style={styles.detailTopRow}>
          <div style={styles.detailHeaderLeft}>
            <div
              style={{
                ...styles.detailAvatar,
                background: palette.bg,
                color: palette.fg,
              }}
              aria-hidden
            >
              {getInitials(booking.clientName)}
            </div>
            <div style={styles.detailHeaderText}>
              <div style={styles.detailTitleRow}>
                <span style={styles.detailTitle}>{booking.clientName}</span>
                <span
                  style={{
                    ...styles.badge,
                    background: status.bg,
                    color: status.color,
                  }}
                >
                  <span style={{ ...styles.badgeDot, background: status.dot }} />
                  {t(status.labelKey)}
                </span>
              </div>
            </div>
          </div>
          {isPhotographer && canCancel && (
            <BookingActionMenu
              label={t('bookings.detail.moreActions')}
              styles={styles}
              colors={colors}
              items={[
                {
                  key: 'CANCELLED',
                  label: t('bookings.cancel.confirm'),
                  danger: true,
                  onSelect: () => onTransition('CANCELLED'),
                },
              ]}
            />
          )}
        </div>
        {isPhotographer && (
          <div style={styles.detailActions}>
            {/* No disabled/spinner state: transitions apply optimistically, so
                the button's own label changes the moment it is pressed. */}
            {primaryTarget && (
              <button
                type="button"
                onClick={() => onTransition(primaryTarget)}
                style={styles.primaryButton}
              >
                {t(STATUS_ACTION_LABEL_KEY[primaryTarget])}
              </button>
            )}
            {secondaryTargets.map((target) => (
              <button
                key={target}
                type="button"
                onClick={() => onTransition(target)}
                style={styles.secondaryButton}
              >
                {t(STATUS_ACTION_LABEL_KEY[target])}
              </button>
            ))}
            <button
              type="button"
              onClick={onEdit}
              style={{
                ...styles.secondaryButton,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              {t('bookings.detail.edit')}
            </button>
            {isTerminal && (
              <span style={{ fontSize: '0.8rem', color: colors.textMuted }}>
                {t('bookings.detail.closed')}
              </span>
            )}
          </div>
        )}
      </div>

      <div style={styles.detailBody}>
        {actionError && (
          <div style={styles.actionError} role="alert">
            {actionError}
          </div>
        )}

        {/* Booking details — the single place session facts are listed. */}
        <section style={styles.section}>
          <div style={styles.sectionTitle}>{t('bookings.detail.details')}</div>
          <div className="bk-info-grid" style={styles.infoGrid}>
            <InfoRow label={t('bookings.detail.date')} value={dateLabel} styles={styles} />
            <InfoRow
              label={t('bookings.detail.eventType')}
              value={booking.eventType ?? '—'}
              styles={styles}
            />
            <InfoRow
              label={t('bookings.detail.location')}
              value={booking.location ?? '—'}
              styles={styles}
            />
            <InfoRow
              label={t('bookings.detail.email')}
              value={booking.clientEmail}
              styles={styles}
            />
          </div>
        </section>

        {/* Payment — a divider and whitespace instead of a tinted card: the
            lifecycle status badge is already in the header, so only the
            payment state (a different fact) is shown here. */}
        <section style={{ ...styles.section, ...styles.sectionDivided }}>
          <div style={styles.sectionTitle}>{t('bookings.detail.payment')}</div>
          <div className="bk-payment-top" style={styles.paymentTopRow}>
            <div style={{ minWidth: 0 }}>
              <div style={styles.paymentLabel}>{t('bookings.detail.total')}</div>
              <div style={styles.paymentValue}>{format.eur(total)}</div>
            </div>
            <span
              style={{
                ...styles.badge,
                background: paymentStateVisual.bg,
                color: paymentStateVisual.color,
              }}
            >
              <span style={{ ...styles.badgeDot, background: paymentStateVisual.dot }} />
              {t(paymentStateMeta.labelKey)}
            </span>
          </div>

          {/* A cancelled booking owes nothing — a "0% paid, €X remaining"
              bar reads as an open balance, so show only the total + payment
              state above and drop the progress meter entirely. */}
          {booking.status !== 'CANCELLED' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={styles.progressTrack}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${Math.max(percent, percent === 0 ? 0 : 4)}%`,
                    background: progressColor,
                  }}
                />
              </div>
              <div style={styles.progressMeta}>
                <span>{t('bookings.detail.amountPaid', { amount: format.eur(paid) })}</span>
                <span>
                  {t('bookings.detail.amountRemaining', { amount: format.eur(remaining) })}
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Invoices — where the payment numbers above actually come from.
            `paymentState`/`amountPaidCents` are derived server-side from these
            rows, so this is the only place they can be changed. */}
        {isPhotographer && <BookingInvoices booking={booking} theme={theme} />}

        {/* Notes — internal to the photographer; the customer API never
            returns this field, so the section is photographer-only. */}
        {isPhotographer && (
          <section style={{ ...styles.section, ...styles.sectionDivided }}>
            <div style={styles.sectionTitle}>{t('bookings.detail.notes')}</div>
            <div style={notes ? styles.notesText : styles.notesEmpty}>
              {notes || t('bookings.detail.noNotes')}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function InfoRow({
  label,
  value,
  styles,
}: Readonly<{
  label: string;
  value: string;
  styles: Record<string, React.CSSProperties>;
}>) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>{label}</span>
      <span className="bk-info-value" style={styles.infoValue}>
        {value}
      </span>
    </div>
  );
}
