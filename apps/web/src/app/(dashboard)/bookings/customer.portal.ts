import type { Booking, Invoice } from '@/types/api';
import type { Contract } from '@/hooks/useContracts';
import type { CustomerGallery } from '@/hooks/useGalleries';
import type { CustomerInquiryRequest } from '@/hooks/useInquiryRequests';
import type { TranslationKey } from '@/lib/i18n';
import { isNotHappening } from '@/lib/booking-status';
import { parseApiDate } from '@/lib/date';

/**
 * The client portal's judgement: what is waiting on the client, where each
 * shoot stands, and which shoots are still ahead.
 *
 * <p>A client asks three things of this portal — when is the shoot, what do I
 * have to do, where are my photos — and the answers used to be spread over
 * four pages. Pure, so the answers are unit-tested rather than rediscovered by
 * clicking, the same way `bookings.insights.ts` does it for the studio.
 */

export type PortalData = {
  /** Start of today, local. */
  today: Date;
  contracts: Contract[];
  invoices: Invoice[];
  galleries: CustomerGallery[];
};

export function isCancelled(b: Booking): boolean {
  return isNotHappening(b.status);
}

/** Whole calendar days from today to the shoot (negative once it is past). */
export function daysUntil(eventDate: string, today: Date): number {
  return Math.round((parseApiDate(eventDate).getTime() - today.getTime()) / 86_400_000);
}

// ─── What belongs to one booking ───────────────────────────────────────────

/**
 * The invoices the client can owe on one booking: the Live ones, as the server
 * says (ADR-004). A Storno and the original it withdraws are both out: neither
 * is ever paid, and the audit trail lives on the studio's side.
 */
export function invoicesFor(bookingId: string, invoices: Invoice[]): Invoice[] {
  return invoices.filter((i) => i.bookingId === bookingId && i.live);
}

/** Sent or signed; a cancelled contract is no longer the client's business. */
export function contractsFor(bookingId: string, contracts: Contract[]): Contract[] {
  return contracts.filter((k) => k.bookingId === bookingId && k.status !== 'CANCELLED');
}

export function galleryFor(
  bookingId: string,
  galleries: CustomerGallery[]
): CustomerGallery | null {
  return galleries.find((g) => g.bookingId === bookingId) ?? null;
}

// ─── What is waiting on the client ─────────────────────────────────────────

export type Todo =
  | { kind: 'sign'; id: string; contract: Contract; booking: Booking | null }
  | { kind: 'pay'; id: string; invoice: Invoice; booking: Booking | null }
  | { kind: 'photos'; id: string; gallery: CustomerGallery; booking: Booking | null };

/**
 * Everything that needs the client, in the order it matters: a contract to
 * sign before money is asked for, money before photos. Within each kind the
 * earliest shoot first, and the gallery that expires first.
 *
 * <p>Photos count as something to do while the gallery is open: it closes on a
 * date, and a client who never downloads loses them.
 */
export function todosFor(bookings: Booking[], data: PortalData): Todo[] {
  const byId = new Map(bookings.map((b) => [b.id, b]));
  const bookingOf = (id: string | null) => (id ? (byId.get(id) ?? null) : null);
  const shootTime = (b: Booking | null) =>
    b ? parseApiDate(b.eventDate).getTime() : Number.MAX_SAFE_INTEGER;

  const sign: Todo[] = data.contracts
    .filter((k) => k.status === 'SENT')
    .map((k) => ({ kind: 'sign' as const, id: k.id, contract: k, booking: bookingOf(k.bookingId) }))
    .filter((t) => !(t.booking && isCancelled(t.booking)))
    .sort((a, b) => shootTime(a.booking) - shootTime(b.booking));

  // Collectable is the server's answer (ADR-004), not something to work out
  // from the status and the figures: a second copy of that rule is one that
  // can disagree with the payment endpoint.
  const pay: Todo[] = data.invoices
    .filter((i) => i.collectable)
    .map((i) => ({ kind: 'pay' as const, id: i.id, invoice: i, booking: bookingOf(i.bookingId) }))
    .sort(
      (a, b) =>
        shootTime(a.booking) - shootTime(b.booking) ||
        Date.parse(a.invoice.issuedAt) - Date.parse(b.invoice.issuedAt)
    );

  const expiry = (g: CustomerGallery) =>
    g.expiresAt ? Date.parse(g.expiresAt) : Number.MAX_SAFE_INTEGER;
  const photos: Todo[] = [...data.galleries]
    .sort((a, b) => expiry(a) - expiry(b))
    .map((g) => ({
      kind: 'photos' as const,
      id: g.id,
      gallery: g,
      booking: bookingOf(g.bookingId),
    }));

  return [...sign, ...pay, ...photos];
}

// ─── Where a shoot stands ──────────────────────────────────────────────────

export type StepKey = 'requested' | 'confirmed' | 'contract' | 'payment' | 'shoot' | 'photos';
export type StepState = 'done' | 'current' | 'todo';
export type Step = { key: StepKey; state: StepState };

/**
 * The shoot's path from the client's side, with one "you are here".
 *
 * <p>A step that does not apply is left out rather than shown as pending: a
 * studio that sends no contract would otherwise leave every client staring at
 * a step that never completes. A cancelled shoot has no path at all.
 */
