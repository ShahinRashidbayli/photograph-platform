import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders, setupUser } from '@/test-utils/render';
import { http, HttpResponse, server } from '@/test-utils/msw';
import { useAuthStore } from '@/store/authStore';
import type { DeliveryPhoto, Gallery } from '@/hooks/useGalleries';
import GalleriesPage from './page';

/**
 * The galleries screen against a faked API.
 *
 * <p>The cases are the ones the move to React Query had to keep or fix: a
 * failed action on a gallery that exists used to show nothing at all, and
 * removing a photo has to update the count on the list as well as the grid.
 */
const GALLERY: Gallery = {
  id: 'g1',
  bookingId: 'b1',
  bookingName: 'Maria Weber',
  eventType: 'Wedding',
  shootDate: '2026-09-12',
  photoCount: 2,
  downloadEnabled: true,
  watermarkEnabled: false,
  expiresAt: null,
  accessToken: 'tok-123456789',
  viewCount: 0,
  expiryState: 'ACTIVE',
  retentionDays: 60,
  purgeAfter: null,
  extensionCount: 0,
  canExtend: true,
};

const PHOTOS: DeliveryPhoto[] = [
  {
    id: 'p1',
    viewUrl: '/p1.jpg',
    thumbnailUrl: null,
    originalFilename: 'first.jpg',
    fileSizeBytes: 1,
    width: 1,
    height: 1,
    sortOrder: 0,
  },
  {
    id: 'p2',
    viewUrl: '/p2.jpg',
    thumbnailUrl: null,
    originalFilename: 'second.jpg',
    fileSizeBytes: 1,
    width: 1,
    height: 1,
    sortOrder: 1,
  },
];

function signInAsPhotographer() {
  useAuthStore.setState({
    user: {
      id: 'u1',
      email: 'anna@example.de',
      fullName: 'Anna',
      role: 'PHOTOGRAPHER',
      emailVerified: true,
      tenant: { subdomain: 'anna-foto', plan: 'STARTER' },
    },
  });
}

beforeEach(() => {
  signInAsPhotographer();
  jest.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
  useAuthStore.setState({ user: null });
});

