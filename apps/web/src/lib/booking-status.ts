import type { AppColors } from '@/lib/design-tokens';
import type { TranslationKey } from '@/lib/i18n';

/**
 * Single source of truth for booking status presentation.
 *
 * Each status maps to:
 *   labelKey — dictionary key for the text shown in badges/lists
 *   tone     — semantic colour bucket from design-tokens (success/warning/etc.)
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
  | 'DEPOSIT_PAID'
  | 'CONFIRMED'
  | 'FULLY_PAID'
  | 'COMPLETED'
  | 'CANCELLED';

export type StatusTone = 'neutral' | 'warning' | 'success' | 'info' | 'danger';

export interface BookingStatusMeta {
  /** Short user-facing label shown in badges/lists. */
  labelKey: TranslationKey;
  /** Verbose label used in detail panels where space allows (falls back to `labelKey`). */
  detailLabelKey?: TranslationKey;
  /**
   * Client-facing label. The `labelKey`/`detailLabelKey` above are the
   * photographer's pipeline vocabulary ("New", "Deposit pending"); a client
   * reading their own booking thinks in different terms ("Requested",
   * "Awaiting your deposit"). Falls back to `labelKey` when unset.
   */
  customerLabelKey?: TranslationKey;
  tone: StatusTone;
}

export const BOOKING_STATUS: Record<BookingStatusKey, BookingStatusMeta> = {
  ENQUIRY: { labelKey: 'bookingStatus.ENQUIRY', customerLabelKey: 'bookingStatusCustomer.ENQUIRY', tone: 'neutral' },
  DEPOSIT_PAID: { labelKey: 'bookingStatus.DEPOSIT_PAID', detailLabelKey: 'bookingStatusDetail.DEPOSIT_PAID', customerLabelKey: 'bookingStatusCustomer.DEPOSIT_PAID', tone: 'warning' },
  CONFIRMED: { labelKey: 'bookingStatus.CONFIRMED', customerLabelKey: 'bookingStatusCustomer.CONFIRMED', tone: 'success' },
  FULLY_PAID: { labelKey: 'bookingStatus.FULLY_PAID', customerLabelKey: 'bookingStatusCustomer.FULLY_PAID', tone: 'success' },
  COMPLETED: { labelKey: 'bookingStatus.COMPLETED', customerLabelKey: 'bookingStatusCustomer.COMPLETED', tone: 'info' },
  CANCELLED: { labelKey: 'bookingStatus.CANCELLED', customerLabelKey: 'bookingStatusCustomer.CANCELLED', tone: 'danger' },
};

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
  ENQUIRY: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['DEPOSIT_PAID', 'FULLY_PAID', 'CANCELLED'],
  DEPOSIT_PAID: ['FULLY_PAID', 'CANCELLED'],
  FULLY_PAID: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

/** Imperative button label key for transitioning a booking *into* a status. */
export const STATUS_ACTION_LABEL_KEY: Record<BookingStatusKey, TranslationKey> = {
  ENQUIRY: 'statusAction.ENQUIRY',
  CONFIRMED: 'statusAction.CONFIRMED',
  DEPOSIT_PAID: 'statusAction.DEPOSIT_PAID',
  FULLY_PAID: 'statusAction.FULLY_PAID',
  COMPLETED: 'statusAction.COMPLETED',
  CANCELLED: 'statusAction.CANCELLED',
};

export const getAllowedTransitions = (status: string): BookingStatusKey[] =>
  BOOKING_TRANSITIONS[status as BookingStatusKey] ?? [];

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
