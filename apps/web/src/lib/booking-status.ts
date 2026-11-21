import type { AppColors } from '@/lib/design-tokens';
import type { TranslationKey } from '@/lib/i18n';

/**
 * Single source of truth for booking *lifecycle* presentation — the shoot's
 * operational pipeline only. Payment progress is a separate, derived concern
 * (see {@link BOOKING_PAYMENT_STATE} below): it's computed server-side from
 * real invoice/payment rows and returned as `booking.paymentState` /
 * `booking.amountPaidCents`, never guessed from the lifecycle status. The two
 * used to be conflated (DEPOSIT_PAID/FULLY_PAID as lifecycle states) — that
 * meant a booking's stage and its payment progress could never be inspected
 * independently, and "confirmed but unpaid past due" or a postponed shoot
 * had no representation at all.
 *
 * Labels live in the i18n dictionaries rather than here so every surface that
 * renders a status follows the active language; this module stays the single
 * source of truth for which key and tone each status maps to.
 *
 * Keep this in sync with the backend `BookingStatus` enum
 * (apps/api/.../booking/domain/BookingStatus.java).
 */

export type BookingStatusKey =
  | 'ENQUIRY'
  | 'CONFIRMED'
  | 'POSTPONED'
  | 'COMPLETED'
  | 'DECLINED'
  | 'CANCELLED';

/** Mirrors the backend `BookingPaymentState` enum — always derived, never set directly. */
export type BookingPaymentStateKey =
  | 'NOT_INVOICED'
  | 'OPEN'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE';

export type StatusTone = 'neutral' | 'warning' | 'success' | 'info' | 'danger';

export interface BookingStatusMeta {
  /** Short user-facing label shown in badges/lists. */
  labelKey: TranslationKey;
  /** Verbose label used in detail panels where space allows (falls back to `labelKey`). */
  detailLabelKey?: TranslationKey;
  /**
   * Client-facing label. The `labelKey`/`detailLabelKey` above are the
   * photographer's pipeline vocabulary; a client reading their own booking
   * thinks in different terms ("Requested" vs. "New"). Falls back to
   * `labelKey` when unset.
   */
  customerLabelKey?: TranslationKey;
  tone: StatusTone;
}

export const BOOKING_STATUS: Record<BookingStatusKey, BookingStatusMeta> = {
  ENQUIRY: {
    labelKey: 'bookingStatus.ENQUIRY',
    customerLabelKey: 'bookingStatusCustomer.ENQUIRY',
    tone: 'neutral',
  },
  CONFIRMED: {
    labelKey: 'bookingStatus.CONFIRMED',
    customerLabelKey: 'bookingStatusCustomer.CONFIRMED',
    tone: 'success',
  },
  POSTPONED: {
    labelKey: 'bookingStatus.POSTPONED',
    customerLabelKey: 'bookingStatusCustomer.POSTPONED',
    tone: 'warning',
  },
  COMPLETED: {
    labelKey: 'bookingStatus.COMPLETED',
    customerLabelKey: 'bookingStatusCustomer.COMPLETED',
    tone: 'info',
  },
  DECLINED: {
    labelKey: 'bookingStatus.DECLINED',
    customerLabelKey: 'bookingStatusCustomer.DECLINED',
    tone: 'danger',
  },
  CANCELLED: {
    labelKey: 'bookingStatus.CANCELLED',
    customerLabelKey: 'bookingStatusCustomer.CANCELLED',
    tone: 'danger',
  },
};

export interface PaymentStateMeta {
  labelKey: TranslationKey;
  tone: StatusTone;
}

export const BOOKING_PAYMENT_STATE: Record<BookingPaymentStateKey, PaymentStateMeta> = {
  NOT_INVOICED: { labelKey: 'paymentState.NOT_INVOICED', tone: 'neutral' },
  OPEN: { labelKey: 'paymentState.OPEN', tone: 'warning' },
  PARTIALLY_PAID: { labelKey: 'paymentState.PARTIALLY_PAID', tone: 'warning' },
  PAID: { labelKey: 'paymentState.PAID', tone: 'success' },
  OVERDUE: { labelKey: 'paymentState.OVERDUE', tone: 'danger' },
};