describe('GalleriesPage', () => {
  it('says so when deleting a gallery fails, instead of doing nothing', async () => {
    server.use(
      http.get('/api/galleries', () => HttpResponse.json([GALLERY])),
      http.get('/api/galleries/g1/photos', () => HttpResponse.json(PHOTOS)),
      http.delete('/api/galleries/g1', () => HttpResponse.json({}, { status: 500 }))
    );
    const user = setupUser();
    renderWithProviders(<GalleriesPage />, { lang: 'en' });

    await user.click(await screen.findByRole('button', { name: /Delete gallery/ }));

    expect(await screen.findByText('Could not delete the gallery.')).toBeInTheDocument();
    // The gallery is still there — nothing pretended it went.
    expect(screen.getAllByText('Maria Weber').length).toBeGreaterThan(0);
  });

  it('removes a deleted photo from the grid and re-reads the count from the list', async () => {
    let listReads = 0;
    let photoCount = 2;
    server.use(
      http.get('/api/galleries', () => {
        listReads += 1;
        return HttpResponse.json([{ ...GALLERY, photoCount }]);
      }),
      http.get('/api/galleries/g1/photos', () => HttpResponse.json(PHOTOS)),
      http.delete('/api/galleries/photos/p1', () => {
        photoCount = 1;
        return new HttpResponse(null, { status: 204 });
      })
    );
    const user = setupUser();
    renderWithProviders(<GalleriesPage />, { lang: 'en' });

    await user.click(await screen.findByRole('button', { name: 'Delete first.jpg' }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Delete first.jpg' })).not.toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: 'Delete second.jpg' })).toBeInTheDocument();
    await waitFor(() => expect(listReads).toBe(2));
  });

  it('shows the photo error when deleting a photo fails', async () => {
    server.use(
      http.get('/api/galleries', () => HttpResponse.json([GALLERY])),
      http.get('/api/galleries/g1/photos', () => HttpResponse.json(PHOTOS)),
      http.delete('/api/galleries/photos/p1', () => HttpResponse.json({}, { status: 500 }))
    );
    const user = setupUser();
    renderWithProviders(<GalleriesPage />, { lang: 'en' });

    await user.click(await screen.findByRole('button', { name: 'Delete first.jpg' }));

    expect(
      await screen.findByText('Could not delete that photo. Please try again.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete first.jpg' })).toBeInTheDocument();
  });

  it('offers a retry when the list cannot be loaded', async () => {
    let fail = true;
    server.use(
      http.get('/api/galleries', () =>
        fail ? HttpResponse.json({}, { status: 500 }) : HttpResponse.json([GALLERY])
      ),
      http.get('/api/galleries/g1/photos', () => HttpResponse.json([]))
    );
    const user = setupUser();
    renderWithProviders(<GalleriesPage />, { lang: 'en' });

    expect(await screen.findByText("Couldn't load galleries")).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect((await screen.findAllByText('Maria Weber')).length).toBeGreaterThan(0);
  });

  describe('An Kunden senden', () => {
    /** Answers the send once the test opens the gate, recording each body. */
    function fakeSend(until?: Promise<void>, status = 200) {
      const bodies: unknown[] = [];
      server.use(
        http.get('/api/galleries', () => HttpResponse.json([GALLERY])),
        http.get('/api/galleries/g1/photos', () => HttpResponse.json(PHOTOS)),
        http.post('/api/galleries/g1/send', async ({ request }) => {
          bodies.push(await request.json());
          if (until) await until;
          return status === 200
            ? HttpResponse.json(GALLERY)
            : HttpResponse.json({ error: 'Mail is down' }, { status });
        })
      );
      return bodies;
    }

    it('sends the gallery with the Personal note typed into the dialog', async () => {
      const bodies = fakeSend();
      const user = setupUser();
      renderWithProviders(<GalleriesPage />, { lang: 'de' });

      await user.click(await screen.findByRole('button', { name: 'An Kunden senden' }));
      const dialog = screen.getByRole('dialog', { name: 'Diese Galerie an Ihren Kunden senden?' });
      await user.type(
        within(dialog).getByLabelText('Persönliche Notiz (optional)'),
        'Viel Freude!'
      );
      expect(within(dialog).getByText('12 / 1000')).toBeInTheDocument();
      await user.click(within(dialog).getByRole('button', { name: 'An Kunden senden' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(bodies).toEqual([{ note: 'Viel Freude!' }]);
    });

    it('disables sending while the request runs, and can send again afterwards', async () => {
      let open: () => void = () => {};
      const bodies = fakeSend(new Promise<void>((resolve) => (open = resolve)));
      const user = setupUser();
      renderWithProviders(<GalleriesPage />, { lang: 'en' });

      await user.click(await screen.findByRole('button', { name: 'Send to client' }));
      const dialog = screen.getByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Send to client' }));

      const pending = await within(dialog).findByRole('button', { name: 'Sending…' });
      expect(pending).toBeDisabled();
      await user.click(pending);
      expect(bodies).toEqual([{ note: null }]);

      open();
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      // Sendable again: the button is back and enabled.
      expect(screen.getByRole('button', { name: 'Send to client' })).toBeEnabled();
    });

    it('closes the dialog on failure and shows the error above the galleries', async () => {
      fakeSend(undefined, 500);
      const user = setupUser();
      renderWithProviders(<GalleriesPage />, { lang: 'en' });

      await user.click(await screen.findByRole('button', { name: 'Send to client' }));
      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Send to client' })
      );

      expect(await screen.findByText('Mail is down')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('is disabled while the gallery has no photos', async () => {
      server.use(
        http.get('/api/galleries', () => HttpResponse.json([{ ...GALLERY, photoCount: 0 }])),
        http.get('/api/galleries/g1/photos', () => HttpResponse.json([]))
      );
      renderWithProviders(<GalleriesPage />, { lang: 'de' });

      const send = await screen.findByRole('button', { name: 'An Kunden senden' });
      expect(send).toBeDisabled();
      expect(send).toHaveAttribute(
        'title',
        'Laden Sie zuerst Fotos hoch — eine leere Galerie lässt sich nicht senden.'
      );
    });
  });
});
