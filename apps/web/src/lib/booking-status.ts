import type { AppColors } from '@/lib/design-tokens';

/**
 * Single source of truth for booking status presentation.
 *
 * Each status maps to:
 *   label — short user-facing text shown in badges/lists
 *   tone  — semantic colour bucket from design-tokens (success/warning/etc.)
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
  label: string;
  /** Verbose label used in detail panels where space allows (falls back to `label`). */
  detailLabel?: string;
  tone: StatusTone;
}

export const BOOKING_STATUS: Record<BookingStatusKey, BookingStatusMeta> = {
  ENQUIRY: { label: 'New', tone: 'neutral' },
  DEPOSIT_PAID: { label: 'Deposit', detailLabel: 'Deposit pending', tone: 'warning' },
  CONFIRMED: { label: 'Confirmed', tone: 'success' },
  FULLY_PAID: { label: 'Paid', tone: 'success' },
  COMPLETED: { label: 'Completed', tone: 'info' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
};

const FALLBACK: BookingStatusMeta = { label: 'Unknown', tone: 'neutral' };

export const getBookingStatusMeta = (status: string): BookingStatusMeta =>
  BOOKING_STATUS[status as BookingStatusKey] ?? FALLBACK;

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

/** Imperative button label for transitioning a booking *into* a status. */
export const STATUS_ACTION_LABEL: Record<BookingStatusKey, string> = {
  ENQUIRY: 'Reopen enquiry',
  CONFIRMED: 'Confirm booking',
  DEPOSIT_PAID: 'Mark deposit paid',
  FULLY_PAID: 'Mark fully paid',
  COMPLETED: 'Mark completed',
  CANCELLED: 'Cancel booking',
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
