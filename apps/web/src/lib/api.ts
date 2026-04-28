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
let queue: Array<() => void> = [];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) {
      throw error;
    }

    // Skip refresh loop for auth endpoints themselves
    if (original.url?.includes('/api/auth/')) {
      throw error;
    }

    if (isRefreshing) {
      return new Promise<void>((resolve) => {
        queue.push(() => resolve(api(original)));
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      // No body needed — the refresh_token httpOnly cookie is sent automatically
      await api.post('/api/auth/refresh');
      queue.forEach((cb) => cb());
      queue = [];
      return api(original);
    } catch (refreshError) {
      queue = [];
      useAuthStore.getState().clearUser();
      globalThis.location.href = '/login';
      throw refreshError;
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
