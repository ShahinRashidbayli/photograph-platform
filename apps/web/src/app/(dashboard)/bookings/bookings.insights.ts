import { parseApiDate } from '@/lib/date';
import type { Contract } from '@/hooks/useContracts';
import type { Gallery } from '@/hooks/useGalleries';
import type { Booking } from '@/types/api';

/**
 * What a booking needs next, read from the booking and the two documents that
 * hang off it (its contract and its gallery).
 *
 * <p>Pure, like `bookings.filters.ts`: given the same booking, documents and
 * day it always answers the same, so the decisions the screen makes — which
 * button leads, what counts as "needs you" — are pinned in a unit test rather
 * than rediscovered by clicking.
 *
 * <p>The detail pane used to lead with whatever the status machine allowed
 * first, which made "Mark completed" the big button on a shoot eleven days
 * away. The machine still says what is <em>legal</em> (everything stays
 * reachable in the "…" menu); this module says what is <em>sensible</em>.
 */

export type BookingContext = {
  /** Local midnight today — see `startOfToday`. */
  today: Date;
  /** The booking's live contract (newest, not cancelled), if any. */
  contract: Contract | null;
  /** The delivery gallery made for this booking, if any. */
  gallery: Gallery | null;
  /**
   * Whether the plan has contracts at all. On a plan without them an unsent
   * contract is not something the photographer can act on, so it is never a
   * reason to ask for attention, and the progress line leaves the step out.
   */
  contractsEnabled: boolean;
};

const BILLABLE = new Set(['CONFIRMED', 'POSTPONED', 'COMPLETED']);
const OPEN = new Set(['ENQUIRY', 'CONFIRMED', 'POSTPONED']);

/** Whole days from today to the shoot; negative once it has passed. */
export function daysFromToday(eventDate: string, today: Date): number {
  const date = parseApiDate(eventDate);
  date.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / 86_400_000);
}

/**
 * What the client still owes. Zero for an enquiry (nothing is agreed yet) and
 * for a cancelled or declined booking (nothing is owed any more) — showing
 * "€850 open" on either reads as money being chased that is not.
 */
export function openBalanceCents(booking: Booking): number {
  if (!BILLABLE.has(booking.status)) return 0;
  return Math.max((booking.totalAmountCents || 0) - (booking.amountPaidCents ?? 0), 0);
}

export function isUpcoming(booking: Booking, today: Date): boolean {
  return OPEN.has(booking.status) && daysFromToday(booking.eventDate, today) >= 0;
}

export function isPast(booking: Booking, today: Date): boolean {
  if (booking.status === 'COMPLETED') return true;
  if (booking.status === 'CANCELLED' || booking.status === 'DECLINED') return false;
  return daysFromToday(booking.eventDate, today) < 0;
}

// ─── Needs you ─────────────────────────────────────────────────────────────

export type AttentionKey = 'reply' | 'close' | 'overdue' | 'contractUnsigned';

/**
 * The one thing about this booking that is waiting on the photographer, or
 * null. One reason, in priority order — a row carries a single line, and the
 * first item here is the one that costs most if it waits.
 */
export function attentionFor(booking: Booking, ctx: BookingContext): AttentionKey | null {
  const days = daysFromToday(booking.eventDate, ctx.today);
  if (booking.status === 'ENQUIRY') return 'reply';
  if (booking.status === 'CONFIRMED' && days < 0) return 'close';
  if (booking.paymentState === 'OVERDUE') return 'overdue';
  if (
    ctx.contractsEnabled &&
    ctx.contract?.status === 'SENT' &&
    (booking.status === 'CONFIRMED' || booking.status === 'POSTPONED') &&
    days >= 0
  ) {
    return 'contractUnsigned';
  }
  return null;
}

// ─── Progress ──────────────────────────────────────────────────────────────

export type StepState = 'done' | 'current' | 'todo';

export type ProgressStep =
  | { key: 'confirmed'; state: StepState }
  | {
      key: 'contract';
      state: StepState;
      status: 'SIGNED' | 'SENT' | 'DRAFT' | 'NONE';
      at: string | null;
    }
  | {
      key: 'payment';
      state: StepState;
      phase: 'paid' | 'deposit' | 'open' | 'notInvoiced';
      amountCents: number;
    }
  | { key: 'shoot'; state: StepState; date: string; days: number }
  | { key: 'gallery'; state: StepState; photoCount: number | null };

/**
 * The booking's way from enquiry to delivered gallery, as the photographer
 * thinks of it. Null for a declined or cancelled booking: a progress line for
 * something that will not happen is noise.
 */