export function stepsFor(booking: Booking, data: PortalData): Step[] {
  if (isCancelled(booking)) return [];

  const contracts = contractsFor(booking.id, data.contracts);
  const invoices = invoicesFor(booking.id, data.invoices);
  const total = booking.totalAmountCents;
  const paid = booking.amountPaidCents ?? 0;

  const parts: { key: StepKey; done: boolean }[] = [
    booking.status === 'ENQUIRY'
      ? { key: 'requested', done: false }
      : { key: 'confirmed', done: true },
  ];
  if (contracts.length > 0) {
    parts.push({ key: 'contract', done: contracts.every((k) => k.status === 'SIGNED') });
  }
  if (total > 0 || invoices.length > 0) {
    parts.push({
      key: 'payment',
      done: booking.paymentState === 'PAID' || (total > 0 && paid >= total),
    });
  }
  parts.push({
    key: 'shoot',
    done: booking.status === 'COMPLETED' || daysUntil(booking.eventDate, data.today) < 0,
  });
  parts.push({ key: 'photos', done: galleryFor(booking.id, data.galleries) !== null });

  const current = parts.findIndex((p) => !p.done);
  return parts.map((p, i) => ({
    key: p.key,
    state: p.done ? 'done' : i === current ? 'current' : 'todo',
  }));
}

// ─── Ahead and behind ──────────────────────────────────────────────────────

/**
 * Shoots still ahead (soonest first) and the rest (latest first). A shoot today
 * is still ahead. Cancelled ones sit with the past whatever their date — they
 * are not something to look forward to.
 */
export function splitShoots(
  bookings: Booking[],
  today: Date
): { upcoming: Booking[]; past: Booking[] } {
  const ahead = (b: Booking) =>
    !isCancelled(b) && b.status !== 'COMPLETED' && daysUntil(b.eventDate, today) >= 0;
  const when = (b: Booking) => parseApiDate(b.eventDate).getTime();
  return {
    upcoming: bookings.filter(ahead).sort((a, b) => when(a) - when(b)),
    past: bookings.filter((b) => !ahead(b)).sort((a, b) => when(b) - when(a)),
  };
}

/**
 * Requests the photographer has not turned into a booking: still waiting, or
 * declined. An accepted one is already among the shoots.
 */
export function openRequests(requests: CustomerInquiryRequest[]): CustomerInquiryRequest[] {
  return requests
    .filter((r) => r.status === 'PENDING' || r.status === 'REJECTED')
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

// ─── Words ─────────────────────────────────────────────────────────────────

/**
 * The client's own request form stores its occasion as a code; a booking the
 * studio typed in carries free text. The code is translated, free text shown
 * as written.
 */
const OCCASION_KEY: Record<string, TranslationKey> = {
  HOCHZEIT: 'requestSession.type.HOCHZEIT',
  PORTRAIT: 'requestSession.type.PORTRAIT',
  FAMILIE: 'requestSession.type.FAMILIE',
  EVENT: 'requestSession.type.EVENT',
  ANDERES: 'requestSession.type.ANDERES',
};

export function occasionKey(eventType: string | null | undefined): TranslationKey | null {
  return eventType ? (OCCASION_KEY[eventType] ?? null) : null;
}

/** The name to greet: a first name when we have one, nothing rather than an email. */
export function greetingName(fullName: string | null | undefined): string | null {
  const first = fullName?.trim().split(/\s+/)[0];
  return first && !first.includes('@') ? first : null;
}

// ─── Calendar file ─────────────────────────────────────────────────────────

function icsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/([,;])/g, '\\$1');
}

/**
 * A one-event calendar file for "add to calendar". Floating local time when the
 * shoot has a start, an all-day event when it has not — the booking carries no
 * end, and inventing a duration would put a wrong one in the client's diary.
 */
export function icsFor(booking: Booking, title: string, stamp: Date): string {
  const day = booking.eventDate.slice(0, 10).replace(/-/g, '');
  const time = booking.eventTime?.slice(0, 5).replace(':', '');
  const pad = (n: number) => String(n).padStart(2, '0');
  const dtstamp =
    `${stamp.getUTCFullYear()}${pad(stamp.getUTCMonth() + 1)}${pad(stamp.getUTCDate())}T` +
    `${pad(stamp.getUTCHours())}${pad(stamp.getUTCMinutes())}${pad(stamp.getUTCSeconds())}Z`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Fotolio//Client portal//EN',
    'BEGIN:VEVENT',
    `UID:${booking.id}@fotolio`,
    `DTSTAMP:${dtstamp}`,
    time ? `DTSTART:${day}T${time}00` : `DTSTART;VALUE=DATE:${day}`,
    `SUMMARY:${icsText(title)}`,
    ...(booking.location ? [`LOCATION:${icsText(booking.location)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}

/** The request form's budget ranges, as the client picked them. */
export const BUDGET_RANGES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'UNDER_500', label: '€200–500' },
  { value: '500_1000', label: '€500–1.000' },
  { value: '1000_2000', label: '€1.000–2.000' },
  { value: 'OVER_2000', label: '€2.000+' },
];

export function budgetLabel(value: string | null | undefined): string | null {
  return BUDGET_RANGES.find((b) => b.value === value)?.label ?? null;
}

/**
 * Whole euros where the amount is whole, cents where it is not: "€700", but
 * "€699,50" — rounding a sum someone is about to pay would show the wrong one.
 */
export function moneyText(
  cents: number,
  format: { eur: (_cents: number) => string; eurExact: (_cents: number) => string }
): string {
  return cents % 100 === 0 ? format.eur(cents) : format.eurExact(cents);
}
