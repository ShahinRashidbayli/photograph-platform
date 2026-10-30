import { expect, test } from '@playwright/test';
import { PASSWORD, bodyFor, registerStudio, type Studio } from './fixtures/stack';

/**
 * Flow 1 — a stranger's enquiry becomes a booking.
 *
 * <p>The commercial path the product exists for: someone finds a photographer's
 * page, sends a request, and the photographer turns it into work. It crosses
 * every boundary the unit tests cannot: an unauthenticated public form, a
 * tenant-scoped inbox, and a state change that creates a row in another module.
 *
 * <p>Both halves are asserted, because only one of them is obvious. The
 * enquiry must arrive — and it must arrive in *this* studio's inbox and no
 * other. A second studio registered alongside the first is what makes the
 * second half meaningful: without it, "the lead is visible" proves nothing
 * about scoping.
 */
test.describe('lead to booking', () => {
  let studio: Studio;
  let neighbour: Studio;

  test.beforeEach(async ({ page }) => {
    // The app opens in German by default; the assertions below read English
    // labels, so pin the language rather than depend on the default.
    await page.addInitScript(() =>
      localStorage.setItem('lang-storage', JSON.stringify({ state: { lang: 'en' }, version: 0 }))
    );
    studio = await registerStudio('anna');
    neighbour = await registerStudio('bruno');
  });

  test('a public request reaches its own studio, and converts to a booking', async ({ page }) => {
    const clientName = `Klara ${Date.now().toString(36)}`;
    const clientEmail = `klara-${Date.now().toString(36)}@e2e.test`;

    // ── the stranger's side ──────────────────────────────────────────────
    await page.goto(`/r/${studio.subdomain}`);

    await page.getByLabel('Your name *').fill(clientName);
    await page.getByLabel(/^Email/).fill(clientEmail);
    await page.getByLabel(/^Event date/).fill(inThreeMonths());
    await page.getByLabel(/^Session type/).selectOption('WEDDING');
    await page.getByLabel(/^Budget/).selectOption('OVER_1000');
    await page
      .getByLabel(/^Tell us about your shoot/)
      .fill('We would love you to photograph our wedding.');

    await page.getByRole('button', { name: /Send request/ }).click();

    await expect(
      page.getByRole('heading', { name: 'Request sent' }),
      'the visitor should be told it worked'
    ).toBeVisible();

    // ── the photographer's side ──────────────────────────────────────────
    await signInThroughTheUi(page, studio.email);
    await page.goto('/leads');

    const lead = page.getByText(clientName).first();
    await expect(lead, 'the lead should be in the inbox it was sent to').toBeVisible();
    await lead.click();

    await page
      .getByRole('button', { name: /Convert to booking/ })
      .first()
      .click();
    // The confirm lives in the dialog; "last on the page" can also match the
    // list's own "+ Convert to booking", depending on render order.
    await page
      .getByRole('dialog', { name: /Convert .* to a booking/ })
      .getByRole('button', { name: 'Convert to booking' })
      .click();

    // The booking is the assertion, not the modal closing: read it back from
    // the API, which is where the row either exists or does not.
    await expect
      .poll(
        async () => {
          const response = await studio.api.get('/api/photographerBookings');
          if (!response.ok()) return [];
          // A plain list, not a page — see BookingController#getPhotographerBookings.
          const bookings = (await response.json()) as Array<{ clientEmail: string }>;
          return bookings.map((b) => b.clientEmail);
        },
        { message: 'the converted lead should exist as a booking' }
      )
      .toContain(clientEmail);

    // ── and nowhere else ─────────────────────────────────────────────────
    const neighbourLeads = await neighbour.api.get('/api/leads');
    expect(neighbourLeads.status(), await bodyFor(neighbourLeads)).toBe(200);
    expect(
      JSON.stringify(await neighbourLeads.json()),
      'another studio must not see this enquiry'
    ).not.toContain(clientEmail);
  });

  /**
   * The rejection half: the same form, aimed at a studio that does not exist.
   * It must not create anything, and it must not reveal whether the subdomain
   * is real — the public intake is unauthenticated, so it is the one endpoint a
   * stranger can use to enumerate tenants.
   */
  test('a request for a studio that does not exist creates nothing', async () => {
    const response = await studio.api.post('/api/public/leads/no-such-studio-here', {
      data: {
        name: 'Nobody',
        email: 'nobody@e2e.test',
        eventDate: inThreeMonths(),
        eventType: 'WEDDING',
        budgetRange: 'OVER_1000',
        message: 'Hello?',
      },
    });

    expect(
      [404, 422].includes(response.status()),
      `expected a refusal, got ${response.status()}: ${await bodyFor(response)}`
    ).toBe(true);

    const leads = await studio.api.get('/api/leads');
    expect(JSON.stringify(await leads.json())).not.toContain('nobody@e2e.test');
  });
});

async function signInThroughTheUi(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.getByLabel(/^Email/i).fill(email);
  await page.getByLabel(/^Password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /Sign in|Log in|Anmelden/i }).click();
  await page.waitForURL(/\/dashboard|\/leads|\/bookings/, { timeout: 20_000 });
}

/** Leads need a future date; three months out avoids month-end and DST edges. */
function inThreeMonths(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 3);
  date.setDate(15);
  return date.toISOString().slice(0, 10);
}
