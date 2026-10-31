import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse, server } from '@/test-utils/msw';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useCreateInquiryRequest } from '@/hooks/useInquiryRequests';
import { bookingsQueryKey } from '@/hooks/useBookings';

/**
 * The revenue/reports data and the client's session request, against a faked
 * API. Pins what useAnalytics did as a hand-rolled loader: a 402 is "locked",
 * not an error, and choosing a year re-reads for that year.
 */
function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, Wrapper };
}

function figures(year: number) {
  return { year, availableYears: [2025, 2026], revenue: {}, bookings: {} };
}

describe('useAnalytics', () => {
  it('reads a plan without reports as locked, not as an error', async () => {
    server.use(http.get('/api/analytics', () => HttpResponse.json({}, { status: 402 })));
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useAnalytics(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.locked).toBe(true));
    expect(result.current.error).toBeNull();
  });

  it('re-reads for a chosen year and keeps the last one showing meanwhile', async () => {
    server.use(
      http.get('/api/analytics', ({ request }) => {
        const year = Number(new URL(request.url).searchParams.get('year') ?? 2026);
        return HttpResponse.json(figures(year));
      })
    );
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useAnalytics(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.year).toBe(2026));

    act(() => result.current.selectYear(2025));

    expect(result.current.data?.year).toBe(2026);
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.year).toBe(2025));
    expect(result.current.loading).toBe(false);
  });

  it('turns any other failure into a translatable error', async () => {
    server.use(http.get('/api/analytics', () => HttpResponse.json({}, { status: 500 })));
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useAnalytics(), { wrapper: Wrapper });

    // After the one retry any non-402 failure gets.
    await waitFor(() => expect(result.current.error).toEqual({ key: 'analytics.loadError' }), {
      timeout: 4000,
    });
    expect(result.current.locked).toBe(false);
  });
});

describe('useCreateInquiryRequest', () => {
  it('refreshes the client’s bookings, which list the request', async () => {
    server.use(
      http.post('/api/customer/inquiry-requests', () => new HttpResponse(null, { status: 201 }))
    );
    const { client, Wrapper } = wrapper();
    client.setQueryData(bookingsQueryKey(false), []);
    const { result } = renderHook(() => useCreateInquiryRequest(), { wrapper: Wrapper });

    await act(() =>
      result.current.mutateAsync({
        eventType: 'PORTRAIT',
        budgetRange: 'UNDER_500',
        proposedDate: '2027-01-15',
        location: null,
        message: null,
        website: '',
      })
    );

    expect(client.getQueryState(bookingsQueryKey(false))?.isInvalidated).toBe(true);
  });
});
