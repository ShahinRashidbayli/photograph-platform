import { isNotHappening } from '@/lib/booking-status';
import type { Booking, Lead } from '@/types/api';
import type { Inquiry } from './inquiryTypes';
import { inquiryDisplayName } from './inquiryTypes';

/**
 * The leads page as an inbox: where a request stands, how long it has waited,
 * whether the photographer is free that day, and what a reply should say.
 *
 * <p>Pure, so the screen's judgement is unit-tested rather than rediscovered
 * by clicking. The page this replaced was a CRM view — pipeline tabs, score
 * bars, fact cards, an activity log — for what is mostly a first contact: read
 * the message, check the date, answer. Everything here serves that.
 */

/** Where a request stands, in the photographer's terms. */
export type InboxGroup = 'reply' | 'waiting' | 'closed';

export type InboxItem =
  | { kind: 'lead'; id: string; createdAt: string; group: InboxGroup; lead: Lead }
  | { kind: 'inquiry'; id: string; createdAt: string; group: InboxGroup; inquiry: Inquiry };

/**
 * A status change the photographer made a moment ago and can still undo.
 * The screen shows the item where it is going; the server hears about it
 * only once the undo window has passed (see `useDeferredStatus`).
 */
export type PendingStatus = {
  kind: 'lead' | 'inquiry';
  id: string;
  status: 'REPLIED' | 'REJECTED';
};

export function leadGroup(status: Lead['status']): InboxGroup {
  if (status === 'NEW') return 'reply';
  if (status === 'REPLIED') return 'waiting';
  return 'closed';
}

/**
 * Accepting a client's request creates the booking on the server in the same
 * step, so an inquiry is either waiting for an answer or done — it has no
 * "waiting for client" stage.
 */
export function inquiryGroup(status: Inquiry['status']): InboxGroup {
  return status === 'PENDING' ? 'reply' : 'closed';
}

function pendingKey(kind: string, id: string) {
  return `${kind}:${id}`;
}

export function pendingMap(pending: PendingStatus[]): Map<string, PendingStatus> {
  return new Map(pending.map((p) => [pendingKey(p.kind, p.id), p]));
}

/** The group an item is in once a pending change is applied. */
export function effectiveGroup(item: InboxItem, pending: Map<string, PendingStatus>): InboxGroup {
  const p = pending.get(pendingKey(item.kind, item.id));
  if (!p) return item.group;
  return p.status === 'REPLIED' ? 'waiting' : 'closed';
}

function matches(item: InboxItem, q: string): boolean {
  if (!q) return true;
  const hay =
    item.kind === 'lead'
      ? `${item.lead.name} ${item.lead.email ?? ''} ${item.lead.eventType ?? ''} ${item.lead.message ?? ''}`
      : `${item.inquiry.customerName ?? ''} ${item.inquiry.customerEmail ?? ''} ${item.inquiry.eventType ?? ''} ${item.inquiry.message ?? ''}`;
  return hay.toLowerCase().includes(q);
}

export type Inbox = Record<InboxGroup, InboxItem[]>;

/**
 * Both sources in one inbox, grouped. "To reply" runs oldest first — first
 * come, first answered, and the one that has waited longest is the one most
 * likely to go elsewhere. The other two run newest first.
 */
export function buildInbox(
  leads: Lead[],
  inquiries: Inquiry[],
  search: string,
  pending: PendingStatus[] = []
): Inbox {
  const q = search.trim().toLowerCase();
  const map = pendingMap(pending);
  const items: InboxItem[] = [
    ...leads.map(
      (lead): InboxItem => ({
        kind: 'lead',
        id: lead.id,
        createdAt: lead.createdAt,
        group: leadGroup(lead.status),
        lead,
      })
    ),
    ...inquiries.map(
      (inquiry): InboxItem => ({
        kind: 'inquiry',
        id: inquiry.id,
        createdAt: inquiry.createdAt,
        group: inquiryGroup(inquiry.status),
        inquiry,
      })
    ),
  ]
    .filter((item) => matches(item, q))
    .map((item) => ({ ...item, group: effectiveGroup(item, map) }));

  const by = (g: InboxGroup) => items.filter((i) => i.group === g);
  const oldest = (a: InboxItem, b: InboxItem) => Date.parse(a.createdAt) - Date.parse(b.createdAt);
  const newest = (a: InboxItem, b: InboxItem) => -oldest(a, b);
  return {
    reply: by('reply').sort(oldest),
    waiting: by('waiting').sort(newest),
    closed: by('closed').sort(newest),
  };
}

