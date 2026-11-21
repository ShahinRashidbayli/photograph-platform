import {
  daysUntil,
  greetingName,
  icsFor,
  occasionKey,
  openRequests,
  splitShoots,
  stepsFor,
  todosFor,
  type PortalData,
} from './customer.portal';
import type { Booking, Invoice } from '@/types/api';
import type { Contract } from '@/hooks/useContracts';
import type { CustomerGallery } from '@/hooks/useGalleries';
import type { CustomerInquiryRequest } from '@/hooks/useInquiryRequests';

/**
 * What the client portal decides on the client's behalf: what is waiting on
 * them, where a shoot stands, and what is still ahead.
 */

const TODAY = new Date(2026, 10, 8);

const booking = (overrides: Partial<Booking> = {}): Booking => ({
  id: 'b1',
  clientName: 'Anna Schneider',
  clientEmail: 'anna@example.test',
  eventDate: '2027-06-12',
  eventType: 'HOCHZEIT',
  totalAmountCents: 100_000,
  depositAmountCents: 30_000,
  amountPaidCents: 30_000,
  paymentState: 'PARTIALLY_PAID',
  status: 'CONFIRMED',
  createdAt: '2026-11-01T10:00:00Z',
  ...overrides,
});

const contract = (overrides: Partial<Contract> = {}): Contract => ({
  id: 'k1',
  bookingId: 'b1',
  status: 'SENT',
  title: 'Fotografievertrag',
  body: '',
  recipientName: 'Anna Schneider',
  recipientEmail: 'anna@example.test',
  issuerName: 'Studio Lichtblick',
  issuerAddress: null,
  issuerEmail: null,
  signerName: null,
  signedAt: null,
  sentAt: '2026-11-03T10:00:00Z',
  cancelledAt: null,
  createdAt: '2026-11-03T10:00:00Z',
  editable: false,
  intact: true,
  ...overrides,
});

const invoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: 'i1',
  bookingId: 'b1',
  invoiceNumber: 'RE-2026-014',
  status: 'ISSUED',
  taxMode: 'KLEINUNTERNEHMER',
  buyerName: 'Anna Schneider',
  buyerEmail: 'anna@example.test',
  currency: 'EUR',
  subtotalCents: 70_000,
  taxCents: 0,
  totalCents: 70_000,
  paidCents: 0,
  outstandingCents: 70_000,
  dueDate: '2026-11-18',
  live: true,
  collectable: true,
  overdue: false,
  verwendungszweck: 'RE-2026-014',
  stornoOfId: null,
  pdfDownloadUrl: null,
  issuedAt: '2026-11-04T10:00:00Z',
  lineItems: [],
  ...overrides,
});

/** What the server sends for a Storno and for the invoice it withdraws. */
const withdrawn = { outstandingCents: 0, dueDate: null, live: false, collectable: false };

const gallery = (overrides: Partial<CustomerGallery> = {}): CustomerGallery => ({
  id: 'g1',
  bookingId: 'b0',
  eventType: 'FAMILIE',
  shootDate: '2026-09-20',
  photoCount: 248,
  downloadEnabled: true,
  expiresAt: '2027-01-20T00:00:00Z',
  accessToken: 'tok',
  coverUrl: null,
  ...overrides,
});

const data = (overrides: Partial<PortalData> = {}): PortalData => ({
  today: TODAY,
  contracts: [],
  invoices: [],
  galleries: [],
  ...overrides,
});

describe('todosFor', () => {
  it('asks for the signature first, then the money, then the photos', () => {
    const todos = todosFor(
      [booking()],
      data({ contracts: [contract()], invoices: [invoice()], galleries: [gallery()] })
    );
    expect(todos.map((t) => t.kind)).toEqual(['sign', 'pay', 'photos']);
  });

  it('leaves out what is already done or withdrawn', () => {
    const todos = todosFor(
      [booking()],
      data({
        contracts: [contract({ status: 'SIGNED' }), contract({ id: 'k2', status: 'CANCELLED' })],
        invoices: [
          invoice({ outstandingCents: 0, paidCents: 70_000, collectable: false }),
          invoice({ id: 'i2', status: 'STORNIERT', ...withdrawn }),
          invoice({ id: 'i3', stornoOfId: 'i2', totalCents: -70_000, ...withdrawn }),
        ],
      })
    );
    expect(todos).toEqual([]);
  });

  it('does not ask for a signature on a cancelled shoot', () => {
    const todos = todosFor([booking({ status: 'CANCELLED' })], data({ contracts: [contract()] }));
    expect(todos).toEqual([]);
  });

  it('orders payments by the shoot they belong to', () => {
    const todos = todosFor(
      [
        booking({ id: 'late', eventDate: '2027-08-01' }),
        booking({ id: 'soon', eventDate: '2026-12-01' }),
      ],
      data({
        invoices: [
          invoice({ id: 'for-late', bookingId: 'late' }),
          invoice({ id: 'for-soon', bookingId: 'soon' }),
        ],
      })
    );
    expect(todos.map((t) => t.id)).toEqual(['for-soon', 'for-late']);
  });
});

