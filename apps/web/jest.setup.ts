import '@testing-library/jest-dom';
import { server } from '@/test-utils/msw';

/**
 * Zustand stores persist to localStorage, and jsdom shares one instance across
 * every test in a file — a theme or language set by one test would otherwise
 * leak into the next and make assertions order-dependent.
 */
afterEach(() => {
  globalThis.localStorage?.clear();
});

/**
 * MSW runs for every test file. `onUnhandledRequest: 'error'` is the point of
 * having it: a request nobody wrote a handler for fails loudly instead of
 * hanging or silently returning undefined, which is how a test ends up passing
 * against an endpoint that does not exist — the exact shape of BUG-007.
 */
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
