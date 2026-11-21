import {
  attentionFor,
  indexContracts,
  nextActions,
  openBalanceCents,
  progressSteps,
  type BookingContext,
} from './bookings.insights';
import type { Contract } from '@/hooks/useContracts';
import type { Gallery } from '@/hooks/useGalleries';
import type { Booking } from '@/types/api';

/**
 * The decisions the booking detail makes on its own: which button leads, what
 * waits on the photographer, how far along a booking is.
 *
 * <p>The one that started this: the old detail led with "Mark completed" on a
 * shoot eleven days away, because it showed the status machine's first legal
 * move. Legal is not the same as sensible.
 */

const TODAY = new Date(2026, 10, 8); // Sunday 8 Nov 2026

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'bk-1',
    clientName: 'Sophie & Luca Bauer',
    clientEmail: 'sophie@example.test',
    eventDate: '2026-11-19',
    totalAmountCents: 115_000,
    depositAmountCents: 45_000,
    status: 'CONFIRMED',
    paymentState: 'NOT_INVOICED',
    amountPaidCents: 0,
    openBalanceCents: 115_000,
    createdAt: '2026-10-01T10:00:00Z',
    ...overrides,
  };
}

function ctx(overrides: Partial<BookingContext> = {}): BookingContext {
  return { today: TODAY, contract: null, gallery: null, contractsEnabled: true, ...overrides };
}

const contract = (overrides: Partial<Contract>): Contract =>
  ({
    id: 'c-1',
    bookingId: 'bk-1',
    status: 'DRAFT',
    signedAt: null,
    sentAt: null,
    createdAt: '2026-10-02T10:00:00Z',
    ...overrides,
  }) as Contract;

const gallery = { id: 'g-1', bookingId: 'bk-1', photoCount: 186 } as Gallery;

describe('nextActions', () => {
  it('never leads with "Mark completed" before the shoot', () => {
    const upcoming = booking({
      paymentState: 'PARTIALLY_PAID',
      amountPaidCents: 45_000,
      openBalanceCents: 70_000,
    });
    expect(nextActions(upcoming, ctx(), true)).toEqual({
      primary: 'recordPayment',
      secondary: null,
    });
  });

  it('asks for an invoice when money is owed but nothing open is invoiced', () => {
    expect(nextActions(booking(), ctx(), false).primary).toBe('newInvoice');
  });

  it('has no lead action on an upcoming booking that is fully paid', () => {
    const paid = booking({ paymentState: 'PAID', amountPaidCents: 115_000, openBalanceCents: 0 });
    expect(nextActions(paid, ctx(), false).primary).toBeNull();
  });

  it('leads with "Mark completed" once the shoot has happened', () => {
    const shot = booking({
      eventDate: '2026-11-05',
      paymentState: 'PAID',
      amountPaidCents: 115_000,
      openBalanceCents: 0,
    });
    expect(nextActions(shot, ctx(), false)).toEqual({
      primary: 'complete',
      secondary: 'createGallery',
    });
  });

  it('answers an enquiry with confirm or decline', () => {
    expect(nextActions(booking({ status: 'ENQUIRY', openBalanceCents: 0 }), ctx(), false)).toEqual({
      primary: 'confirm',
      secondary: 'decline',
    });
  });

  it('asks for the gallery after a completed shoot that has none', () => {
    const done = booking({
      status: 'COMPLETED',
      paymentState: 'PAID',
      amountPaidCents: 115_000,
      openBalanceCents: 0,
    });
    expect(nextActions(done, ctx(), false).primary).toBe('createGallery');
    expect(nextActions(done, ctx({ gallery }), false).primary).toBeNull();
  });

  it.each(['CANCELLED', 'DECLINED'] as const)('offers nothing on a %s booking', (status) => {
    expect(nextActions(booking({ status, openBalanceCents: 0 }), ctx(), true)).toEqual({
      primary: null,
      secondary: null,
    });
  });
});

