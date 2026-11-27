/**
 * @jest-environment node
 */
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
/*
 * Node rather than jsdom, because the redirect has to be observed. jsdom 21+
 * makes `window.location` unforgeable, so it can no longer be redefined, and a
 * real jsdom Location turns `href = …` into a "navigation not implemented"
 * error instead of recording the URL. In node `location` is simply absent, so
 * the stub below can stand in for it. The interceptor only needs `window` as
 * somewhere to dispatch its app events, which a bare EventTarget covers.
 */
Object.defineProperty(globalThis, 'window', { value: new EventTarget(), configurable: true });

function stubLocation(pathname: string, search: string): void {
  Object.defineProperty(globalThis, 'location', {
    value: { href: '', pathname, search },
    writable: true,
    configurable: true,
  });
}

describe('api response interceptor', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(api);
    useAuthStore.setState({ user: null } as never);
    // The failure path under test ends in a redirect. `pathname`/`search` are
    // part of the stub because the redirect reads them to decide *which*
    // sign-in to use and what to come back to.
    stubLocation('/bookings', '?status=NEW');
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
   * A request marked at its call site as "my 401 means a wrong code or token".
   * Refreshing there swapped the real error for the refresh's, and a
   * successful refresh replayed the guess against the attempt limit.
   */
  it('passes a marked request’s 401 through without refreshing or redirecting', async () => {
    mock.onPost('/api/auth/customer/login-code/verify').reply(401, { error: 'Wrong code' });

    const failure = api.post('/api/auth/customer/login-code/verify', {}, { skipAuthRefresh: true });

    await expect(failure).rejects.toMatchObject({
      response: { status: 401, data: { error: 'Wrong code' } },
    });
    expect(mock.history.post.map((r) => r.url)).toEqual(['/api/auth/customer/login-code/verify']);
    expect(globalThis.location.href).toBe('');
  });

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
    expect(useAuthStore.getState().user).toBeNull();
    // Carries the page they were on, so signing back in returns them to it
    // rather than to a dashboard.
    expect(globalThis.location.href).toBe('/login?next=%2Fbookings%3Fstatus%3DNEW');
  });

  /**
   * Clients are passwordless. Bouncing them to the photographer form handed
   * them a password field they can never fill in, which reads as a lost
   * account rather than the wrong door.
   */
  it('sends a client to the passwordless sign-in', async () => {
    stubLocation('/customer/bookings', '');
    mock.onGet('/api/bookings').reply(401);
    mock.onPost('/api/auth/refresh').reply(401);

    await expect(api.get('/api/bookings')).rejects.toBeTruthy();
    expect(globalThis.location.href).toBe('/customer/auth/login?next=%2Fcustomer%2Fbookings');
  });

  /**
   * On a sign-in screen the failing call is usually the one trying to sign the
   * user in. Navigating would reload the form under whatever they just typed.
   */
  it('does not navigate when the user is already on a sign-in screen', async () => {
    stubLocation('/login', '');
    mock.onGet('/api/bookings').reply(401);
    mock.onPost('/api/auth/refresh').reply(401);

    await expect(api.get('/api/bookings')).rejects.toBeTruthy();
    expect(globalThis.location.href).toBe('');
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

  /**
   * The other half of the rule above, and the one worth pinning down.
   *
   * <p>Since the API denies by default, a permission error and a request to a
   * path that has no handler both arrive as a plain 403 — the unhandled path
   * no longer 404s, because authorization is decided before dispatch. If the
   * interceptor keyed the email gate on the status alone, every one of those
   * would raise "please verify your email" at a user whose email is verified
   * and whose real problem is something else entirely.
   *
   * <p>It does not: the gate needs `code === 'EMAIL_NOT_VERIFIED'`, and the
   * access-denied handler answers `code: 'FORBIDDEN'`. This test is what keeps
   * that discriminator from being simplified away.
   */
  it.each([
    [
      'a permission error',
      { code: 'FORBIDDEN', error: 'You do not have access to this resource.' },
    ],
    ['a route that does not exist', { code: 'FORBIDDEN', error: 'Forbidden' }],
    ['a body with no code at all', {}],
  ])('does not raise the email gate for %s', async (_case, body) => {
    const listener = jest.fn();
    window.addEventListener('app:email-not-verified', listener);
    mock.onGet('/api/whatever').reply(403, body);

    await expect(api.get('/api/whatever')).rejects.toBeTruthy();

    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener('app:email-not-verified', listener);
  });
});
