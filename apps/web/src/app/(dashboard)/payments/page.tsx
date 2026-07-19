'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useThemeStore } from '@/store/themeStore';
import { getColors } from '@/lib/design-tokens';
import { formatEUR, formatDayMonth, formatMonthDayYear } from '@/lib/helpers';
import { useBookings } from '@/hooks/useBookings';
import { amountPaidCents } from '@/lib/booking-status';
import type { Booking } from '@/types/api';
import { ComingSoon } from '@/components/ComingSoon';
import { ComingSoonButton } from '@/components/ComingSoonButton';

type Colors = ReturnType<typeof getColors>;

// Every figure on this page is derived from the client's OWN bookings — deposit
// paid, balance due and totals — so nothing here is invented. Online card
// payment is not live yet (no Stripe backend), so the pay actions carry a
// "coming soon" affordance rather than pretending to charge a card.

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

function derivePayment(b: Booking): PayItem {
  const total = b.totalAmountCents ?? 0;

  // An enquiry has no accepted quote yet, so it is not billable — show the draft
  // total but count neither paid nor remaining against it.
  const depositAmount = b.depositAmountCents ?? 0;

  if (b.status === 'ENQUIRY') {
    return { id: b.id, title: b.eventType || 'Session', eventDate: b.eventDate, total, paid: 0, remaining: 0, depositAmount, state: 'quote' };
  }

  // Paid is derived from the lifecycle status (see amountPaidCents), so a
  // booking that's only been accepted — CONFIRMED, deposit not yet paid —
  // correctly shows 0 collected and the full balance due.
  const paid = amountPaidCents(b);
  const remaining = Math.max(total - paid, 0);
  const state: PayState = remaining === 0 && total > 0 ? 'paid' : paid > 0 ? 'partial' : 'due';
  return { id: b.id, title: b.eventType || 'Session', eventDate: b.eventDate, total, paid, remaining, depositAmount, state };
}

function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(iso).getTime() - today.getTime()) / 86_400_000);
}

export default function PaymentsPage() {
  const { theme } = useThemeStore();
  const c = useMemo(() => getColors(theme), [theme]);
  const { data: bookings, isLoading, isError } = useBookings(false);

  const { items, totalPaid, totalRemaining, grandTotal, nextDue } = useMemo(() => {
    const list = (bookings ?? [])
      .filter((b) => b.status !== 'CANCELLED')
      .map(derivePayment);
    const paid = list.reduce((s, i) => s + i.paid, 0);
    const remaining = list.reduce((s, i) => s + i.remaining, 0);
    // The next payment due: unpaid balances, soonest session first.
    const due = list
      .filter((i) => i.remaining > 0)
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0];
    return { items: list, totalPaid: paid, totalRemaining: remaining, grandTotal: paid + remaining, nextDue: due };
  }, [bookings]);

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

      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '6px' }}>Payments</h1>
      <p style={{ fontSize: '0.95rem', color: c.textMuted, marginBottom: '22px' }}>
        {isLoading
          ? 'Loading your payments…'
          : sessionCount === 0
            ? 'Your deposits and balances appear here once you book a session.'
            : `${formatEUR(totalPaid)} paid of ${formatEUR(grandTotal)} · ${formatEUR(totalRemaining)} remaining across ${sessionCount} ${sessionCount === 1 ? 'session' : 'sessions'}`}
      </p>

      {isLoading ? (
        <StateCard colors={c}>Loading your payments…</StateCard>
      ) : isError ? (
        <StateCard colors={c}>
          We couldn&apos;t load your payments right now. Please refresh in a moment.
        </StateCard>
      ) : sessionCount === 0 ? (
        <EmptyState colors={c} />
      ) : (
        <div className="pay-grid">
          <div className="pay-col">
            {nextDue ? <DueHero item={nextDue} colors={c} /> : <PaidUpHero colors={c} />}
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
      <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: c.warningText }}>
        {days > 0 ? `Due in ${days} ${days === 1 ? 'day' : 'days'}` : 'Balance due'}
      </div>

      <div style={{ fontSize: '2.4rem', fontWeight: 800, color: c.warningText, lineHeight: 1.05, margin: '4px 0 8px' }}>
        {formatEUR(item.remaining)}
      </div>

      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: c.text }}>
        {item.title} · remaining balance
      </div>
      <div style={{ fontSize: '0.85rem', color: c.textMuted, marginTop: '2px' }}>
        Before your session on {formatDayMonth(item.eventDate)}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '18px', flexWrap: 'wrap' }}>
        <ComingSoonButton variant="primary" title="Online payments coming soon" style={{ padding: '10px 20px', fontSize: '0.9rem' }}>
          Pay {formatEUR(item.remaining)}
        </ComingSoonButton>
        <ComingSoon />
      </div>
    </div>
  );
}

function PaidUpHero({ colors: c }: { colors: Colors }) {
  return (
    <div
      style={{
        background: c.successBg,
        border: `1px solid ${c.successBorder}`,
        borderRadius: '14px',
        padding: '20px',
      }}
    >
      <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: c.successText }}>
        All settled
      </div>
      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: c.successText, margin: '6px 0 2px' }}>
        You&apos;re all paid up
      </div>
      <div style={{ fontSize: '0.88rem', color: c.text }}>
        No outstanding balances. Your payment history is below.
      </div>
    </div>
  );
}

