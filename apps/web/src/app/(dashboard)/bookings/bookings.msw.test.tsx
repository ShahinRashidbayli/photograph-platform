import React from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import { http, HttpResponse, server } from '@/test-utils/msw';
import { useAuthStore, type AuthUser } from '@/store/authStore';
import BookingsPage from './page';

jest.mock('next/navigation', () => ({
  usePathname: () => '/bookings',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn(), back: jest.fn() }),
  useSearchParams: () => new URLSearchParams('id=b2'),
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

function booking(id: string, clientName: string) {
  return {
    id,
    clientName,
    clientEmail: `${id}@example.de`,
    eventDate: '2027-06-12',
    eventType: 'WEDDING',
    status: 'CONFIRMED',
    totalAmountCents: 100_000,
    amountPaidCents: 0,
    paymentState: 'NOT_INVOICED',
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
      // Everything else the page loads alongside, answered empty.
      ...[
        '/api/galleries',
        '/api/packages',
        '/api/bookings/:id/invoices',
        '/api/customerBookings',
        '/api/customer/contracts',
        '/api/customer/galleries',
        '/api/customer/inquiry-requests',
        '/api/customer/invoices',
      ].map((path) => http.get(path, () => HttpResponse.json([])))
    );
  });
  afterEach(() => useAuthStore.setState({ user: null }));

  it('opens the linked booking, not the list, on a narrow screen', async () => {
    renderWithProviders(<BookingsPage />, { lang: 'en' });

    expect(await screen.findByRole('button', { name: 'All bookings' })).toBeVisible();
    expect(screen.getByRole('heading', { name: /Jonas Keller/ })).toBeVisible();
  });
});
