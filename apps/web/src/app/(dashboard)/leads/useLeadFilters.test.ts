import { act, renderHook } from '@testing-library/react';
import { useLeadFilters } from './useLeadFilters';
import type { Inquiry } from './inquiryTypes';
import type { Lead } from '@/types/api';

/**
 * The rules deciding which enquiries a photographer sees, and in what order.
 * The inbox draws from two unrelated sources — anonymous form leads and
 * authenticated customer inquiries — which is where the interesting cases are.
 */

function lead(o: Partial<Lead> = {}): Lead {
  return {
    id: 'l1',
    name: 'Anna Schmidt',
    email: 'anna@example.test',
    message: 'Was kostet eine Hochzeit?',
    eventDate: '2026-10-01',
    eventType: 'WEDDING',
    budgetRange: 'OVER_1000',
    score: 'HIGH',
    status: 'NEW',
    createdAt: '2026-08-10T10:00:00Z',
    ...o,
  };
}

function inquiry(o: Partial<Inquiry> = {}): Inquiry {
  return {
    id: 'i1',
    customerName: 'Bea Winter',
    customerEmail: 'bea@example.test',
    eventType: 'HOCHZEIT',
    budgetRange: 'OVER_2000',
    proposedDate: null,
    location: null,
    message: null,
    score: 'HIGH',
    status: 'PENDING',
    source: 'customer',
    createdAt: '2026-08-12T10:00:00Z',
    ...o,
  };
}

const ids = (items: ReturnType<typeof useLeadFilters>['inboxItems']) => items.map((i) => i.id);

describe('sort order', () => {
  it('puts the newest first by default and flips to oldest', () => {
    const leads = [
      lead({ id: 'old', createdAt: '2026-01-01T00:00:00Z' }),
      lead({ id: 'new', createdAt: '2026-08-01T00:00:00Z' }),
      lead({ id: 'mid', createdAt: '2026-04-01T00:00:00Z' }),
    ];
    const { result } = renderHook(() => useLeadFilters(leads, []));

    expect(ids(result.current.inboxItems)).toEqual(['new', 'mid', 'old']);
    act(() => result.current.setSortOrder('oldest'));
    expect(ids(result.current.inboxItems)).toEqual(['old', 'mid', 'new']);
  });

  /**
   * The regression this file exists for. Each source used to be sorted on its
   * own and the page concatenated the two, so every inquiry rendered above
   * every lead whatever the dates said: with "newest first" selected, an
   * August lead sat below a January inquiry. The sort is a property of the
   * inbox, so it has to be applied to the merged sequence.
   */
  it('orders both sources against each other, not each within itself', () => {
    const leads = [lead({ id: 'lead-aug', createdAt: '2026-08-20T00:00:00Z' })];
    const inquiries = [inquiry({ id: 'inq-jan', createdAt: '2026-01-01T00:00:00Z' })];
    const { result } = renderHook(() => useLeadFilters(leads, inquiries));

    expect(ids(result.current.inboxItems)).toEqual(['lead-aug', 'inq-jan']);
    act(() => result.current.setSortOrder('oldest'));
    expect(ids(result.current.inboxItems)).toEqual(['inq-jan', 'lead-aug']);
  });

  it('interleaves the two sources by date', () => {
    const leads = [
      lead({ id: 'l-mar', createdAt: '2026-03-01T00:00:00Z' }),
      lead({ id: 'l-may', createdAt: '2026-05-01T00:00:00Z' }),
    ];
    const inquiries = [
      inquiry({ id: 'i-feb', createdAt: '2026-02-01T00:00:00Z' }),
      inquiry({ id: 'i-apr', createdAt: '2026-04-01T00:00:00Z' }),
    ];
    const { result } = renderHook(() => useLeadFilters(leads, inquiries));

    expect(ids(result.current.inboxItems)).toEqual(['l-may', 'i-apr', 'l-mar', 'i-feb']);
  });

  it('tags each row with the source it came from', () => {
    const { result } = renderHook(() => useLeadFilters([lead()], [inquiry()]));

    expect(result.current.inboxItems.map((i) => i.kind)).toEqual(['inquiry', 'lead']);
  });

  /** The sources are arrays held in the inbox hook's state; sorting them in
   *  place would mutate state React believes it owns. */
  it('does not reorder the arrays it was given', () => {
    const leads = [
      lead({ id: 'a', createdAt: '2026-01-01T00:00:00Z' }),
      lead({ id: 'b', createdAt: '2026-08-01T00:00:00Z' }),
    ];
    renderHook(() => useLeadFilters(leads, []));

    expect(leads.map((l) => l.id)).toEqual(['a', 'b']);
  });
});

