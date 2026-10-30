import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

/**
 * The API, faked at the network boundary.
 *
 * <p>Until now the only test that faked HTTP replaced axios' adapter
 * (`api.test.ts`), which is the right tool for testing the interceptor itself
 * and the wrong one for testing a hook: it proves the code called axios, not
 * that it can read what the API actually sends. MSW intercepts the request
 * instead, so a hook under test runs its real client, its real interceptors and
 * its real parsing — the only thing replaced is the server.
 *
 * <p>That distinction is what this pass keeps running into. BUG-002 through
 * BUG-005 were all shape-of-the-response problems that no mock could have
 * caught, because a mock returns whatever the test author believed.
 */
export const server = setupServer();

export { http, HttpResponse };

/** Convenience for the common case: one JSON response for one path. */
export function json(path: string, body: unknown, status = 200) {
  return http.get(path, () => HttpResponse.json(body as never, { status }));
}