// ── Payment history (real, per booking) ───────────────────────────────────────

function PaymentHistory({ items, colors: c, totalPaid }: { items: PayItem[]; colors: Colors; totalPaid: number }) {
  const rows = [...items].sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  return (
    <div style={{ ...cardStyle(c), display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${c.border}` }}>
        <span style={{ fontSize: '1rem', fontWeight: 700 }}>Payment history</span>
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
        <span style={{ flex: 1 }}>Session</span>
        <span style={{ width: 80, textAlign: 'right' }}>Amount</span>
        <span style={{ width: 96, textAlign: 'center' }}>Status</span>
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
              {formatMonthDayYear(item.eventDate)}
              {item.state === 'partial' && item.remaining > 0
                ? ` · ${formatEUR(item.paid)} paid, ${formatEUR(item.remaining)} due`
                : ''}
            </div>
          </div>
          <span style={{ width: 80, textAlign: 'right', fontSize: '0.88rem', fontWeight: 700 }}>
            {formatEUR(item.total)}
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
        <span style={{ fontSize: '0.85rem', color: c.textMuted }}>Paid to date</span>
        <span style={{ fontSize: '0.95rem', fontWeight: 800 }}>{formatEUR(totalPaid)}</span>
      </div>
    </div>
  );
}

// ── Payment schedule (deposit + balance of the next unpaid session) ───────────

function PaymentSchedule({ item, colors: c }: { item: PayItem | undefined; colors: Colors }) {
  return (
    <div style={{ ...cardStyle(c), padding: '18px 20px' }}>
      <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '14px' }}>Payment schedule</div>

      {item ? (
        <>
          <ScheduleRow label="Deposit" amount={item.depositAmount} sub={item.paid > 0 ? 'Paid' : 'Pending'} due={false} colors={c} />
          <ScheduleRow
            label="Remaining"
            amount={item.remaining}
            sub={`Before ${formatDayMonth(item.eventDate)}`}
            due
            colors={c}
          />
          <div style={{ height: '1px', background: c.divider, margin: '4px 0 14px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{item.title} total</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{formatEUR(item.total)}</span>
          </div>
        </>
      ) : (
        <div style={{ fontSize: '0.85rem', color: c.textMuted, lineHeight: 1.5 }}>
          No scheduled payments — you have no outstanding balance.
        </div>
      )}
    </div>
  );
}

function ScheduleRow({ label, amount, sub, due, colors: c }: { label: string; amount: number; sub: string; due: boolean; colors: Colors }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: '0.8rem', color: due ? c.warningText : c.textMuted, marginTop: '1px', fontWeight: due ? 600 : 400 }}>
          {sub}
        </div>
      </div>
      <span style={{ fontSize: '0.9rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{formatEUR(amount)}</span>
    </div>
  );
}

// ── How payments work (honest, replaces the fake saved-card panel) ────────────

function HowPaymentsWork({ colors: c }: { colors: Colors }) {
  return (
    <div style={{ ...cardStyle(c), padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span style={{ fontSize: '1rem', fontWeight: 700 }}>How payment works</span>
        <ComingSoon size="sm" label="Online soon" />
      </div>
      <p style={{ fontSize: '0.85rem', color: c.textMuted, lineHeight: 1.55, margin: 0 }}>
        Online card payment is on the way. For now, please settle your deposit and balance with your
        photographer directly — by bank transfer or as agreed in your booking. This page always
        reflects what they&apos;ve recorded as paid.
      </p>
    </div>
  );
}

// ── Questions about a charge ──────────────────────────────────────────────────

function ChargeQuestions({ colors: c }: { colors: Colors }) {
  return (
    <div style={{ ...cardStyle(c), padding: '18px 20px' }}>
      <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '8px' }}>Questions about a charge?</div>
      <p style={{ fontSize: '0.85rem', color: c.textMuted, lineHeight: 1.5, margin: '0 0 14px' }}>
        Message your photographer directly — refunds and reschedules follow the terms you agreed when
        booking.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <ComingSoonButton variant="outline" title="Messaging coming soon">Message photographer</ComingSoonButton>
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
    <div style={{ ...cardStyle(c), padding: '40px 24px', textAlign: 'center', fontSize: '0.92rem', color: c.textMuted }}>
      {children}
    </div>
  );
}

function EmptyState({ colors: c }: { colors: Colors }) {
  return (
    <div style={{ ...cardStyle(c), padding: '48px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px' }}>No payments yet</div>
      <p style={{ fontSize: '0.9rem', color: c.textMuted, lineHeight: 1.55, maxWidth: 420, margin: '0 auto 16px' }}>
        When you book a session, your deposit and balance will appear here — along with everything
        you&apos;ve paid.
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
        View my bookings
      </Link>
    </div>
  );
}

function StatusPill({ state, colors: c }: { state: PayState; colors: Colors }) {
  const map: Record<PayState, { label: string; bg: string; color: string }> = {
    paid: { label: 'Paid', bg: c.successBg, color: c.successText },
    partial: { label: 'Deposit paid', bg: c.infoBg, color: c.infoText },
    due: { label: 'Due', bg: c.warningBg, color: c.warningText },
    quote: { label: 'Quote', bg: c.neutralBg, color: c.textMuted },
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
