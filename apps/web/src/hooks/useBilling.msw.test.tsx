import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse, server } from '@/test-utils/msw';
import { CHECKOUT_POLL_MAX_READS, useBillingStatus, type BillingStatus } from '@/hooks/useBilling';

/**
 * The re-read after a checkout, against a faked API.
 *
 * <p>It used to wait for ACTIVE. A checkout made mid-trial comes back from
 * the webhook as TRIALING and a failed first payment as INCOMPLETE, so for
 * those it re-read every two seconds for as long as the tab stayed open.
 */
function billing(
  subscriptionStatus: BillingStatus['subscriptionStatus'],
  currentPeriodEnd: string | null = null
): BillingStatus {
  return {
    plan: 'PRO',
    subscriptionStatus,
    trialEndsAt: '2026-11-20T00:00:00Z',
    currentPeriodEnd,
    subscriptionConfigured: true,
    manageable: true,
    writable: true,
    devPlanSwitch: false,
    lockReason: null,
  };
}

/** Answers `before` until `landsAt` reads have been made, then `after`. */
function serve(before: BillingStatus, after: BillingStatus, landsAt = 2) {
  const reads = { count: 0 };
  server.use(
    http.get('/api/billing', () => {
      reads.count += 1;
      return HttpResponse.json(reads.count >= landsAt ? after : before);
    })
  );
  return reads;
}

function render(pollAfterCheckout: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useBillingStatus({ pollAfterCheckout }), { wrapper });
}

/** Lets the 2s interval fire `times` times, and each read it starts finish. */
async function waitIntervals(times: number) {
  for (let i = 0; i < times; i++) {
    await act(() => jest.advanceTimersByTimeAsync(2000));
  }
}

const PERIOD_END = '2026-12-20T00:00:00Z';

beforeEach(() => jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] }));
afterEach(() => jest.useRealTimers());

describe('useBillingStatus after a checkout', () => {
  it('stops once a mid-trial checkout lands, though it stays TRIALING', async () => {
    const reads = serve(billing('TRIALING'), billing('TRIALING', PERIOD_END));
    const { result } = render(true);

    await waitIntervals(5);

    expect(result.current.data?.currentPeriodEnd).toBe(PERIOD_END);
    expect(reads.count).toBe(2);
  });

  it('stops once a payment that failed lands as INCOMPLETE', async () => {
    const reads = serve(billing('TRIALING'), billing('INCOMPLETE', PERIOD_END));
    const { result } = render(true);

    await waitIntervals(5);

    expect(result.current.data?.subscriptionStatus).toBe('INCOMPLETE');
    expect(reads.count).toBe(2);
  });

  it('stops once ACTIVE', async () => {
    const reads = serve(billing('TRIALING'), billing('ACTIVE', PERIOD_END), 3);

    render(true);
    await waitIntervals(6);

    expect(reads.count).toBe(3);
  });

  /** The period end is never cleared, so a resubscription starts with the old one. */
  it('keeps re-reading over the previous, cancelled subscription', async () => {
    const reads = serve(billing('CANCELED', PERIOD_END), billing('ACTIVE', PERIOD_END), 3);
    const { result } = render(true);

    await waitIntervals(6);

    expect(result.current.data?.subscriptionStatus).toBe('ACTIVE');
    expect(reads.count).toBe(3);
  });

  it('gives up when the webhook never comes', async () => {
    const reads = serve(billing('TRIALING'), billing('TRIALING'));
    render(true);

    await waitIntervals(CHECKOUT_POLL_MAX_READS + 5);

    expect(reads.count).toBe(CHECKOUT_POLL_MAX_READS);
  });

  it('reads once on a plain visit', async () => {
    const reads = serve(billing('TRIALING'), billing('TRIALING'));
    const { result } = render(false);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitIntervals(3);

    expect(reads.count).toBe(1);
  });
});
