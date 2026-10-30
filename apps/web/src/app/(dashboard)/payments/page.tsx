'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useThemeStore } from '@/store/themeStore';
import { getColors } from '@/lib/design-tokens';
import { useTranslation } from '@/lib/i18n';
import { useBookings } from '@/hooks/useBookings';
import { parseApiDate, startOfToday } from '@/lib/date';
import { isBillableStatus } from '@/lib/booking-status';
import type { Booking } from '@/types/api';
import { ComingSoon } from '@/components/ComingSoon';
import { ComingSoonButton } from '@/components/ComingSoonButton';
import { InvoicePayList } from '@/components/InvoicePayList';

type Colors = ReturnType<typeof getColors>;

// The summary figures on this page are derived from the client's OWN bookings —
// deposit paid, balance due and totals — so nothing here is invented.
//
// Paying, though, happens against an *invoice*, not against a booking: the
// Invoices card below is the only place with a Pay button, because a booking
// total is an agreement while an invoice is the document the money settles.
// The two differ whenever only a deposit has been invoiced, and asking for
// money no document claims is exactly the mismatch this split avoids.

type PayState = 'paid' | 'partial' | 'due' | 'quote';

interface PayItem {
  id: string;
  title: string;
  eventDate: string;
  total: number;
  paid: number;
  remaining: number;
  /** Quoted deposit (what's owed as a deposit), independent of whether it's paid. */
  depositAmount: number;
  state: PayState;
}

function derivePayment(b: Booking, sessionFallback: string): PayItem {
  const total = b.totalAmountCents ?? 0;

  // An enquiry has no accepted quote yet, so it is not billable — show the draft
  // total but count neither paid nor remaining against it.
  const depositAmount = b.depositAmountCents ?? 0;

  if (b.status === 'ENQUIRY') {
    return {
      id: b.id,
      title: b.eventType || sessionFallback,
      eventDate: b.eventDate,
      total,
      paid: 0,
      remaining: 0,
      depositAmount,
      state: 'quote',
    };
  }

  // Paid comes straight from the backend (derived server-side from real
  // invoice/payment rows — see BookingPaymentStateResolver), so a booking
  // that's only been accepted — CONFIRMED, nothing invoiced yet — correctly
  // shows 0 collected and the full balance due.
  const paid = b.amountPaidCents ?? 0;
  const remaining = Math.max(total - paid, 0);
  const state: PayState = remaining === 0 && total > 0 ? 'paid' : paid > 0 ? 'partial' : 'due';
  return {
    id: b.id,
    title: b.eventType || sessionFallback,
    eventDate: b.eventDate,
    total,
    paid,
    remaining,
    depositAmount,
    state,
  };
}

function daysUntil(iso: string): number {
  const today = startOfToday();
  return Math.round((parseApiDate(iso).getTime() - today.getTime()) / 86_400_000);
}

