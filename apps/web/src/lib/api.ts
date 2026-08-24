import axios from 'axios';
import { useAuthStore } from '@/store/authStore';
import { isLoginPath, loginUrlFor } from '@/lib/login-redirect';

// All requests go to the same origin via the Next.js proxy rewrite.
// HttpOnly cookies are sent automatically — no manual Authorization header needed.
// CSRF: BE writes a non-httpOnly XSRF-TOKEN cookie; axios echoes its value back
// in the X-XSRF-TOKEN header on state-changing requests (double-submit pattern).
const api = axios.create({
  baseURL: '/',
  withCredentials: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
});

let isRefreshing = false;

/**
 * Requests that 401'd while a token refresh was already in flight. Each entry
 * holds *both* outcomes: the queue has to be able to fail, not just succeed.
 * Previously it stored only a resolve callback, so when the refresh itself
 * failed the queue was discarded and every promise waiting on it never
 * settled — the awaiting components hung forever with their `finally`
 * cleanup (spinners, submit locks) never running. The `location.href` redirect
 * usually papered over it, but navigation is asynchronous and the app keeps
 * rendering until it commits.
 */
let queue: Array<{ retry: () => void; fail: (_reason: unknown) => void }> = [];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    // Email-not-verified gate: BE returns 403 with code=EMAIL_NOT_VERIFIED
    // when an annotated endpoint is hit by an unverified user. Surface this
    // globally via a window event so any listening UI (banner, toast) can
    // react without each call site needing its own handler.
    if (error.response?.status === 403 && error.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
      const message =
        typeof error.response.data?.error === 'string'
          ? error.response.data.error
          : 'Please verify your email before performing this action.';
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app:email-not-verified', { detail: { message } }));
      }
      throw error;
    }

    if (error.response?.status !== 401 || original._retry) {
      throw error;
    }

    // Endpoints that must never trigger a refresh, because refreshing is
    // either meaningless or recursive there. Deliberately an exact list and
    // not an `/api/auth/` prefix: `/api/auth/me` runs on every page load and
    // is the single most likely place to meet an expired token, so excluding
    // the whole prefix meant the one call that should refresh never did.
    const NO_REFRESH = [
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/refresh',
      '/api/auth/logout',
    ];
    if (NO_REFRESH.some((path) => original.url?.startsWith(path))) {
      throw error;
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        queue.push({
          // Mark the retry so a second 401 can't send it back through the
          // refresh flow and loop.
          retry: () => {
            original._retry = true;
            resolve(api(original));
          },
          fail: reject,
        });
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      // No body needed — the refresh_token httpOnly cookie is sent automatically
      await api.post('/api/auth/refresh');
      const waiting = queue;
      queue = [];
      waiting.forEach((entry) => entry.retry());
      return api(original);
    } catch (refreshError) {
      // Settle the queue before redirecting: every waiter must reject so its
      // caller's catch/finally runs, rather than being dropped mid-flight.
      const waiting = queue;
      queue = [];
      waiting.forEach((entry) => entry.fail(refreshError));
      useAuthStore.getState().clearUser();
      redirectToSignIn();
      throw refreshError;
    } finally {
      isRefreshing = false;
    }
  }
);

/**
 * Send a user whose session could not be renewed to the right sign-in screen,
 * with somewhere to come back to.
 *
 * This used to be `location.href = '/login'`, which got two things wrong. A
 * client has no password, so the photographer form was a dead end for them —
 * and the page they were on was thrown away, so signing back in dropped them on
 * a dashboard instead of the booking they had open.
 *
 * Already on a sign-in screen: leave it alone. Navigating there again would
 * reload the form under whatever the user is typing, and on `/login` itself the
 * failing request is usually the one that is *about* to sign them in.
 */
function redirectToSignIn(): void {
  if (typeof globalThis.location === 'undefined') return;

  // Defaulted rather than assumed: a real browser always supplies these, but a
  // throw here would happen inside the interceptor's catch and would replace
  // the refresh failure the caller is waiting on with a TypeError.
  const pathname = globalThis.location.pathname || '/';
  const search = globalThis.location.search || '';
  if (isLoginPath(pathname)) return;

  globalThis.location.href = loginUrlFor(pathname, search);
}

export default api;
