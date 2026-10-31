import React from 'react';
import { renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithProviders, setupUser } from '@/test-utils/render';
import { http, HttpResponse, server } from '@/test-utils/msw';
import { useAuthStore, type AuthUser } from '@/store/authStore';
import { bookingsQueryKey } from '@/hooks/useBookings';
import { useLogout } from '@/hooks/useAuth';
import LoginPage from './login/page';
import VerifyEmailPage from './verify-email/page';
import AccountSettingsPage from '../(dashboard)/settings/page';

let params = new URLSearchParams('');
const push = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push, replace: jest.fn(), refresh: jest.fn(), back: jest.fn() }),
  useSearchParams: () => params,
  useParams: () => ({}),
}));

/**
 * Sessions and the signed-in account against a faked API.
 *
 * <p>Two cases failed before these screens moved onto hooks/useAuth.ts:
 * signing in kept the previous session's cached data, and an avatar upload's
 * specific failure never reached the screen. The verification link is pinned
 * as it was: single-use, so one request.
 */
const ANNA: AuthUser = {
  id: 'u1',
  email: 'anna@example.de',
  fullName: 'Anna',
  role: 'PHOTOGRAPHER',
  emailVerified: true,
  tenant: { subdomain: 'anna-foto', plan: 'STUDIO' },
};

beforeEach(() => {
  params = new URLSearchParams('');
  push.mockClear();
});

afterEach(() => useAuthStore.setState({ user: null }));

describe('signing in', () => {
  /** The app moves between sessions without a page load, so the cache outlives them. */
  it('drops what the previous session had cached', async () => {
    server.use(http.post('/api/auth/login', () => HttpResponse.json(ANNA)));
    const user = setupUser();
    const { queryClient } = renderWithProviders(<LoginPage />, { lang: 'en' });
    // Another studio's bookings, from the last person who used this tab.
    queryClient.setQueryDefaults(bookingsQueryKey(true), { gcTime: Infinity });
    queryClient.setQueryData(bookingsQueryKey(true), [{ id: 'someone-elses-booking' }]);

    await user.type(screen.getByLabelText(/Email address/), 'anna@example.de');
    await user.type(screen.getByLabelText(/^Password/), 'Password1234');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
    expect(queryClient.getQueryData(bookingsQueryKey(true))).toBeUndefined();
    expect(useAuthStore.getState().user?.email).toBe('anna@example.de');
  });
});

describe('signing out', () => {
  it('drops the cache even when the request fails', async () => {
    server.use(http.post('/api/auth/logout', () => HttpResponse.json({}, { status: 500 })));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(bookingsQueryKey(true), [{ id: 'b1' }]);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useLogout(), { wrapper });

    await result.current.mutateAsync();

    expect(client.getQueryData(bookingsQueryKey(true))).toBeUndefined();
  });
});

describe('VerifyEmailPage', () => {
  it('confirms the address with one request for the link', async () => {
    params = new URLSearchParams('token=tok-1');
    let posts = 0;
    server.use(
      http.post('/api/auth/verify-email', () => {
        posts += 1;
        return posts === 1
          ? new HttpResponse(null, { status: 204 })
          : HttpResponse.json({ error: 'This link has already been used.' }, { status: 401 });
      })
    );
    renderWithProviders(<VerifyEmailPage />, { lang: 'en' });

    expect(await screen.findByText('Email confirmed')).toBeInTheDocument();
    expect(posts).toBe(1);
  });
});

describe('account settings', () => {
  it('says the upload itself failed, rather than a generic error', async () => {
    useAuthStore.setState({ user: ANNA });
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json(ANNA)),
      http.post('/api/auth/me/avatar/presign', () =>
        HttpResponse.json({
          uploadUrl: 'https://storage.test/avatar',
          viewUrl: 'https://storage.test/avatar',
          r2Key: 'avatars/u1',
          contentType: 'image/png',
        })
      ),
      http.put('https://storage.test/avatar', () => new HttpResponse(null, { status: 403 }))
    );
    const user = setupUser();
    const { container } = renderWithProviders(<AccountSettingsPage />, { lang: 'en' });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['x'], 'me.png', { type: 'image/png' }));

    expect(await screen.findByText('Upload to storage failed')).toBeInTheDocument();
  });
});