export default function PaymentsPage() {
  const { t, format } = useTranslation();
  const { theme } = useThemeStore();
  const c = useMemo(() => getColors(theme), [theme]);
  const { data: bookings, isLoading, isError } = useBookings(false);

  const { items, totalPaid, totalRemaining, grandTotal, nextDue } = useMemo(() => {
    const list = (bookings ?? [])
      .filter((b) => isBillableStatus(b.status))
      .map((b) => derivePayment(b, t('payments.sessionFallback')));
    const paid = list.reduce((s, i) => s + i.paid, 0);
    const remaining = list.reduce((s, i) => s + i.remaining, 0);
    // The next payment due: unpaid balances, soonest session first.
    const due = list
      .filter((i) => i.remaining > 0)
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0];
    return {
      items: list,
      totalPaid: paid,
      totalRemaining: remaining,
      grandTotal: paid + remaining,
      nextDue: due,
    };
  }, [bookings, t]);

  // Only bookings with a real billable amount belong in the history/schedule.
  const billable = items.filter((i) => i.state !== 'quote' && i.total > 0);
  const sessionCount = billable.length;

  return (
    <div
      style={{
        padding: '28px 28px 40px',
        maxWidth: '1080px',
        margin: '0 auto',
        color: c.text,
        fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <style>{`
        .pay-grid { display: grid; grid-template-columns: 1.35fr 1fr; gap: 16px; align-items: stretch; }
        .pay-col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
        .pay-col > :last-child { flex: 1; }
        @media (max-width: 900px) {
          .pay-grid { grid-template-columns: 1fr; }
          .pay-col > :last-child { flex: 0 1 auto; }
        }
      `}</style>

      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '6px' }}>
        {t('payments.title')}
      </h1>
      <p style={{ fontSize: '0.95rem', color: c.textMuted, marginBottom: '22px' }}>
        {isLoading
          ? t('payments.loading')
          : sessionCount === 0
            ? t('payments.summary.empty')
            : t(sessionCount === 1 ? 'payments.summary.lineSingle' : 'payments.summary.line', {
                paid: format.eurExact(totalPaid),
                total: format.eurExact(grandTotal),
                remaining: format.eurExact(totalRemaining),
                count: sessionCount,
              })}
      </p>

      {isLoading ? (
        <StateCard colors={c}>{t('payments.loading')}</StateCard>
      ) : isError ? (
        <StateCard colors={c}>{t('payments.loadError')}</StateCard>
      ) : sessionCount === 0 ? (
        <EmptyState colors={c} />
      ) : (
        <div className="pay-grid">
          <div className="pay-col">
            {nextDue ? <DueHero item={nextDue} colors={c} /> : <PaidUpHero colors={c} />}
            <InvoicesCard colors={c} />
            <PaymentHistory items={billable} colors={c} totalPaid={totalPaid} />
          </div>

          <div className="pay-col">
            <PaymentSchedule item={nextDue} colors={c} />
            <HowPaymentsWork colors={c} />
            <ChargeQuestions colors={c} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── The one focal amber card: the next payment due ────────────────────────────

function DueHero({ item, colors: c }: { item: PayItem; colors: Colors }) {
  const { t, tPlural, format } = useTranslation();
  const days = daysUntil(item.eventDate);
  return (
    <div
      style={{
        background: c.surface,
        border: `1px solid ${c.border}`,
        borderLeft: `3px solid ${c.warning}`,
        borderRadius: '14px',
        padding: '20px',
      }}
    >
      <div
        style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: c.warningText,
        }}
      >
        {days > 0 ? tPlural('payments.due.inDays', days) : t('payments.due.now')}
      </div>

      <div
        style={{
          fontSize: '2.4rem',
          fontWeight: 800,
          color: c.warningText,
          lineHeight: 1.05,
          margin: '4px 0 8px',
        }}
      >
        {format.eurExact(item.remaining)}
      </div>

      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: c.text }}>
        {t('payments.due.remainingBalance', { title: item.title })}
      </div>
      <div style={{ fontSize: '0.85rem', color: c.textMuted, marginTop: '2px' }}>
        {t('payments.due.beforeSession', { date: format.dayMonth(item.eventDate) })}
      </div>

      <div style={{ fontSize: '0.83rem', color: c.textMuted, marginTop: '14px' }}>
        {t('payments.due.settleBelow')}
      </div>
    </div>
  );
}

function PaidUpHero({ colors: c }: { colors: Colors }) {
  const { t } = useTranslation();
  return (
    <div
      style={{
        background: c.successBg,
        border: `1px solid ${c.successBorder}`,
        borderRadius: '14px',
        padding: '20px',
      }}
    >
      <div
        style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: c.successText,
        }}
      >
        {t('payments.settled.badge')}
      </div>
      <div
        style={{ fontSize: '1.15rem', fontWeight: 800, color: c.successText, margin: '6px 0 2px' }}
      >
        {t('payments.settled.title')}
      </div>
      <div style={{ fontSize: '0.88rem', color: c.text }}>{t('payments.settled.body')}</div>
    </div>
  );
}

// ── Payment history (real, per booking) ───────────────────────────────────────

