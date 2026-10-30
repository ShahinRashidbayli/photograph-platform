import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse, server } from '@/test-utils/msw';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useAuthStore } from '@/store/authStore';

/**
 * The first test in this repository that exercises a hook against a faked
 * *server* rather than a faked client.
 *
 * <p>The distinction is the reason MSW is here. `api.test.ts` swaps axios'
 * adapter, which is right for testing the interceptor and wrong for testing a
 * hook: it proves the code called axios, not that it can read what the API
 * sends. Here the hook runs its real client, its real interceptors and its real
 * parsing; only the server is replaced. The whole of BUG-002..BUG-005 were
 * shape-and-status problems that a client-side mock would have happily agreed
 * with, because a mock returns whatever the test author believed.
 *
 * <p>`onUnhandledRequest: 'error'` in jest.setup.ts is what makes that real: a
 * request to a path no handler covers fails the test instead of hanging, which
 * is the class of mistake that let BUG-007 sit unnoticed — tests aimed at a
 * route that no longer existed.
 */
describe('useEntitlements against a faked API', () => {
  function wrapper({ children }: { children: React.ReactNode }) {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  beforeEach(() => {
    // The hook only asks when the caller is staff — see `enabled`.
    useAuthStore.setState({
      user: {
        id: 'u1',
        email: 'anna@example.test',
        fullName: 'Anna',
        role: 'PHOTOGRAPHER',
        emailVerified: true,
        tenant: { subdomain: 'anna-foto', plan: 'STUDIO' },
      },
    } as never);
  });

  afterEach(() => {
    useAuthStore.setState({ user: null } as never);
  });

  it('reads the plan and its capabilities off the response', async () => {
    server.use(
      http.get('/api/entitlements', () =>
        HttpResponse.json({
          plan: 'STUDIO',
          capabilities: ['ANALYTICS', 'CONTRACTS'],
          galleryRetentionDays: 730,
          seats: 3,
          commissionBps: 0,
          writable: true,
          lockReason: null,
          trialEndsAt: null,
          subscriptionStatus: 'ACTIVE',
        })
      )
    );

    const { result } = renderHook(() => useEntitlements(), { wrapper });

    await waitFor(() => expect(result.current.entitlements).toBeDefined());
    expect(result.current.entitlements?.plan).toBe('STUDIO');
    expect(result.current.has('ANALYTICS')).toBe(true);
    expect(result.current.seats).toBe(3);
  });

  /**
   * A capability the plan does not grant must read as absent, not as unknown —
   * this is the client half of the gate BUG-005 showed the server getting
   * wrong.
   */
  it('reports a capability the plan does not grant as absent', async () => {
    server.use(
      http.get('/api/entitlements', () =>
        HttpResponse.json({
          plan: 'STARTER',
          capabilities: [],
          galleryRetentionDays: 60,
          seats: 1,
          commissionBps: 200,
          writable: true,
          lockReason: null,
          trialEndsAt: null,
          subscriptionStatus: 'ACTIVE',
        })
      )
    );

    const { result } = renderHook(() => useEntitlements(), { wrapper });

    await waitFor(() => expect(result.current.entitlements).toBeDefined());
    expect(result.current.has('ANALYTICS')).toBe(false);
    expect(result.current.seats).toBe(1);
  });

  /**
   * When the gate cannot be loaded the hook must not claim anything. The
   * comment on `retry: false` in the hook says a plan gate that fails should
   * not hide the app; this is that promise, asserted.
   */
  it('claims no capability when the request fails', async () => {
    server.use(
      http.get('/api/entitlements', () =>
        HttpResponse.json({ code: 'INTERNAL_ERROR' }, { status: 500 })
      )
    );

    const { result } = renderHook(() => useEntitlements(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.entitlements).toBeUndefined();
    expect(result.current.has('ANALYTICS')).toBe(false);
    // Falls back to the smallest plan's seat count rather than guessing upward.
    expect(result.current.seats).toBe(1);
  });
});
