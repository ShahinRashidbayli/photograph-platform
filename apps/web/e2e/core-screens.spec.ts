import { basename } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { PASSWORD, registerStudio, type Studio } from './fixtures/stack';

/**
 * The studio's core screens — Settings, bookings, galleries, portfolio —
 * driven end to end, uploads included.
 *
 * <p>Unit tests fake the API; this does not. Every step is asserted twice —
 * on screen, and against the API, which is where a row either exists or does
 * not — and any uncaught error in the page fails the run.
 *
 * <p>One studio, one ordered story, because the screens depend on each other:
 * the booking form is priced from the package made in Settings, and the
 * gallery is created for that booking.
 */
const PHOTO = process.env.E2E_PHOTO ?? 'e2e/fixtures/photo.png';

test.describe.serial('core screens', () => {
  let studio: Studio;
  let page: Page;
  const pageErrors: string[] = [];
  const clientName = `Mila ${Date.now().toString(36)}`;

  test.beforeAll(async ({ browser }) => {
    studio = await registerStudio('smoke');
    page = await browser.newPage();
    page.on('pageerror', (err) => pageErrors.push(err.message));
    // Confirms (delete photo, delete category) are window.confirm.
    page.on('dialog', (dialog) => dialog.accept());
    await page.addInitScript(() =>
      localStorage.setItem('lang-storage', JSON.stringify({ state: { lang: 'en' }, version: 0 }))
    );
    await page.goto('/login');
    await page.getByLabel(/^Email/i).fill(studio.email);
    await page.getByLabel(/^Password/i).fill(PASSWORD);
    await page.getByRole('button', { name: /Sign in|Log in|Anmelden/i }).click();
    await page.waitForURL(/\/dashboard|\/leads|\/bookings/, { timeout: 20_000 });
  });

  test.afterEach(() => {
    expect(pageErrors, 'no uncaught errors in the page').toEqual([]);
  });

  test('settings: a package and a resource', async () => {
    await page.goto('/settings/studio');

    await page.getByRole('button', { name: /Add package/ }).click();
    await page.getByLabel('Package name *').fill('Hochzeit Basic');
    await page.getByLabel('Price (€) *').fill('1200');
    await page.getByRole('button', { name: 'Create package' }).click();
    await expect(page.getByText('Hochzeit Basic')).toBeVisible();

    await page.getByLabel('Add a room or a piece of kit').fill('Studio A');
    await page.getByLabel('Type').selectOption('ROOM');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByText('Studio A')).toBeVisible();

    await page.getByRole('button', { name: 'Retire' }).click();
    await page.getByRole('button', { name: 'Bring back' }).click();
    await expect(page.getByRole('button', { name: 'Retire' })).toBeVisible();

    const resources = await (await studio.api.get('/api/resources')).json();
    expect(resources.map((r: { name: string; active: boolean }) => [r.name, r.active])).toEqual([
      ['Studio A', true],
    ]);
  });

  test('settings: an invitation', async () => {
    await page.goto('/settings/team');
    await page.getByLabel('Invite a photographer').fill('ben@e2e.test');
    await page.getByRole('button', { name: 'Send invitation' }).click();
    await expect(page.getByText('Invitation sent to ben@e2e.test.')).toBeVisible();

    const team = await (await studio.api.get('/api/team')).json();
    expect(team.invitations.map((i: { email: string }) => i.email)).toEqual(['ben@e2e.test']);
  });

  test('bookings: the form offers what Settings made, and the booking appears once', async () => {
    await page.goto('/bookings');
    await page
      .getByRole('button', { name: /New booking/ })
      .first()
      .click();

    await page.getByLabel('Client name *').fill(clientName);
    await page.getByLabel('Client email *').fill('mila@e2e.test');
    await page.getByLabel('Event date *').fill(inThreeMonths());
    const packageSelect = page.getByLabel('Package');
    const packageOption = packageSelect.locator('option', { hasText: 'Hochzeit Basic' });
    await packageSelect.selectOption((await packageOption.getAttribute('value')) ?? '');
    await page.getByLabel('Studio A').check();
    await page.getByRole('button', { name: 'Create booking' }).click();

    await expect(page.getByRole('button', { name: 'Create booking' })).toHaveCount(0);
    await expect.poll(() => bookingsNamed(studio, clientName)).toHaveLength(1);
    const [booking] = await bookingsNamed(studio, clientName);
    expect(booking.totalAmountCents).toBe(120000);
    expect(booking.resourceIds).toHaveLength(1);
  });

  test('bookings: a status change sticks', async () => {
    await page.getByRole('button', { name: 'Confirm booking' }).click();
    await expect(page.getByText('Booking updated — Confirmed')).toBeVisible();
    await expect
      .poll(async () => (await bookingsNamed(studio, clientName))[0]?.status)
      .toBe('CONFIRMED');
  });

  test('galleries: create for that booking, upload, delete a photo', async () => {
    await page.goto('/galleries');
    await page
      .getByRole('button', { name: /New gallery/ })
      .first()
      .click();
    // The booking made a moment ago must already be in the picker.
    await expect(page.locator('select option', { hasText: clientName })).toHaveCount(1);
    await page.getByRole('button', { name: 'Create gallery' }).click();
    await expect(page.getByRole('button', { name: 'Create gallery' })).toHaveCount(0);

    // Through the button and the file chooser it opens, as a photographer would.
    const galleryChooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await (await galleryChooser).setFiles(PHOTO);
    await expect.poll(() => galleryPhotoCount(studio)).toBe(1);
    const deletePhoto = page.getByRole('button', {
      name: `Delete ${basename(PHOTO)}`,
      exact: true,
    });
    await expect(deletePhoto).toBeVisible();

    await deletePhoto.click();
    await expect(deletePhoto).toHaveCount(0);
    await expect.poll(() => galleryPhotoCount(studio)).toBe(0);
  });

  test('portfolio: upload, publish, file under a category, delete the category', async () => {
    await page.goto('/portfolio');
    const portfolioChooser = page.waitForEvent('filechooser');
    await page
      .getByRole('button', { name: /Upload photos/ })
      .first()
      .click();
    await (await portfolioChooser).setFiles(PHOTO);
    await expect.poll(async () => (await portfolioPhotos(studio)).length).toBe(1);

    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByRole('button', { name: 'Unpublish' })).toBeVisible();
    await expect.poll(async () => (await portfolioPhotos(studio))[0]?.published).toBe(true);

    await page.getByRole('button', { name: '+ Category' }).click();
    await page.getByPlaceholder('Category name').fill('Weddings');
    await page.getByPlaceholder('Category name').press('Enter');
    await page.getByLabel('Photo category').selectOption({ label: 'Weddings' });
    await expect.poll(async () => (await portfolioPhotos(studio))[0]?.categoryId).not.toBeNull();

    await page.getByRole('button', { name: 'Delete Weddings' }).click();
    await expect(page.getByRole('button', { name: /Uncategorised/ })).toBeVisible();

    await page.getByRole('button', { name: 'Delete photo' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete photo' }).click();
    await expect.poll(async () => (await portfolioPhotos(studio)).length).toBe(0);
  });
});

async function bookingsNamed(studio: Studio, name: string) {
  const response = await studio.api.get('/api/photographerBookings');
  const list = (await response.json()) as Array<{
    clientName: string;
    status: string;
    totalAmountCents: number;
    resourceIds: string[];
  }>;
  return list.filter((b) => b.clientName === name);
}

async function galleryPhotoCount(studio: Studio) {
  const list = (await (await studio.api.get('/api/galleries')).json()) as Array<{
    photoCount: number;
  }>;
  return list[0]?.photoCount ?? -1;
}

async function portfolioPhotos(studio: Studio) {
  return (await (await studio.api.get('/api/portfolio/photos')).json()) as Array<{
    published: boolean;
    categoryId: string | null;
  }>;
}

function inThreeMonths(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 3);
  date.setDate(15);
  return date.toISOString().slice(0, 10);
}