function PaymentHistory({
  items,
  colors: c,
  totalPaid,
}: {
  items: PayItem[];
  colors: Colors;
  totalPaid: number;
}) {
  const { t, format } = useTranslation();
  const rows = [...items].sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  return (
    <div style={{ ...cardStyle(c), display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${c.border}` }}>
        <span style={{ fontSize: '1rem', fontWeight: 700 }}>{t('payments.history.title')}</span>
      </div>

      {/* Column header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 20px',
          fontSize: '0.68rem',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: c.textMuted,
          borderBottom: `1px solid ${c.border}`,
        }}
      >
        <span style={{ flex: 1 }}>{t('payments.history.session')}</span>
        <span style={{ width: 80, textAlign: 'right' }}>{t('payments.history.amount')}</span>
        <span style={{ width: 96, textAlign: 'center' }}>{t('payments.history.status')}</span>
      </div>

      {rows.map((item) => (
        <div
          key={item.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 20px',
            borderBottom: `1px solid ${c.border}`,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{item.title}</div>
            <div style={{ fontSize: '0.78rem', color: c.textMuted, marginTop: '1px' }}>
              {format.monthDayYear(item.eventDate)}
              {item.state === 'partial' && item.remaining > 0
                ? ` · ${t('payments.history.partial', {
                    paid: format.eurExact(item.paid),
                    remaining: format.eurExact(item.remaining),
                  })}`
                : ''}
            </div>
          </div>
          <span style={{ width: 80, textAlign: 'right', fontSize: '0.88rem', fontWeight: 700 }}>
            {format.eurExact(item.total)}
          </span>
          <span style={{ width: 96, display: 'flex', justifyContent: 'center' }}>
            <StatusPill state={item.state} colors={c} />
          </span>
        </div>
      ))}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          marginTop: 'auto',
          background: c.surfaceAlt,
          borderTop: `1px solid ${c.border}`,
          borderBottomLeftRadius: '14px',
          borderBottomRightRadius: '14px',
        }}
      >
        <span style={{ fontSize: '0.85rem', color: c.textMuted }}>
          {t('payments.history.paidToDate')}
        </span>
        <span style={{ fontSize: '0.95rem', fontWeight: 800 }}>{format.eurExact(totalPaid)}</span>
      </div>
    </div>
  );
}

// ── Payment schedule (deposit + balance of the next unpaid session) ───────────

function PaymentSchedule({ item, colors: c }: { item: PayItem | undefined; colors: Colors }) {
  const { t, format } = useTranslation();
  return (
    <div style={{ ...cardStyle(c), padding: '18px 20px' }}>
      <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '14px' }}>
        {t('payments.schedule.title')}
      </div>

      {item ? (
        <>
          <ScheduleRow
            label={t('payments.schedule.deposit')}
            amount={item.depositAmount}
            sub={item.paid > 0 ? t('payments.schedule.paid') : t('payments.schedule.pending')}
            due={false}
            colors={c}
          />
          <ScheduleRow
            label={t('payments.schedule.remaining')}
            amount={item.remaining}
            sub={t('payments.schedule.by', { date: format.dayMonth(item.eventDate) })}
            due
            colors={c}
          />
          <div style={{ height: '1px', background: c.divider, margin: '4px 0 14px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>
              {t('payments.schedule.total', { title: item.title })}
            </span>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
              {format.eurExact(item.total)}
            </span>
          </div>
        </>
      ) : (
        <div style={{ fontSize: '0.85rem', color: c.textMuted, lineHeight: 1.5 }}>
          {t('payments.schedule.none')}
        </div>
      )}
    </div>
  );
}

function ScheduleRow({
  label,
  amount,
  sub,
  due,
  colors: c,
}: {
  label: string;
  amount: number;
  sub: string;
  due: boolean;
  colors: Colors;
}) {
  const { format } = useTranslation();
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '12px',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{label}</div>
        <div
          style={{
            fontSize: '0.8rem',
            color: due ? c.warningText : c.textMuted,
            marginTop: '1px',
            fontWeight: due ? 600 : 400,
          }}
        >
          {sub}
        </div>
      </div>
      <span style={{ fontSize: '0.9rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
        {format.eurExact(amount)}
      </span>
    </div>
  );
}

// ── Invoices — the payable documents ─────────────────────────────────────────

function InvoicesCard({ colors: c }: { colors: Colors }) {
  const { t } = useTranslation();
  return (
    <div style={{ ...cardStyle(c), padding: '18px 20px' }}>
      <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>
        {t('payments.invoices.title')}
      </div>
      <InvoicePayList />
    </div>
  );
}

// ── How payments work ────────────────────────────────────────────────────────

function HowPaymentsWork({ colors: c }: { colors: Colors }) {
  const { t } = useTranslation();
  return (
    <div style={{ ...cardStyle(c), padding: '18px 20px' }}>
      <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '10px' }}>
        {t('payments.how.title')}
      </div>
      <p style={{ fontSize: '0.85rem', color: c.textMuted, lineHeight: 1.55, margin: 0 }}>
        {t('payments.how.body')}
      </p>
    </div>
  );
}

// ── Questions about a charge ──────────────────────────────────────────────────

function ChargeQuestions({ colors: c }: { colors: Colors }) {
  const { t } = useTranslation();
  return (
    <div style={{ ...cardStyle(c), padding: '18px 20px' }}>
      <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '8px' }}>
        {t('payments.questions.title')}
      </div>
      <p style={{ fontSize: '0.85rem', color: c.textMuted, lineHeight: 1.5, margin: '0 0 14px' }}>
        {t('payments.questions.body')}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <ComingSoonButton variant="outline" title={t('payments.questions.messagingSoon')}>
          {t('payments.questions.message')}
        </ComingSoonButton>
        <ComingSoon />
      </div>
    </div>
  );
}

// ── shared ────────────────────────────────────────────────────────────────────

function cardStyle(c: Colors): React.CSSProperties {
  return {
    background: c.surface,
    border: `1px solid ${c.border}`,
    borderRadius: '14px',
    boxShadow: c.overlayShadow,
  };
}

function StateCard({ colors: c, children }: { colors: Colors; children: React.ReactNode }) {
  return (
    <div
      style={{
        ...cardStyle(c),
        padding: '40px 24px',
        textAlign: 'center',
        fontSize: '0.92rem',
        color: c.textMuted,
      }}
    >
      {children}
    </div>
  );
}

function EmptyState({ colors: c }: { colors: Colors }) {
  const { t } = useTranslation();
  return (
    <div style={{ ...cardStyle(c), padding: '48px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px' }}>
        {t('payments.empty.title')}
      </div>
      <p
        style={{
          fontSize: '0.9rem',
          color: c.textMuted,
          lineHeight: 1.55,
          maxWidth: 420,
          margin: '0 auto 16px',
        }}
      >
        {t('payments.empty.body')}
      </p>
      <Link
        href="/bookings"
        style={{
          display: 'inline-block',
          padding: '9px 18px',
          borderRadius: '10px',
          background: c.primary,
          color: '#fff',
          fontSize: '0.88rem',
          fontWeight: 700,
          textDecoration: 'none',
        }}
      >
        {t('payments.empty.cta')}
      </Link>
    </div>
  );
}

function StatusPill({ state, colors: c }: { state: PayState; colors: Colors }) {
  const { t } = useTranslation();
  const map: Record<PayState, { label: string; bg: string; color: string }> = {
    paid: { label: t('payments.state.paid'), bg: c.successBg, color: c.successText },
    partial: { label: t('payments.state.partial'), bg: c.infoBg, color: c.infoText },
    due: { label: t('payments.state.due'), bg: c.warningBg, color: c.warningText },
    quote: { label: t('payments.state.quote'), bg: c.neutralBg, color: c.textMuted },
  };
  const s = map[state];
  return (
    <span
      style={{
        padding: '3px 10px',
        borderRadius: '999px',
        fontSize: '0.7rem',
        fontWeight: 700,
        background: s.bg,
        color: s.color,
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  );
}
