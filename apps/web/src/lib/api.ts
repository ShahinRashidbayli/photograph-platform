import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

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

    // Skip refresh loop for auth endpoints themselves
    if (original.url?.includes('/api/auth/')) {
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
      globalThis.location.href = '/login';
      throw refreshError;
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