export function progressSteps(booking: Booking, ctx: BookingContext): ProgressStep[] | null {
  if (booking.status === 'CANCELLED' || booking.status === 'DECLINED') return null;
  const isEnquiry = booking.status === 'ENQUIRY';
  const days = daysFromToday(booking.eventDate, ctx.today);
  const shootDone = booking.status === 'COMPLETED' || (!isEnquiry && days < 0);
  const steps: ProgressStep[] = [{ key: 'confirmed', state: isEnquiry ? 'current' : 'done' }];

  if (ctx.contractsEnabled) {
    const c = ctx.contract;
    if (c?.status === 'SIGNED') {
      steps.push({ key: 'contract', state: 'done', status: 'SIGNED', at: c.signedAt });
    } else if (c?.status === 'SENT') {
      steps.push({ key: 'contract', state: 'current', status: 'SENT', at: c.sentAt });
    } else if (c?.status === 'DRAFT') {
      steps.push({ key: 'contract', state: 'current', status: 'DRAFT', at: null });
    } else {
      steps.push({ key: 'contract', state: 'todo', status: 'NONE', at: null });
    }
  }

  const paid = booking.amountPaidCents ?? 0;
  if (booking.paymentState === 'PAID') {
    steps.push({ key: 'payment', state: 'done', phase: 'paid', amountCents: paid });
  } else if (paid > 0) {
    steps.push({ key: 'payment', state: 'done', phase: 'deposit', amountCents: paid });
  } else if (booking.paymentState === 'OPEN' || booking.paymentState === 'OVERDUE') {
    steps.push({
      key: 'payment',
      state: 'current',
      phase: 'open',
      amountCents: booking.depositAmountCents || booking.totalAmountCents || 0,
    });
  } else {
    steps.push({
      key: 'payment',
      state: 'todo',
      phase: 'notInvoiced',
      amountCents: booking.depositAmountCents || 0,
    });
  }

  steps.push({
    key: 'shoot',
    state: shootDone ? 'done' : isEnquiry ? 'todo' : 'current',
    date: booking.eventDate,
    days,
  });

  steps.push({
    key: 'gallery',
    state: ctx.gallery ? 'done' : shootDone ? 'current' : 'todo',
    photoCount: ctx.gallery?.photoCount ?? null,
  });

  // One "you are here". An unsigned contract, an unpaid deposit and an
  // upcoming shoot are each in progress, but three ringed dots in a row
  // answer "where are we" with "everywhere" — the first one waiting wins.
  const first = steps.findIndex((s) => s.state === 'current');
  return steps.map((s, i) => (i > first && s.state === 'current' ? { ...s, state: 'todo' } : s));
}

// ─── What the buttons should be ────────────────────────────────────────────

export type ActionKey =
  | 'confirm'
  | 'decline'
  | 'complete'
  | 'recordPayment'
  | 'newInvoice'
  | 'createGallery';

/**
 * The lead action and, at most, one beside it. Everything else the status
 * machine allows goes in the "…" menu — see `menuTransitions` in the detail.
 *
 * @param hasCollectableInvoice whether an issued invoice still has money
 *   outstanding, i.e. whether "Record payment" has something to record against.
 */
export function nextActions(
  booking: Booking,
  ctx: BookingContext,
  hasCollectableInvoice: boolean
): { primary: ActionKey | null; secondary: ActionKey | null } {
  const days = daysFromToday(booking.eventDate, ctx.today);
  // Money first while it is owed: an invoice to settle, or a balance nothing
  // has been invoiced for yet.
  const money: ActionKey | null = hasCollectableInvoice
    ? 'recordPayment'
    : openBalanceCents(booking) > 0 && booking.paymentState !== 'PAID'
      ? 'newInvoice'
      : null;

  switch (booking.status) {
    case 'ENQUIRY':
      return { primary: 'confirm', secondary: 'decline' };
    case 'POSTPONED':
      // A postponed shoot is waiting for a new date; confirming it again is
      // the move that unblocks everything else.
      return { primary: 'confirm', secondary: money };
    case 'CONFIRMED':
      if (days < 0) {
        return { primary: 'complete', secondary: ctx.gallery ? money : 'createGallery' };
      }
      return { primary: money, secondary: null };
    case 'COMPLETED':
      if (!ctx.gallery) return { primary: 'createGallery', secondary: money };
      return { primary: money, secondary: null };
    default:
      return { primary: null, secondary: null };
  }
}

// ─── Indexes ───────────────────────────────────────────────────────────────

/** The live contract per booking: newest first, cancelled ones skipped. */
export function indexContracts(contracts: Contract[]): Map<string, Contract> {
  const byBooking = new Map<string, Contract>();
  const live = contracts
    .filter((c) => c.status !== 'CANCELLED')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const c of live) {
    if (!byBooking.has(c.bookingId)) byBooking.set(c.bookingId, c);
  }
  return byBooking;
}

export function indexGalleries(galleries: Gallery[]): Map<string, Gallery> {
  const byBooking = new Map<string, Gallery>();
  for (const g of galleries) {
    if (g.bookingId && !byBooking.has(g.bookingId)) byBooking.set(g.bookingId, g);
  }
  return byBooking;
}
