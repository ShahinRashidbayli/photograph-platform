import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against a running stack: the real Next server, the real
 * Spring API, a real Postgres, and Mailpit standing in for the mail provider.
 *
 * <p>Nothing is mocked inside the application. That is the point — the bugs
 * this pass found were exactly the ones unit tests could not see: an
 * authorization rule that existed in one file and not another (BUG-002..005), a
 * route that had been deleted from under its tests (BUG-007), a credential that
 * reached a log on the way out (BUG-014). Each of those crosses a boundary, and
 * a boundary is the one thing a mock cannot test.
 *
 * <p>Run against the disposable stack, which lives on its own ports (web 3001,
 * API 8081) so a run never touches the dev server or the data you are using:
 *     make e2e-stack          # compose + API + web
 *     npm run e2e --workspace=apps/web
 *     make e2e-stack-down
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:3001';

export default defineConfig({
  testDir: './e2e',
  // Empties the e2e API's own Redis database, so rate limits used up by the
  // last run do not fail this one. See e2e/global-setup.ts.
  globalSetup: './e2e/global-setup.ts',
  // Each flow sets up its own tenant, so they do not share state and can run
  // together. Serial only in CI, where one runner is cheaper than the flake of
  // several browsers against one Postgres.
  fullyParallel: !process.env.CI,
  workers: process.env.CI ? 1 : undefined,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // A failing E2E test is a report, not a puzzle: keep enough to see what the
  // browser saw without rerunning it.
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: WEB,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
