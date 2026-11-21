import React from 'react';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import { http, HttpResponse, server } from '@/test-utils/msw';
import { useAuthStore, type AuthUser } from '@/store/authStore';
import DashboardPage from './page';

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn(), back: jest.fn() }),
  useSearchParams: () => new URLSearchParams(''),
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

/** An ISO date `days` from today, so every booking below is upcoming whenever this runs. */
function inDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function booking(id: string, clientName: string, status: string, total: number, paid: number) {
  return {
    id,
    clientName,
    clientEmail: `${id}@example.de`,
    eventDate: inDays(20),
    eventType: 'WEDDING',
    status,
    totalAmountCents: total,
    amountPaidCents: paid,
    paymentState: paid > 0 ? 'PARTIALLY_PAID' : 'NOT_INVOICED',
  };
}

/**
 * The dashboard's figures against a faked API.
 *
 * <p>Revenue is quoted money, so only Billable bookings count (GLOSSARY.md):
 * an enquiry's quote used to be added in, and the dashboard disagreed with the
 * bookings overview for the same bookings. Collected and the upcoming list keep
 * their rule of "every booking that is still on": money paid on an enquiry is
 * not dropped, and an enquiry still ahead is still something to look at. (Both
 * screens' Collected move to one server figure in #69.)
 */
describe('DashboardPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: ANNA });
    server.use(
      http.get('/api/photographerBookings', () =>
        HttpResponse.json([
          booking('b1', 'Maria Weber', 'CONFIRMED', 100_000, 20_000),
          booking('b2', 'Jonas Keller', 'ENQUIRY', 50_000, 5_000),
          booking('b3', 'Lea Brandt', 'CANCELLED', 30_000, 0),
        ])
      ),
      http.get('/api/leads', () => HttpResponse.json([]))
    );
  });
  afterEach(() => useAuthStore.setState({ user: null }));

  it('counts only Billable bookings as revenue', async () => {
    renderWithProviders(<DashboardPage />, { lang: 'en' });

    const revenue = (await screen.findByText('Total revenue')).parentElement as HTMLElement;
    expect(await within(revenue).findByText('€1,000')).toBeInTheDocument();
  });

  it('keeps money already paid on an enquiry in Collected', async () => {
    renderWithProviders(<DashboardPage />, { lang: 'en' });

    const revenue = (await screen.findByText('Total revenue')).parentElement as HTMLElement;
    expect(await within(revenue).findByText('€250 collected so far')).toBeInTheDocument();
  });

  it('still lists an upcoming enquiry, and leaves out a cancelled one', async () => {
    renderWithProviders(<DashboardPage />, { lang: 'en' });

    expect(await screen.findByText('Jonas Keller')).toBeInTheDocument();
    expect(screen.getByText('Maria Weber')).toBeInTheDocument();
    expect(screen.queryByText('Lea Brandt')).not.toBeInTheDocument();
    expect(screen.getByText('2 upcoming in total')).toBeInTheDocument();
  });
});
