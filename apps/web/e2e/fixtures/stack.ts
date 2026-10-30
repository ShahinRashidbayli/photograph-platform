import { APIRequestContext, expect, request } from '@playwright/test';

/**
 * Talking to the running stack from outside the browser.
 *
 * <p>Every flow needs a studio that exists, and a studio is created by
 * registering one — there is no fixture file to load. That is deliberate: the
 * SQL seed in scripts/ refuses to run without a tenant already present ("register
 * in the app first"), and a second seeding path that bypasses the API would be a
 * second definition of what a valid tenant looks like. These helpers use the
 * same endpoints a real client does.
 *
 * <p>Each test registers its own studio under a unique subdomain, so flows share
 * no state and a failure in one leaves nothing behind for the next to trip over.
 */

/** The e2e stack's API (scripts/e2e-stack.sh), not the dev server's on 8080. */
const API = process.env.E2E_API_URL ?? 'http://localhost:8081';
const MAILPIT = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025';

/** Test-only credential, and not a secret: the stack is disposable. */
export const PASSWORD = 'Password1234';

export interface Studio {
  subdomain: string;
  email: string;
  password: string;
  /** Authenticated as the owner, with the CSRF header already set. */
  api: APIRequestContext;
}

/** Subdomains must start and end alphanumeric; keep them short and unique. */
function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Registers a studio and returns a request context signed in as its owner.
 *
 * <p>Registration answers with the session cookies, so the returned context is
 * already authenticated. The CSRF cookie it also sets has to be echoed back as a
 * header on every mutating call — the API uses a stateless double-submit check —
 * which is why callers get a prepared context rather than raw credentials.
 */
export async function registerStudio(namePrefix = 'studio'): Promise<Studio> {
  const subdomain = `${namePrefix}-${uniqueSuffix()}`.toLowerCase();
  const email = `owner-${uniqueSuffix()}@e2e.test`;

  const anonymous = await request.newContext({ baseURL: API });
  const response = await anonymous.post('/api/auth/register', {
    data: {
      fullName: 'E2E Owner',
      email,
      password: PASSWORD,
      subdomain,
      role: 'PHOTOGRAPHER',
      plan: 'STUDIO',
    },
  });
  expect(response.status(), await bodyFor(response)).toBe(201);

  const api = await authenticatedContext(anonymous);
  return { subdomain, email, password: PASSWORD, api };
}

/**
 * Wraps a context whose cookies are already set so that mutating requests carry
 * the CSRF header the API expects.
 */
async function authenticatedContext(context: APIRequestContext): Promise<APIRequestContext> {
  const state = await context.storageState();
  const xsrf = state.cookies.find((c) => c.name === 'XSRF-TOKEN')?.value;
  expect(xsrf, 'the API should have set an XSRF-TOKEN cookie').toBeTruthy();

  return request.newContext({
    baseURL: API,
    storageState: state,
    extraHTTPHeaders: { 'X-XSRF-TOKEN': xsrf! },
  });
}

/** A signed-in context for an existing account. */
export async function signIn(email: string, password = PASSWORD): Promise<APIRequestContext> {
  const anonymous = await request.newContext({ baseURL: API });
  const response = await anonymous.post('/api/auth/login', { data: { email, password } });
  expect(response.status(), await bodyFor(response)).toBe(200);
  return authenticatedContext(anonymous);
}

/**
 * The six-digit sign-in code, read out of the mailbox it was sent to.
 *
 * <p>Read from Mailpit rather than from the database on purpose: the code only
 * reaches a customer if the mail is actually built and sent, and that path has
 * already been wrong once in this codebase — the subject carried the code into
 * the application log (BUG-014). Going through the mailbox tests the delivery,
 * not just the row.
 */
export async function latestLoginCodeFor(email: string): Promise<string> {
  const mail = await request.newContext({ baseURL: MAILPIT });

  for (let attempt = 0; attempt < 30; attempt++) {
    const response = await mail.get('/api/v1/search', {
      params: { query: `to:${email}`, limit: '5' },
    });
    if (response.ok()) {
      const found = (await response.json()) as { messages?: Array<{ ID: string }> };
      for (const message of found.messages ?? []) {
        const body = await mail.get(`/api/v1/message/${message.ID}`);
        if (!body.ok()) continue;
        const content = (await body.json()) as { Subject?: string; HTML?: string; Text?: string };
        const code = `${content.Subject ?? ''}\n${content.HTML ?? ''}\n${content.Text ?? ''}`.match(
          /\b(\d{6})\b/
        );
        if (code) return code[1];
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`No sign-in code arrived for ${email} within 15s`);
}

/** Clears the mailbox so one test's mail cannot be read by the next. */
export async function clearMailbox(): Promise<void> {
  const mail = await request.newContext({ baseURL: MAILPIT });
  await mail.delete('/api/v1/messages');
}

/** Response bodies make assertion failures readable; statuses alone do not. */
export async function bodyFor(response: { text(): Promise<string> }): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '<unreadable body>';
  }
}
