import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders, setupUser } from '@/test-utils/render';
import { http, HttpResponse, server } from '@/test-utils/msw';
import { PersonalDataErasure, type ErasureItem } from './PersonalDataErasure';

/**
 * The erasure screen against a faked API.
 *
 * <p>What matters most here is not the happy path but the two ways the screen
 * could erase the wrong thing: acting on a preview produced for a different
 * address, and erasing without the photographer having seen what goes.
 */
const REPORT: ErasureItem[] = [
  { category: 'bookings', deleted: 0, anonymized: 2, retained: 0, retentionBasis: null },
  { category: 'galleryPhotos', deleted: 412, anonymized: 0, retained: 0, retentionBasis: null },
  { category: 'invoices', deleted: 0, anonymized: 0, retained: 1, retentionBasis: 'TAX_RECORDS' },
];

function fakeApi(items: ErasureItem[] = REPORT) {
  const erased: string[] = [];
  server.use(
    http.post('/api/privacy/erasure/preview', () => HttpResponse.json({ executed: false, items })),
    http.post('/api/privacy/erasure', async ({ request }) => {
      erased.push(((await request.json()) as { email: string }).email);
      return HttpResponse.json({ executed: true, items });
    })
  );
  return erased;
}

async function previewFor(user: ReturnType<typeof setupUser>, email: string) {
  await user.type(screen.getByLabelText("The person's email address"), email);
  await user.click(screen.getByRole('button', { name: 'Show what would be erased' }));
}

describe('PersonalDataErasure', () => {
  it('shows what would happen, with the reason for anything kept, before erasing anything', async () => {
    const erased = fakeApi();
    const user = setupUser();
    renderWithProviders(<PersonalDataErasure />, { lang: 'en' });

    await previewFor(user, 'maria@example.test');

    expect(await screen.findByText('If you erase maria@example.test')).toBeInTheDocument();
    expect(screen.getByText('2 will be anonymised')).toBeInTheDocument();
    expect(screen.getByText('412 will be deleted')).toBeInTheDocument();
    expect(screen.getByText(/invoices must be retained for ten years/)).toBeInTheDocument();
    expect(erased).toEqual([]);
  });

  it('erases the previewed address only after the photographer confirms', async () => {
    const erased = fakeApi();
    const user = setupUser();
    renderWithProviders(<PersonalDataErasure />, { lang: 'en' });

    await previewFor(user, 'maria@example.test');
    await user.click(await screen.findByRole('button', { name: 'Erase permanently' }));

    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(/412 delivered photos will be deleted/)).toBeInTheDocument();
    expect(erased).toEqual([]);

    await user.click(within(dialog).getByRole('button', { name: 'Erase permanently' }));

    expect(await screen.findByText('Erased maria@example.test')).toBeInTheDocument();
    expect(screen.getByText('2 anonymised')).toBeInTheDocument();
    expect(erased).toEqual(['maria@example.test']);
  });

  /** A preview belongs to one address; editing the field must not leave it actionable. */
  it('throws the preview away when the address is edited', async () => {
    fakeApi();
    const user = setupUser();
    renderWithProviders(<PersonalDataErasure />, { lang: 'en' });

    await previewFor(user, 'maria@example.test');
    await screen.findByRole('button', { name: 'Erase permanently' });

    await user.type(screen.getByLabelText("The person's email address"), 'x');

    expect(screen.queryByRole('button', { name: 'Erase permanently' })).not.toBeInTheDocument();
    expect(screen.queryByText('If you erase maria@example.test')).not.toBeInTheDocument();
  });

  it('says so when the studio holds nothing for the address, and offers nothing to erase', async () => {
    fakeApi([]);
    const user = setupUser();
    renderWithProviders(<PersonalDataErasure />, { lang: 'en' });

    await previewFor(user, 'nobody@example.test');

    expect(
      await screen.findByText('Your studio holds nothing under this address.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Erase permanently' })).not.toBeInTheDocument();
  });

  /**
   * The server refuses colleagues with 401. By then the interceptor has
   * refreshed and retried, so this is the owner check — not a lapsed session —
   * and it gets a message that says so, in the reader's language.
   */
  it('tells a colleague that only the owner can erase', async () => {
    server.use(
      http.post('/api/privacy/erasure/preview', () =>
        HttpResponse.json({ error: 'Only the studio owner can do that' }, { status: 401 })
      ),
      http.post('/api/auth/refresh', () => new HttpResponse(null, { status: 200 }))
    );
    const user = setupUser();
    renderWithProviders(<PersonalDataErasure />, { lang: 'de' });

    await user.type(screen.getByLabelText('E-Mail-Adresse der Person'), 'maria@example.test');
    await user.click(screen.getByRole('button', { name: 'Anzeigen, was gelöscht würde' }));

    await waitFor(() =>
      expect(
        screen.getByText('Nur die Inhaberin oder der Inhaber des Studios kann Daten löschen.')
      ).toBeInTheDocument()
    );
  });
});