export const getPaymentStateMeta = (state: string | null | undefined): PaymentStateMeta =>
  BOOKING_PAYMENT_STATE[state as BookingPaymentStateKey] ?? BOOKING_PAYMENT_STATE.NOT_INVOICED;

const FALLBACK: BookingStatusMeta = { labelKey: 'bookingStatus.UNKNOWN', tone: 'neutral' };

export const getBookingStatusMeta = (status: string): BookingStatusMeta =>
  BOOKING_STATUS[status as BookingStatusKey] ?? FALLBACK;

/** Client-facing status label key (falls back to the photographer label). */
export const getCustomerBookingStatusLabelKey = (status: string): TranslationKey => {
  const meta = getBookingStatusMeta(status);
  return meta.customerLabelKey ?? meta.labelKey;
};

/**
 * Legal forward transitions for each status. Mirrors the server-side state
 * machine in `BookingStatus.java` — the backend remains the authority (it
 * returns 409 on an illegal move); this map only decides which action
 * buttons the UI offers, so it must be kept in sync with that enum.
 */
export const BOOKING_TRANSITIONS: Record<BookingStatusKey, BookingStatusKey[]> = {
  ENQUIRY: ['CONFIRMED', 'DECLINED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'POSTPONED', 'CANCELLED'],
  POSTPONED: ['CONFIRMED', 'CANCELLED'],
  COMPLETED: ['CANCELLED'],
  DECLINED: [],
  CANCELLED: [],
};

/** Imperative button label key for transitioning a booking *into* a status. */
export const STATUS_ACTION_LABEL_KEY: Record<BookingStatusKey, TranslationKey> = {
  ENQUIRY: 'statusAction.ENQUIRY',
  CONFIRMED: 'statusAction.CONFIRMED',
  POSTPONED: 'statusAction.POSTPONED',
  COMPLETED: 'statusAction.COMPLETED',
  DECLINED: 'statusAction.DECLINED',
  CANCELLED: 'statusAction.CANCELLED',
};

export const getAllowedTransitions = (status: string): BookingStatusKey[] =>
  BOOKING_TRANSITIONS[status as BookingStatusKey] ?? [];

/**
 * Billable and Not happening (GLOSSARY.md), the same sets as the backend
 * `BookingStatus.BILLABLE` / `NOT_HAPPENING`. Every screen asks these instead
 * of keeping its own list.
 *
 * Billable is its own set, not "anything not cancelled": that reading is how
 * an enquiry's quote came to count as revenue on the dashboard while the
 * bookings overview, with its own stricter copy, left it out.
 */
const BILLABLE_STATUSES: readonly BookingStatusKey[] = ['CONFIRMED', 'POSTPONED', 'COMPLETED'];
const NOT_HAPPENING_STATUSES: readonly BookingStatusKey[] = ['CANCELLED', 'DECLINED'];

/** Its quoted value is money the studio has earned or will earn. An enquiry never is. */
export const isBillable = (status: string): boolean =>
  BILLABLE_STATUSES.includes(status as BookingStatusKey);

/** Cancelled or declined: the shoot will not take place. */
export const isNotHappening = (status: string): boolean =>
  NOT_HAPPENING_STATUSES.includes(status as BookingStatusKey);

/** Resolve a tone to its 3 visual slots ({ bg, text, dot }) from the active palette. */
export const toneToVisual = (tone: StatusTone, c: AppColors) => {
  switch (tone) {
    case 'success':
      return { bg: c.successBg, color: c.successText, dot: c.success };
    case 'warning':
      return { bg: c.warningBg, color: c.warningText, dot: c.warning };
    case 'danger':
      return { bg: c.dangerBg, color: c.dangerText, dot: c.danger };
    case 'info':
      return { bg: c.infoBg, color: c.infoText, dot: c.info };
    case 'neutral':
    default:
      return { bg: c.neutralBg, color: c.neutralText, dot: c.neutral };
  }
};
