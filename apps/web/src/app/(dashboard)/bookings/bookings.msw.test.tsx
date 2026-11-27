import React from 'react';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderWithProviders, setupUser } from '@/test-utils/render';
import { http, HttpResponse, server } from '@/test-utils/msw';
import { useAuthStore, type AuthUser } from '@/store/authStore';
import type { Booking } from '@/types/api';
import BookingsPage from './page';

let mockQuery = 'id=b2';
jest.mock('next/navigation', () => ({
  usePathname: () => '/bookings',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn(), back: jest.fn() }),
  useSearchParams: () => new URLSearchParams(mockQuery),
  useParams: () => ({}),
}));

const ANNA: AuthUser = {
  id: 'u1',
  email: 'anna@fotografie.de',
  fullName: 'Anna Fischer',
  role: 'PHOTOGRAPHER',
  emailVerified: true,
  tenant: { subdomain: 'anna-foto', plan: 'STARTER' },
};

function booking(id: string, clientName: string): Booking {
  return {
    id,
    clientName,
    clientEmail: `${id}@example.de`,
    eventDate: '2027-06-12',
    eventType: 'WEDDING',
    status: 'CONFIRMED',
    totalAmountCents: 100_000,
    depositAmountCents: 0,
    amountPaidCents: 0,
    paymentState: 'NOT_INVOICED',
    createdAt: '2027-01-10T09:00:00Z',
  };
}

// A phone or tablet: below 1100px the list and the detail are two screens.
function narrowScreen() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('1100px'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

/**
 * A link to one booking (`/bookings?id=…`, as the "contract signed" email and
 * the dashboard send) opens that booking's detail on a narrow screen too. It
 * used to open the list, so on a phone the link seemed to go nowhere (#104).
 */
describe('BookingsPage deep link', () => {
  beforeEach(() => {
    narrowScreen();
    useAuthStore.setState({ user: ANNA });
    server.use(
      http.get('/api/photographerBookings', () =>
        HttpResponse.json([booking('b1', 'Maria Weber'), booking('b2', 'Jonas Keller')])
      ),
      http.get('/api/entitlements', () =>
        HttpResponse.json({
          plan: 'STARTER',
          capabilities: [],
          galleryRetentionDays: 60,
          seats: 1,
          commissionBps: 0,
          writable: true,
        })
      ),
      http.get('/api/analytics/summary', () =>
        HttpResponse.json({ year: 2027, bookedCents: 0, invoicedCents: 0, collectedCents: 0 })
      ),
      // Everything else the page loads alongside, answered empty.
      ...['/api/galleries', '/api/packages', '/api/resources', '/api/bookings/:id/invoices'].map(
        (path) => http.get(path, () => HttpResponse.json([]))
      )
    );
  });
  afterEach(() => {
    // Unmount first: signing out under a mounted page re-renders it as the
    // Customer portal, which then asks for /api/customer/* mid-teardown.
    cleanup();
    useAuthStore.setState({ user: null });
    mockQuery = 'id=b2';
  });

  it('opens the linked booking, not the list, on a narrow screen', async () => {
    renderWithProviders(<BookingsPage />, { lang: 'en' });

    expect(await screen.findByRole('button', { name: 'All bookings' })).toBeVisible();
    expect(screen.getByRole('heading', { name: /Jonas Keller/ })).toBeVisible();
  });

  it('opens the list, not another booking, when the linked booking is gone', async () => {
    mockQuery = 'id=deleted';
    renderWithProviders(<BookingsPage />, { lang: 'en' });

    expect(await screen.findByRole('searchbox', { name: 'Search bookings' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'All bookings', hidden: true })).not.toBeVisible();
  });

  it("opens the list when the linked booking was the studio's last one", async () => {
    server.use(http.get('/api/photographerBookings', () => HttpResponse.json([])));
    mockQuery = 'id=deleted';
    renderWithProviders(<BookingsPage />, { lang: 'en' });

    expect(await screen.findByRole('searchbox', { name: 'Search bookings' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'All bookings', hidden: true })).not.toBeVisible();
  });

  it('opens the list when back/forward lands on a booking that is gone', async () => {
    const { rerender, queryClient } = renderWithProviders(<BookingsPage />, { lang: 'en' });
    expect(await screen.findByRole('heading', { name: /Jonas Keller/ })).toBeVisible();

    mockQuery = 'id=deleted';
    // A new URL re-renders the same page; `rerender` alone would drop the provider.
    rerender(
      <QueryClientProvider client={queryClient}>
        <BookingsPage />
      </QueryClientProvider>
    );

    expect(await screen.findByRole('searchbox', { name: 'Search bookings' })).toBeVisible();
  });

  it('keeps the overview tiles in the calendar, which has no detail pane', async () => {
    mockQuery = 'view=calendar&id=b2';
    renderWithProviders(<BookingsPage />, { lang: 'en' });

    expect(await screen.findByRole('region', { name: 'Overview' })).toBeVisible();
  });
});

/**
 * Declining an enquiry is final — DECLINED has no way back — so it asks first,
 * the way cancelling does. It used to go through on one click.
 */
describe('BookingsPage declining an enquiry', () => {
  let patches: string[];

  beforeEach(() => {
    narrowScreen();
    patches = [];
    mockQuery = 'id=b1';
    useAuthStore.setState({ user: ANNA });
    const enquiry = { ...booking('b1', 'Maria Weber'), status: 'ENQUIRY' as const };
    server.use(
      http.get('/api/photographerBookings', () => HttpResponse.json([enquiry])),
      http.patch('/api/bookings/:id/status', async ({ request }) => {
        const { status } = (await request.json()) as { status: string };
        patches.push(status);
        return HttpResponse.json({ ...enquiry, status });
      }),
      http.get('/api/entitlements', () =>
        HttpResponse.json({
          plan: 'STARTER',
          capabilities: [],
          galleryRetentionDays: 60,
          seats: 1,
          commissionBps: 0,
          writable: true,
        })
      ),
      http.get('/api/analytics/summary', () =>
        HttpResponse.json({ year: 2027, bookedCents: 0, invoicedCents: 0, collectedCents: 0 })
      ),
      ...[
        '/api/galleries',
        '/api/packages',
        '/api/resources',
        '/api/bookings/:id/invoices',
        '/api/bookings/conflicts',
        '/api/clients',
      ].map((path) => http.get(path, () => HttpResponse.json([])))
    );
  });
  afterEach(() => {
    cleanup();
    useAuthStore.setState({ user: null });
    mockQuery = 'id=b2';
  });

  it('asks before declining, and sends nothing when the photographer keeps it', async () => {
    const user = setupUser();
    renderWithProviders(<BookingsPage />, { lang: 'en' });

    await user.click(await screen.findByRole('button', { name: 'Decline enquiry' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/declines the enquiry from Maria Weber/)).toBeVisible();

    await user.click(within(dialog).getByRole('button', { name: 'Keep enquiry' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(patches).toEqual([]);
  });

  it('declines once the photographer confirms', async () => {
    const user = setupUser();
    renderWithProviders(<BookingsPage />, { lang: 'en' });

    await user.click(await screen.findByRole('button', { name: 'Decline enquiry' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Decline enquiry' }));

    await waitFor(() => expect(patches).toEqual(['DECLINED']));
  });
});