describe('attentionFor', () => {
  it('ranks an enquiry above everything else', () => {
    expect(attentionFor(booking({ status: 'ENQUIRY', paymentState: 'OVERDUE' }), ctx())).toBe(
      'reply'
    );
  });

  it('flags a confirmed shoot whose date has passed', () => {
    expect(attentionFor(booking({ eventDate: '2026-11-05' }), ctx())).toBe('close');
  });

  it('flags an overdue payment', () => {
    expect(attentionFor(booking({ paymentState: 'OVERDUE' }), ctx())).toBe('overdue');
  });

  it('flags a sent, unsigned contract only on plans that have contracts', () => {
    const sent = contract({ status: 'SENT' });
    expect(attentionFor(booking(), ctx({ contract: sent }))).toBe('contractUnsigned');
    expect(attentionFor(booking(), ctx({ contract: sent, contractsEnabled: false }))).toBeNull();
  });

  it('leaves a booking with nothing outstanding alone', () => {
    expect(attentionFor(booking(), ctx({ contract: contract({ status: 'SIGNED' }) }))).toBeNull();
  });
});

/**
 * Which bookings owe money is the server's rule now (BookingMapperTest): an
 * enquiry or a cancelled booking comes back with an open balance of zero. This
 * only reads it.
 */
describe('openBalanceCents', () => {
  it('is what the server says is still to come in', () => {
    expect(openBalanceCents(booking({ amountPaidCents: 45_000, openBalanceCents: 70_000 }))).toBe(
      70_000
    );
  });

  it("is zero on a booking that does not carry it, as a Customer's does not", () => {
    expect(openBalanceCents(booking({ openBalanceCents: undefined }))).toBe(0);
  });
});

describe('progressSteps', () => {
  it('walks a booking from confirmed to delivered', () => {
    const steps = progressSteps(
      booking({ status: 'COMPLETED', paymentState: 'PAID', amountPaidCents: 115_000 }),
      ctx({ contract: contract({ status: 'SIGNED', signedAt: '2026-10-14T09:00:00Z' }), gallery })
    );
    expect(steps?.map((s) => [s.key, s.state])).toEqual([
      ['confirmed', 'done'],
      ['contract', 'done'],
      ['payment', 'done'],
      ['shoot', 'done'],
      ['gallery', 'done'],
    ]);
  });

  it('marks the shoot as the current step of an upcoming, deposit-paid booking', () => {
    const steps = progressSteps(
      booking({ paymentState: 'PARTIALLY_PAID', amountPaidCents: 45_000 }),
      ctx({ contract: contract({ status: 'SIGNED' }) })
    );
    expect(steps?.find((s) => s.key === 'payment')).toMatchObject({
      state: 'done',
      phase: 'deposit',
      amountCents: 45_000,
    });
    expect(steps?.find((s) => s.key === 'shoot')).toMatchObject({ state: 'current', days: 11 });
    expect(steps?.find((s) => s.key === 'gallery')?.state).toBe('todo');
  });

  it('marks only the first waiting step as current', () => {
    const steps = progressSteps(
      booking({ paymentState: 'OPEN' }),
      ctx({ contract: contract({ status: 'SENT', sentAt: '2026-11-03T09:00:00Z' }) })
    );
    expect(steps?.filter((s) => s.state === 'current').map((s) => s.key)).toEqual(['contract']);
  });

  it('leaves the contract step out on plans without contracts', () => {
    const steps = progressSteps(booking(), ctx({ contractsEnabled: false }));
    expect(steps?.map((s) => s.key)).toEqual(['confirmed', 'payment', 'shoot', 'gallery']);
  });

  it('draws nothing for a booking that will not happen', () => {
    expect(progressSteps(booking({ status: 'CANCELLED' }), ctx())).toBeNull();
    expect(progressSteps(booking({ status: 'DECLINED' }), ctx())).toBeNull();
  });
});

describe('indexContracts', () => {
  it('keeps the newest live contract per booking and skips cancelled ones', () => {
    const index = indexContracts([
      contract({ id: 'old', createdAt: '2026-09-01T00:00:00Z', status: 'SIGNED' }),
      contract({ id: 'new', createdAt: '2026-10-01T00:00:00Z', status: 'SENT' }),
      contract({ id: 'gone', createdAt: '2026-11-01T00:00:00Z', status: 'CANCELLED' }),
    ]);
    expect(index.get('bk-1')?.id).toBe('new');
  });
});
