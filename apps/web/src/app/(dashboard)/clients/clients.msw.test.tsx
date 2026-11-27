import React from 'react';
import { renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithProviders, setupUser } from '@/test-utils/render';
import { http, HttpResponse, server } from '@/test-utils/msw';
import { clientsKey } from '@/hooks/useClients';
import { useSaveBooking, type BookingPayload } from '@/hooks/useBookings';
import type { Client } from '@/types/api';
import ClientsPage from './page';

jest.mock('next/navigation', () => ({
  usePathname: () => '/clients',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn(), back: jest.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  useParams: () => ({}),
}));

// jsdom has no matchMedia; the screen asks it whether to split into list/detail panes.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});

/**
 * The client directory against a faked API.
 *
 * <p>Behaviour kept across the move to hooks: notes save in place, a failed
 * save keeps the draft open, and a failed load offers a retry. The last case
 * is new with the cache — clients are derived from bookings, so saving a
 * booking has to mark this list stale.
 */
const CLIENT: Client = {
  id: 'c1',
  fullName: 'Maria Weber',
  email: 'maria@example.de',
  notes: '',
  totalBookings: 1,
  totalSpentCents: 120000,
  upcomingBookings: 1,
  createdAt: '2026-09-01T00:00:00Z',
};

describe('ClientsPage', () => {
  it('saves a note in place', async () => {
    server.use(
      http.get('/api/clients', () => HttpResponse.json([CLIENT])),
      http.patch('/api/clients/c1/notes', () =>
        HttpResponse.json({ ...CLIENT, notes: 'Prefers mornings' })
      )
    );
    const user = setupUser();
    renderWithProviders(<ClientsPage />, { lang: 'en' });

    await user.click(await screen.findByRole('button', { name: /Edit/ }));
    await user.type(
      screen.getByPlaceholderText('Add a private note about this client…'),
      'Prefers mornings'
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Prefers mornings')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('keeps the draft open when saving fails', async () => {
    server.use(
      http.get('/api/clients', () => HttpResponse.json([CLIENT])),
      http.patch('/api/clients/c1/notes', () => HttpResponse.json({}, { status: 500 }))
    );
    const user = setupUser();
    renderWithProviders(<ClientsPage />, { lang: 'en' });

    await user.click(await screen.findByRole('button', { name: /Edit/ }));
    await user.type(screen.getByPlaceholderText('Add a private note about this client…'), 'x');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Couldn’t save the note. Please try again.')
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Add a private note about this client…')).toHaveValue('x');
  });

  it('offers a retry when the list cannot be loaded', async () => {
    let fail = true;
    server.use(
      http.get('/api/clients', () =>
        fail ? HttpResponse.json({}, { status: 500 }) : HttpResponse.json([CLIENT])
      )
    );
    const user = setupUser();
    renderWithProviders(<ClientsPage />, { lang: 'en' });

    expect(await screen.findByText("Couldn't load clients")).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect((await screen.findAllByText('Maria Weber')).length).toBeGreaterThan(0);
  });
});

describe('the directory is derived from bookings', () => {
  it('shows each client with the figures their bookings add up to', async () => {
    server.use(
      http.get('/api/clients', () =>
        HttpResponse.json([
          { ...CLIENT, totalBookings: 3, upcomingBookings: 2, lastBookingDate: '2026-10-12' },
        ])
      )
    );
    renderWithProviders(<ClientsPage />, { lang: 'en' });

    expect(await screen.findByText(/3 bookings/)).toBeInTheDocument();
    expect(screen.getAllByText('2 upcoming').length).toBeGreaterThan(0);
    expect(screen.getByText('Collected')).toBeInTheDocument();
  });

  it('explains where clients come from while there are none', async () => {
    server.use(http.get('/api/clients', () => HttpResponse.json([])));
    renderWithProviders(<ClientsPage />, { lang: 'de' });

    expect(await screen.findByText('Noch keine Kunden')).toBeInTheDocument();
    expect(
      screen.getByText('Kunden erscheinen hier automatisch, sobald Sie ihre erste Buchung anlegen.')
    ).toBeInTheDocument();
  });
});

describe('the directory follows the bookings', () => {
  it('marks clients stale when a booking is saved', async () => {
    server.use(
      http.post('/api/bookings', () => HttpResponse.json({ id: 'b1', eventDate: '2027-01-01' }))
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(clientsKey(), [CLIENT]);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useSaveBooking(), { wrapper });

    await result.current.mutateAsync({ payload: { clientName: 'x' } as BookingPayload });

    await waitFor(() => expect(client.getQueryState(clientsKey())?.isInvalidated).toBe(true));
  });
});
