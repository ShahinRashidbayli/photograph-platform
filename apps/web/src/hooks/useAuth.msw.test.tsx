import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse, server } from '@/test-utils/msw';
import { useRegister, useRequestLoginCode } from '@/hooks/useAuth';
import { useLangStore } from '@/store/langStore';

/**
 * The two requests whose email goes out before the user has a stored language
 * carry the page's: the verification email after sign-up, and a Customer's
 * sign-in code (#126).
 */
function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useAuth sends the page language', () => {
  it('with a sign-up', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post('/api/auth/register', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 'u1' }, { status: 201 });
      })
    );
    useLangStore.setState({ lang: 'en' });
    const { result } = renderHook(() => useRegister(), { wrapper });

    await act(() =>
      result.current.mutateAsync({
        fullName: 'Anna',
        email: 'anna@example.test',
        password: 'Password1234',
        subdomain: 'anna-foto',
        role: 'PHOTOGRAPHER',
        plan: null,
      })
    );

    await waitFor(() => expect(body).toMatchObject({ subdomain: 'anna-foto', language: 'en' }));
  });

  it('with a sign-in code request', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post('/api/auth/customer/login-code/request', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return new HttpResponse(null, { status: 204 });
      })
    );
    useLangStore.setState({ lang: 'de' });
    const { result } = renderHook(() => useRequestLoginCode(), { wrapper });

    await act(() =>
      result.current.mutateAsync({ email: 'maria@example.test', subdomain: null, fullName: null })
    );

    expect(body).toEqual({
      email: 'maria@example.test',
      subdomain: null,
      fullName: null,
      language: 'de',
    });
  });
});
