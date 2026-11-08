import {
  availabilityOn,
  buildInbox,
  firstName,
  mailtoHref,
  priorityFactors,
  waitingDays,
  withWhatsappText,
} from './leads.inbox';
import type { Inquiry } from './inquiryTypes';
import type { Booking, Lead } from '@/types/api';

/**
 * The inbox's own judgement: what needs an answer, in what order, whether the
 * studio is free, why something scored as it did, and what a draft says.
 */

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 'l1',
    name: 'Sarah Meier',
    email: 'sarah@example.test',
    message: 'We are getting married.',
    eventDate: '2027-09-20',
    eventType: 'WEDDING',
    budgetRange: 'OVER_1000',
    score: 'HIGH',
    status: 'NEW',
    createdAt: '2026-11-08T09:30:00Z',
    ...overrides,
  };
}

function inquiry(overrides: Partial<Inquiry> = {}): Inquiry {
  return {
    id: 'i1',
    customerName: 'Mia Weber',
    customerEmail: 'mia@example.test',
    eventType: 'HOCHZEIT',
    budgetRange: '1000_2000',
    proposedDate: '2027-06-12',
    location: 'Köln',
    message: 'Hochzeit',
    score: 'HIGH',
    status: 'PENDING',
    source: 'PORTAL',
    createdAt: '2026-11-06T09:30:00Z',
    ...overrides,
  };
}

const booking = (overrides: Partial<Booking>): Booking => ({
  id: 'b1',
  clientName: 'Anna Schneider',
  clientEmail: 'anna@example.test',
  eventDate: '2026-12-23',
  totalAmountCents: 0,
  depositAmountCents: 0,
  status: 'CONFIRMED',
  createdAt: '2026-10-01T00:00:00Z',
  ...overrides,
});

describe('buildInbox', () => {
  it('groups requests by what they need', () => {
    const inbox = buildInbox(
      [
        lead({ id: 'new', status: 'NEW' }),
        lead({ id: 'replied', status: 'REPLIED' }),
        lead({ id: 'booked', status: 'BOOKED' }),
        lead({ id: 'rejected', status: 'REJECTED' }),
      ],
      [inquiry({ id: 'pending' }), inquiry({ id: 'created', status: 'BOOKING_CREATED' })],
      ''
    );
    expect(inbox.reply.map((i) => i.id)).toEqual(['pending', 'new']);
    expect(inbox.waiting.map((i) => i.id)).toEqual(['replied']);
    expect(inbox.closed.map((i) => i.id).sort()).toEqual(['booked', 'created', 'rejected']);
  });

  /** First come, first answered — the opposite of the old "newest first" default. */
  it('puts the request that has waited longest at the top', () => {
    const inbox = buildInbox(
      [
        lead({ id: 'today', createdAt: '2026-11-08T09:00:00Z' }),
        lead({ id: 'monday', createdAt: '2026-11-02T09:00:00Z' }),
      ],
      [inquiry({ id: 'friday', createdAt: '2026-11-06T09:00:00Z' })],
      ''
    );
    expect(inbox.reply.map((i) => i.id)).toEqual(['monday', 'friday', 'today']);
  });

  it('moves a request the moment it is answered, before the server hears of it', () => {
    const inbox = buildInbox([lead({ id: 'l1' }), lead({ id: 'l2' })], [], '', [
      { kind: 'lead', id: 'l1', status: 'REPLIED' },
      { kind: 'lead', id: 'l2', status: 'REJECTED' },
    ]);
    expect(inbox.reply).toEqual([]);
    expect(inbox.waiting.map((i) => i.id)).toEqual(['l1']);
    expect(inbox.closed.map((i) => i.id)).toEqual(['l2']);
  });

  it('searches name, email, occasion and message across both sources', () => {
    const inbox = buildInbox(
      [lead({ id: 'l1', message: 'Christmas family photos' })],
      [inquiry({ id: 'i1' })],
      'christmas'
    );
    expect(inbox.reply.map((i) => i.id)).toEqual(['l1']);
  });
});

describe('waitingDays', () => {
  const now = new Date(2026, 10, 8, 20, 0);

  it('counts calendar days, so last night is yesterday', () => {
    expect(waitingDays(new Date(2026, 10, 8, 9, 0).toISOString(), now)).toBe(0);
    expect(waitingDays(new Date(2026, 10, 7, 23, 0).toISOString(), now)).toBe(1);
    expect(waitingDays(new Date(2026, 10, 6, 9, 0).toISOString(), now)).toBe(2);
  });
});

describe('availabilityOn', () => {
  it('is free when nothing is booked that day', () => {
    expect(availabilityOn('2026-12-24', [booking({})])).toEqual({ kind: 'free' });
  });

  it('names what is already booked that day', () => {
    const result = availabilityOn('2026-12-23', [booking({})]);
    expect(result.kind).toBe('busy');
    expect(result.kind === 'busy' && result.bookings[0].clientName).toBe('Anna Schneider');
  });

  it('ignores cancelled and declined bookings', () => {
    expect(
      availabilityOn('2026-12-23', [
        booking({ status: 'CANCELLED' }),
        booking({ id: 'b2', status: 'DECLINED' }),
      ])
    ).toEqual({ kind: 'free' });
  });

  it('has nothing to say without a date', () => {
    expect(availabilityOn(null, [booking({})])).toEqual({ kind: 'none' });
  });
});

describe('priorityFactors', () => {
  it('sorts the scored components into what helped and what held it back', () => {
    const item = buildInbox([lead({ budgetScore: 95, typeScore: 55, timeScore: 20 })], [], '')
      .reply[0];
    expect(priorityFactors(item)).toEqual({ strong: ['budget'], weak: ['time'] });
  });

  it('has no components for a client request', () => {
    const item = buildInbox([], [inquiry()], '').reply[0];
    expect(priorityFactors(item)).toEqual({ strong: [], weak: [] });
  });
});

describe('drafts', () => {
  it('greets a person by first name and a company by its name', () => {
    expect(firstName('Sarah Meier')).toBe('Sarah');
    expect(firstName('Studio Weiß GmbH')).toBe('Studio Weiß GmbH');
  });

  it('encodes subject and body into a mailto link', () => {
    expect(mailtoHref('a@b.de', 'Ihre Anfrage', 'Hallo Sarah,\n\n')).toBe(
      'mailto:a@b.de?subject=Ihre%20Anfrage&body=Hallo%20Sarah%2C%0A%0A'
    );
  });

  it('adds the message to a WhatsApp link', () => {
    expect(withWhatsappText('https://wa.me/49171', 'Hi Sarah')).toBe(
      'https://wa.me/49171?text=Hi%20Sarah'
    );
  });
});