describe('pipeline counts', () => {
  it('matches the number of rows the Active tab renders', () => {
    const leads = [
      lead({ id: 'a', status: 'NEW' }),
      lead({ id: 'b', status: 'REPLIED' }),
      lead({ id: 'c', status: 'BOOKED' }),
    ];
    const { result } = renderHook(() => useLeadFilters(leads, [inquiry({ status: 'PENDING' })]));

    expect(result.current.inboxItems).toHaveLength(result.current.pipelineCounts.Active);
  });

  it.each([
    ['BOOKING_CREATED', 'Booked'],
    ['REJECTED', 'Rejected'],
    ['PENDING', 'Active'],
    ['ACCEPTED', 'Active'],
  ] as const)('files an inquiry in %s under %s', (status, bucket) => {
    const { result } = renderHook(() => useLeadFilters([], [inquiry({ status })]));

    expect(result.current.pipelineCounts[bucket]).toBe(1);
  });

  /** Counts describe the whole pipeline, not the filtered subset — otherwise
   *  narrowing the score would shuffle the tab numbers underneath. */
  it('ignores the score filter', () => {
    const leads = [lead({ id: 'a', score: 'HIGH' }), lead({ id: 'b', score: 'LOW' })];
    const { result } = renderHook(() => useLeadFilters(leads, []));

    act(() => result.current.setFilterScore('High'));
    expect(result.current.inboxItems).toHaveLength(1);
    expect(result.current.pipelineCounts.Active).toBe(2);
  });
});

describe('search', () => {
  it('is case-insensitive and ignores surrounding space', () => {
    const leads = [
      lead({ id: 'a', name: 'Anna Schmidt', email: 'a@example.test' }),
      lead({ id: 'b', name: 'Bea Winter', email: 'b@example.test' }),
    ];
    const { result } = renderHook(() => useLeadFilters(leads, []));

    act(() => result.current.setSearchTerm('  ANNA  '));
    expect(ids(result.current.inboxItems)).toEqual(['a']);
  });

  it('reaches an inquiry by its customer name, which is not called `name`', () => {
    const { result } = renderHook(() => useLeadFilters([], [inquiry({ id: 'i1' })]));

    act(() => result.current.setSearchTerm('bea'));
    expect(ids(result.current.inboxItems)).toEqual(['i1']);
  });

  it('searches both sources at once', () => {
    const leads = [lead({ id: 'l', message: 'Strandshooting' })];
    const inquiries = [inquiry({ id: 'i', message: 'Strandshooting im Juli' })];
    const { result } = renderHook(() => useLeadFilters(leads, inquiries));

    act(() => result.current.setSearchTerm('strand'));
    expect(ids(result.current.inboxItems).sort()).toEqual(['i', 'l']);
  });
});

describe('source filter', () => {
  it('hides the other source and drops it from the counts', () => {
    const { result } = renderHook(() =>
      useLeadFilters([lead({ id: 'l' })], [inquiry({ id: 'i' })])
    );
    expect(result.current.pipelineCounts.Active).toBe(2);

    act(() => result.current.setSourceFilter('form'));
    expect(ids(result.current.inboxItems)).toEqual(['l']);
    expect(result.current.pipelineCounts.Active).toBe(1);

    act(() => result.current.setSourceFilter('customer'));
    expect(ids(result.current.inboxItems)).toEqual(['i']);
    expect(result.current.pipelineCounts.Active).toBe(1);
  });
});
