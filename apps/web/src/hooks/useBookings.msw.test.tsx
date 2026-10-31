import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse, server } from '@/test-utils/msw';
import {
  bookingsQueryKey,
  useBookingConflicts,
  useSaveBooking,
  useUpdateBookingStatus,
  type BookingPayload,
} from '@/hooks/useBookings';
import type { Booking } from '@/types/api';

/**
 * The booking mutations against a faked API.
 *
 * <p>These used to be written inline in the bookings page and the create
 * modal. What has to survive the move is what the screen relies on: a saved
 * booking appears once and in date order, and a status change shows at once
 * and is taken back exactly when the server refuses it.
 */
function booking(id: string, eventDate: string, status: Booking['status'] = 'CONFIRMED') {
  return { id, eventDate, status, clientName: id } as Booking;
}

const PAYLOAD = { clientName: 'x', eventDate: '2026-09-02' } as BookingPayload;

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  client.setQueryData(bookingsQueryKey(true), [
    booking('a', '2026-09-01'),
    booking('c', '2026-09-03'),
  ]);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const list = () =>
    (client.getQueryData<Booking[]>(bookingsQueryKey(true)) ?? []).map((b) => b.id);
  const statusOf = (id: string) =>
    client.getQueryData<Booking[]>(bookingsQueryKey(true))?.find((b) => b.id === id)?.status;
  return { wrapper, list, statusOf };
}

describe('useSaveBooking', () => {
  it('files a new booking in at its date, once', async () => {
    server.use(http.post('/api/bookings', () => HttpResponse.json(booking('b', '2026-09-02'))));
    const { wrapper, list } = setup();
    const { result } = renderHook(() => useSaveBooking(), { wrapper });

    await act(() => result.current.mutateAsync({ payload: PAYLOAD }));

    expect(list()).toEqual(['a', 'b', 'c']);
  });

  it('moves an edited booking to its new date instead of adding a second one', async () => {
    server.use(http.patch('/api/bookings/a', () => HttpResponse.json(booking('a', '2026-09-04'))));
    const { wrapper, list } = setup();
    const { result } = renderHook(() => useSaveBooking(), { wrapper });

    await act(() => result.current.mutateAsync({ id: 'a', payload: PAYLOAD }));

    expect(list()).toEqual(['c', 'a']);
  });
});

describe('useUpdateBookingStatus', () => {
  it('shows the new status before the server answers', async () => {
    let answer: () => void = () => {};
    server.use(
      http.patch(
        '/api/bookings/a/status',
        () =>
          new Promise((resolve) => {
            answer = () => resolve(HttpResponse.json(booking('a', '2026-09-01', 'POSTPONED')));
          })
      )
    );
    const { wrapper, statusOf } = setup();
    const { result } = renderHook(() => useUpdateBookingStatus(), { wrapper });

    act(() => result.current.mutate({ id: 'a', from: 'CONFIRMED', to: 'POSTPONED' }));

    await waitFor(() => expect(statusOf('a')).toBe('POSTPONED'));
    answer();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(statusOf('a')).toBe('POSTPONED');
  });

  it('puts the old status back when the server refuses', async () => {
    server.use(
      http.patch('/api/bookings/a/status', () =>
        HttpResponse.json({ error: 'Not allowed' }, { status: 409 })
      )
    );
    const { wrapper, statusOf } = setup();
    const { result } = renderHook(() => useUpdateBookingStatus(), { wrapper });

    act(() => result.current.mutate({ id: 'a', from: 'CONFIRMED', to: 'COMPLETED' }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(statusOf('a')).toBe('CONFIRMED');
    expect(statusOf('c')).toBe('CONFIRMED');
  });
});

describe('useBookingConflicts', () => {
  it('reads a failure as "no clashes" rather than an error', async () => {
    server.use(http.get('/api/bookings/conflicts', () => HttpResponse.json({}, { status: 500 })));
    const { wrapper } = setup();
    const { result } = renderHook(
      () => useBookingConflicts({ eventDate: '2026-09-01', assignedUserId: 'u1', resourceIds: [] }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ conflicts: [], resourceClashes: [] });
  });

  it('asks nothing when there is no date', () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useBookingConflicts(null), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('sends each resource as its own parameter', async () => {
    let query = '';
    server.use(
      http.get('/api/bookings/conflicts', ({ request }) => {
        query = new URL(request.url).search;
        return HttpResponse.json({ conflicts: [], resourceClashes: [] });
      })
    );
    const { wrapper } = setup();
    const { result } = renderHook(
      () =>
        useBookingConflicts({
          eventDate: '2026-09-01',
          assignedUserId: null,
          resourceIds: ['r1', 'r2'],
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(query).toContain('resourceIds=r1&resourceIds=r2');
  });
});
