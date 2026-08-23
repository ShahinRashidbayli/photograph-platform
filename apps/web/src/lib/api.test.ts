import MockAdapter from 'axios-mock-adapter';

import api from './api';
import { useAuthStore } from '@/store/authStore';

/**
 * The response interceptor — specifically, when it refreshes and when it does
 * not.
 *
 * This file had no test, and the gap was not theoretical. The API answered
 * **403** for an expired access token (no AuthenticationEntryPoint was
 * configured, so Spring Security fell back to Http403ForbiddenEntryPoint), and
 * the interceptor only refreshes on 401. The entire refresh-token rotation
 * built in AuthService was therefore unreachable: twenty-four hours after
 * signing in, every user was thrown out instead of renewed.
 *
 * Both halves are pinned here — the statuses that must trigger a refresh, and
 * the endpoints that must never trigger one, because a refresh loop on the
 * refresh endpoint itself is the failure the exclusion list exists to prevent.
 */
describe('api response interceptor', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(api);
    useAuthStore.setState({ user: null } as never);
    // jsdom refuses assignment to location.href otherwise, and the failure
    // path under test ends in a redirect.
    Object.defineProperty(globalThis, 'location', {
      value: { href: '' },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    mock.restore();
  });

  it('refreshes once on 401 and replays the original request', async () => {
    mock.onGet('/api/bookings').replyOnce(401).onGet('/api/bookings').replyOnce(200, { ok: true });
    mock.onPost('/api/auth/refresh').replyOnce(200);

    const response = await api.get('/api/bookings');

    expect(response.data).toEqual({ ok: true });
    expect(mock.history.post.filter((r) => r.url === '/api/auth/refresh')).toHaveLength(1);
  });

  /**
   * The call that runs on every page load, and the likeliest place to meet an
   * expired token. It used to be excluded from refresh by an `/api/auth/`
   * prefix match, so the one request that should have triggered renewal was
   * the one that could not.
   */
  it('refreshes on a 401 from /api/auth/me', async () => {
    mock.onGet('/api/auth/me').replyOnce(401).onGet('/api/auth/me').replyOnce(200, { id: 'u1' });
    mock.onPost('/api/auth/refresh').replyOnce(200);

    const response = await api.get('/api/auth/me');

    expect(response.data).toEqual({ id: 'u1' });
  });

  /**
   * 403 means authenticated but not allowed. Refreshing produces the same
   * identity, so retrying would loop without ever succeeding — the interceptor
   * must let it through untouched.
   */
  it('does not refresh on 403', async () => {
    mock.onGet('/api/leads').reply(403, { code: 'FORBIDDEN', error: 'No access' });

    await expect(api.get('/api/leads')).rejects.toBeTruthy();
    expect(mock.history.post.filter((r) => r.url === '/api/auth/refresh')).toHaveLength(0);
  });

  it.each(['/api/auth/login', '/api/auth/register', '/api/auth/logout'])(
    'does not refresh on a 401 from %s',
    async (path) => {
      mock.onPost(path).reply(401);

      await expect(api.post(path)).rejects.toBeTruthy();
      expect(mock.history.post.filter((r) => r.url === '/api/auth/refresh')).toHaveLength(0);
    }
  );

  /**
   * The refresh endpoint gets its own case: counting refresh calls would count
   * the request under test. What matters here is that a failed refresh is not
   * itself retried — that is the infinite loop the exclusion list prevents.
   */
  it('does not retry the refresh endpoint when it 401s', async () => {
    mock.onPost('/api/auth/refresh').reply(401);

    await expect(api.post('/api/auth/refresh')).rejects.toBeTruthy();
    expect(mock.history.post.filter((r) => r.url === '/api/auth/refresh')).toHaveLength(1);
  });

  it('clears the session and redirects when the refresh itself fails', async () => {
    mock.onGet('/api/bookings').reply(401);
    mock.onPost('/api/auth/refresh').reply(401);

    await expect(api.get('/api/bookings')).rejects.toBeTruthy();
    expect(globalThis.location.href).toBe('/login');
  });

  /**
   * Parallel page-load calls all 401 at once. Only one refresh may go out, and
   * every waiter must settle — an earlier version stored only the resolve
   * callback, so when the refresh failed the queue was discarded and those
   * promises never settled at all, leaving spinners running forever.
   */
  it('collapses concurrent 401s into a single refresh', async () => {
    mock.onGet('/api/bookings').replyOnce(401).onGet('/api/bookings').reply(200, { ok: true });
    mock.onGet('/api/leads').replyOnce(401).onGet('/api/leads').reply(200, { ok: true });
    mock.onPost('/api/auth/refresh').replyOnce(200);

    await Promise.all([api.get('/api/bookings'), api.get('/api/leads')]);

    expect(mock.history.post.filter((r) => r.url === '/api/auth/refresh')).toHaveLength(1);
  });

  it('rejects every queued waiter when the refresh fails', async () => {
    mock.onGet('/api/bookings').reply(401);
    mock.onGet('/api/leads').reply(401);
    mock.onPost('/api/auth/refresh').reply(401);

    const results = await Promise.allSettled([api.get('/api/bookings'), api.get('/api/leads')]);

    // Settled, not pending. A dropped waiter is invisible in the UI except as
    // a control that never re-enables.
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
  });

  /**
   * The email-verification gate is a 403 carrying its own code. It is surfaced
   * as a window event so a banner can react without every call site handling
   * it, and it must not be mistaken for a permission error.
   */
  it('announces EMAIL_NOT_VERIFIED as an app event', async () => {
    const listener = jest.fn();
    window.addEventListener('app:email-not-verified', listener);
    mock.onPost('/api/portfolio/photos/x/publish').reply(403, {
      code: 'EMAIL_NOT_VERIFIED',
      error: 'Please verify your email address before performing this action.',
    });

    await expect(api.post('/api/portfolio/photos/x/publish')).rejects.toBeTruthy();

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('app:email-not-verified', listener);
  });
});