/** Whole days a request has been waiting, by the calendar (received yesterday = 1). */
export function waitingDays(createdAt: string, now: Date): number {
  const received = new Date(createdAt);
  const a = new Date(received.getFullYear(), received.getMonth(), received.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

// ─── The facts of a request, whichever source it came from ─────────────────

export type RequestFacts = {
  name: string;
  firstName: string;
  email: string | null;
  phone: string | null;
  /** `YYYY-MM-DD`, or null when they did not name one. */
  date: string | null;
  message: string;
  score: 'HIGH' | 'MED' | 'LOW';
  location: string | null;
};

export function factsOf(item: InboxItem): RequestFacts {
  if (item.kind === 'lead') {
    const l = item.lead;
    return {
      name: l.name,
      firstName: firstName(l.name),
      email: l.email || null,
      phone: l.phone || null,
      date: l.eventDate ? l.eventDate.slice(0, 10) : null,
      message: l.message ?? '',
      score: l.score,
      location: null,
    };
  }
  const i = item.inquiry;
  const name = inquiryDisplayName(i);
  return {
    name,
    firstName: i.customerName ? firstName(i.customerName) : name,
    email: i.customerEmail || null,
    phone: null,
    date: i.proposedDate ? i.proposedDate.slice(0, 10) : null,
    message: i.message ?? '',
    score: i.score,
    location: i.location || null,
  };
}

/**
 * The greeting name. A company ("Studio Weiß GmbH") is greeted whole; a
 * person by their first name.
 */
export function firstName(full: string): string {
  const trimmed = full.trim();
  if (/\b(GmbH|UG|AG|KG|e\.V\.|Ltd|Inc|Studio)\b/i.test(trimmed)) return trimmed;
  return trimmed.split(/\s+/)[0] || trimmed;
}

// ─── Am I free that day? ───────────────────────────────────────────────────

export type Availability =
  | { kind: 'none' }
  | { kind: 'free' }
  | { kind: 'busy'; bookings: Booking[] };

/**
 * Whether the studio already has a shoot on the requested day — the first
 * thing a photographer checks before answering, which used to mean leaving
 * the page for the bookings calendar.
 */
export function availabilityOn(date: string | null, bookings: Booking[]): Availability {
  if (!date) return { kind: 'none' };
  const same = bookings.filter(
    (b) => b.eventDate.slice(0, 10) === date && !isNotHappening(b.status)
  );
  return same.length ? { kind: 'busy', bookings: same } : { kind: 'free' };
}

// ─── Why it is (or is not) a priority ──────────────────────────────────────

export type Factor = 'budget' | 'type' | 'time';

/**
 * The components the server scored, sorted into what helped and what held it
 * back. An inquiry carries only the overall score, so it has neither list.
 */
export function priorityFactors(item: InboxItem): { strong: Factor[]; weak: Factor[] } {
  if (item.kind !== 'lead') return { strong: [], weak: [] };
  const parts: [Factor, number | undefined][] = [
    ['budget', item.lead.budgetScore],
    ['type', item.lead.typeScore],
    ['time', item.lead.timeScore],
  ];
  return {
    strong: parts.filter(([, v]) => v !== undefined && v >= 70).map(([f]) => f),
    weak: parts.filter(([, v]) => v !== undefined && v < 40).map(([f]) => f),
  };
}

// ─── Drafts ────────────────────────────────────────────────────────────────

/** A `mailto:` that opens the photographer's own mail app with a draft. */
export function mailtoHref(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Appends a prefilled message to a `wa.me` link from `whatsappHref`. */
export function withWhatsappText(href: string, text: string): string {
  return `${href}${href.includes('?') ? '&' : '?'}text=${encodeURIComponent(text)}`;
}
