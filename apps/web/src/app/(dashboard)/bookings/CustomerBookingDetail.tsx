'use client';

import React from 'react';
import { Booking } from '@/types/api';
import { getBookingStatusMeta, getCustomerBookingStatusLabelKey, toneToVisual } from '@/lib/booking-status';
import { useTranslation } from '@/lib/i18n';
import { ComingSoon } from '@/components/ComingSoon';
import { ComingSoonButton } from '@/components/ComingSoonButton';
import { getBookingsColors } from './bookings.styles';

type Props = {
  booking: Booking;
  styles: Record<string, React.CSSProperties>;
  colors: ReturnType<typeof getBookingsColors>;
  photographerLabel: string;
};


function initialsFor(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(iso).getTime() - today.getTime()) / 86_400_000);
}

type Step = { label: string; meta: string; done: boolean };

export function CustomerBookingDetail({ booking, styles, colors, photographerLabel }: Props) {
  const { t, tPlural, format } = useTranslation();
  const meta = getBookingStatusMeta(booking.status);
  const statusVisual = toneToVisual(meta.tone, colors);

  const total = booking.totalAmountCents;
  const deposit = booking.depositAmountCents || 0;
  const remaining = Math.max(total - deposit, 0);

  const isPaidStage = ['FULLY_PAID', 'COMPLETED'].includes(booking.status);
  const depositDone =
    deposit > 0 || ['DEPOSIT_PAID', 'FULLY_PAID', 'COMPLETED'].includes(booking.status);
  const showPaymentAlert =
    booking.status !== 'CANCELLED' && !isPaidStage && remaining > 0;

  const daysLeft = daysUntil(booking.eventDate);
  const dueDate = format.dayMonth(booking.eventDate);

  const steps: Step[] = [
    {
      label: t('customerBooking.step.requestSent'),
      meta: format.dayMonth(booking.createdAt),
      done: true,
    },
    {
      label:
        deposit > 0
          ? t('customerBooking.step.depositReceived', { amount: format.eur(deposit) })
          : t('customerBooking.step.deposit'),
      meta: depositDone
        ? t('customerBooking.step.confirmed')
        : t('customerBooking.step.pending'),
      done: depositDone,
    },
    {
      label: t('customerBooking.step.remaining'),
      meta:
        remaining > 0
          ? t('customerBooking.step.by', { date: format.dayMonth(booking.eventDate) })
          : t('customerBooking.step.paid'),
      done: remaining === 0 && total > 0,
    },
    {
      label: t('customerBooking.step.gallery'),
      meta:
        booking.status === 'COMPLETED'
          ? t('customerBooking.step.delivered')
          : t('customerBooking.step.galleryEta'),
      done: booking.status === 'COMPLETED',
    },
  ];

  return (
    <>
      {/* Header */}
      <div style={{ ...styles.detailHeader, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={styles.detailTitleRow}>
            <span style={styles.detailTitle}>{booking.eventType ?? t('bookings.sessionFallback')}</span>
            <span style={{ ...styles.badge, background: statusVisual.bg, color: statusVisual.color }}>
              <span style={{ ...styles.badgeDot, background: statusVisual.dot }} />
              {t(getCustomerBookingStatusLabelKey(booking.status))}
            </span>
          </div>
          <div style={styles.detailSubtitle}>
            {format.dayMonthYearLong(booking.eventDate)}
            {booking.eventTime ? ` · ${booking.eventTime}` : ''}
            {booking.location ? ` · ${booking.location}` : ''}
          </div>
        </div>
      </div>

      <div style={styles.detailBody}>
        {/* Payment call-to-action — a neutral card with an amber left accent
            and the amount in amber; the CTA uses the app's indigo primary so
            amber stays an accent rather than dominating the panel. */}
        {showPaymentAlert && (
          <div
            style={{
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderLeft: `3px solid ${colors.warning}`,
              borderRadius: '12px',
              padding: '16px 18px',
            }}
          >
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: colors.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {t('customerBooking.nextPayment')}
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: colors.warningText, margin: '2px 0' }}>
              {format.eur(remaining)}
            </div>
            <div style={{ fontSize: '0.83rem', color: colors.textMuted }}>
              {daysLeft <= 0
                ? t('customerBooking.dueOn', { date: dueDate })
                : tPlural('customerBooking.dueOnDays', daysLeft, { date: dueDate })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px' }}>
              <ComingSoonButton
                variant="primary"
                title={t('customerBooking.paymentsSoon')}
                style={{ padding: '9px 20px' }}
              >
                {t('customerBooking.payNow')}
              </ComingSoonButton>
              <ComingSoon />
            </div>
          </div>
        )}

        {isPaidStage && (
          <div
            style={{
              background: colors.successBg,
              border: `1px solid ${colors.successBorder}`,
              borderRadius: '12px',
              padding: '14px 18px',
              fontSize: '0.9rem',
              fontWeight: 600,
              color: colors.successText,
            }}
          >
            {t('customerBooking.paidInFull', { amount: format.eur(total) })}
          </div>
        )}

        {/* Progress timeline */}
        <section style={styles.section}>
          <div style={styles.sectionTitle}>{t('customerBooking.progress')}</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {steps.map((step, i) => {
              const last = i === steps.length - 1;
              return (
                <div key={step.label} style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span
                      aria-hidden
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        flexShrink: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        background: step.done ? colors.success : 'transparent',
                        color: '#fff',
                        border: step.done ? 'none' : `1.5px dashed ${colors.border}`,
                      }}
                    >
                      {step.done && (
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    {!last && (
                      <span
                        style={{
                          width: 2,
                          flex: 1,
                          minHeight: 24,
                          background: step.done ? colors.success : colors.border,
                          opacity: step.done ? 0.45 : 1,
                        }}
                      />
                    )}
                  </div>
                  <div style={{ paddingBottom: last ? 0 : '16px' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: step.done ? colors.text : colors.textMuted }}>
                      {step.label}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: colors.textMuted, marginTop: '2px' }}>
                      {step.meta}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Photographer contact card */}
        <section style={{ ...styles.section, borderTop: `1px solid ${colors.divider}`, paddingTop: '18px' }}>
          <div
            style={{
              background: colors.surfaceAlt,
              border: `1px solid ${colors.border}`,
              borderRadius: '14px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            {/* Identity row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  background: colors.primary,
                  color: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  flexShrink: 0,
                }}
                aria-hidden
              >
                {initialsFor(photographerLabel)}
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: colors.text }}>
                  {photographerLabel}
                </div>
                <div style={{ fontSize: '0.78rem', color: colors.textMuted }}>{t('customerBooking.yourPhotographer')}</div>
              </div>
              {/* Quick-action icons */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  disabled
                  title={t('customerBooking.phoneSoon')}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '10px',
                    border: `1px solid ${colors.border}`,
                    background: colors.surface,
                    color: colors.textMuted,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'not-allowed',
                    opacity: 0.55,
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.18 6.18l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </button>
                <button
                  type="button"
                  disabled
                  title={t('customerBooking.messagingSoon')}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '10px',
                    border: `1px solid ${colors.border}`,
                    background: colors.surface,
                    color: colors.textMuted,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'not-allowed',
                    opacity: 0.55,
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </button>
              </div>
            </div>
            {/* Message Now CTA */}
            <ComingSoonButton
              variant="outline"
              title={t('customerBooking.messagingSoon')}
              style={{ width: '100%', padding: '10px', background: colors.surface, opacity: 0.6 }}
            >
              {t('customerBooking.messageNow')}
            </ComingSoonButton>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
              <ComingSoon />
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