describe('stepsFor', () => {
  it('marks exactly one step as the current one', () => {
    const steps = stepsFor(booking(), data({ contracts: [contract()] }));
    expect(steps.map((s) => s.key)).toEqual([
      'confirmed',
      'contract',
      'payment',
      'shoot',
      'photos',
    ]);
    expect(steps.filter((s) => s.state === 'current').map((s) => s.key)).toEqual(['contract']);
  });

  /** A studio that sends no contract must not leave every client on a step that never completes. */
  it('leaves out a contract step when there is no contract', () => {
    const steps = stepsFor(booking(), data());
    expect(steps.map((s) => s.key)).not.toContain('contract');
    expect(steps.find((s) => s.state === 'current')?.key).toBe('payment');
  });

  it('starts at the request while the studio has not confirmed', () => {
    const steps = stepsFor(booking({ status: 'ENQUIRY' }), data());
    expect(steps[0]).toEqual({ key: 'requested', state: 'current' });
  });

  it('is complete once the photos are delivered', () => {
    const steps = stepsFor(
      booking({ status: 'COMPLETED', paymentState: 'PAID', amountPaidCents: 100_000 }),
      data({ galleries: [gallery({ bookingId: 'b1' })] })
    );
    expect(steps.every((s) => s.state === 'done')).toBe(true);
  });

  it('has no path for a cancelled shoot', () => {
    expect(stepsFor(booking({ status: 'CANCELLED' }), data())).toEqual([]);
  });
});

describe('splitShoots', () => {
  it('keeps today ahead, sorts upcoming soonest first and the rest latest first', () => {
    const { upcoming, past } = splitShoots(
      [
        booking({ id: 'june', eventDate: '2027-06-12' }),
        booking({ id: 'today', eventDate: '2026-11-08' }),
        booking({ id: 'sept', eventDate: '2026-09-20', status: 'COMPLETED' }),
        booking({ id: 'cancelled', eventDate: '2027-01-10', status: 'CANCELLED' }),
      ],
      TODAY
    );
    expect(upcoming.map((b) => b.id)).toEqual(['today', 'june']);
    expect(past.map((b) => b.id)).toEqual(['cancelled', 'sept']);
  });
});

describe('openRequests', () => {
  const request = (overrides: Partial<CustomerInquiryRequest>): CustomerInquiryRequest => ({
    id: 'r1',
    eventType: 'PORTRAIT',
    budgetRange: 'UNDER_500',
    proposedDate: '2027-03-14',
    location: 'Köln',
    message: null,
    status: 'PENDING',
    createdAt: '2026-11-08T09:00:00Z',
    ...overrides,
  });

  it('shows waiting and declined requests, not ones that became a booking', () => {
    const open = openRequests([
      request({ id: 'old', status: 'REJECTED', createdAt: '2026-10-01T09:00:00Z' }),
      request({ id: 'new' }),
      request({ id: 'booked', status: 'BOOKING_CREATED' }),
    ]);
    expect(open.map((r) => r.id)).toEqual(['new', 'old']);
  });
});

describe('words', () => {
  it('translates the request form codes and leaves free text alone', () => {
    expect(occasionKey('HOCHZEIT')).toBe('requestSession.type.HOCHZEIT');
    expect(occasionKey('Firmenfeier')).toBeNull();
  });

  it('greets by first name, never by an email address', () => {
    expect(greetingName('Anna Schneider')).toBe('Anna');
    expect(greetingName('anna@example.test')).toBeNull();
    expect(greetingName('  ')).toBeNull();
  });

  it('counts calendar days to the shoot', () => {
    expect(daysUntil('2026-11-08', TODAY)).toBe(0);
    expect(daysUntil('2027-06-12', TODAY)).toBe(216);
  });
});

describe('icsFor', () => {
  const stamp = new Date(Date.UTC(2026, 10, 8, 12, 0, 0));

  it('writes a timed event in floating local time', () => {
    const ics = icsFor(
      booking({ eventTime: '13:00:00', location: 'Schloss Bensberg, Bergisch Gladbach' }),
      'Hochzeit',
      stamp
    );
    expect(ics).toContain('DTSTART:20270612T130000');
    expect(ics).toContain('LOCATION:Schloss Bensberg\\, Bergisch Gladbach');
    expect(ics).toContain('DTSTAMP:20261108T120000Z');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('writes an all-day event when there is no start time', () => {
    expect(icsFor(booking(), 'Hochzeit', stamp)).toContain('DTSTART;VALUE=DATE:20270612');
  });
});
