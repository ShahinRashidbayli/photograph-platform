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

function fakeSummary(summary: {
  year: number;
  bookedCents: number;
  invoicedCents: number;
  collectedCents: number;
}) {
  server.use(http.get('/api/analytics/summary', () => HttpResponse.json(summary)));
}

/** The tile whose label is `label`: the label's cell holds the value and the help text. */
async function tile(label: string): Promise<HTMLElement> {
  return (await screen.findByText(label, { selector: 'span' })).parentElement as HTMLElement;
}

/**
 * The dashboard's figures against a faked API.
 *
 * <p>Booked, Invoiced and Collected are the server's year summary, on every
 * plan (ADR-004, Consequences). The page used to add up the booking list in the
 * browser with its own Billable list and call the result "revenue", which
 * counted enquiries at one point and disagreed with the bookings screen at
 * another. The bookings below would add up to other figures, so a tile that
 * matches the summary can only have come from the server.
 *
 * <p>The upcoming list and its count keep the rule of "every booking that is
 * still on": an enquiry still ahead is still something to look at.
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
    fakeSummary({
      year: 2026,
      bookedCents: 812_000,
      invoicedCents: 640_500,
      collectedCents: 415_200,
    });
  });
  afterEach(() => useAuthStore.setState({ user: null }));

  it('shows Booked, Invoiced and Collected for the year from the summary', async () => {
    renderWithProviders(<DashboardPage />, { lang: 'en' });

    const booked = await tile('Booked');
    expect(await within(booked).findByText('€8,120')).toBeInTheDocument();
    expect(
      within(booked).getByText('Confirmed, postponed and completed shoots in 2026')
    ).toBeInTheDocument();

    const invoiced = await tile('Invoiced');
    expect(within(invoiced).getByText('€6,405')).toBeInTheDocument();
    expect(
      within(invoiced).getByText('Invoices issued in 2026, net of Storno')
    ).toBeInTheDocument();

    const collected = await tile('Collected');
    expect(within(collected).getByText('€4,152')).toBeInTheDocument();
    expect(within(collected).getByText('Payments that arrived in 2026')).toBeInTheDocument();
  });

  it('names the figures in German', async () => {
    renderWithProviders(<DashboardPage />, { lang: 'de' });

    const booked = await tile('Gebucht');
    expect(await within(booked).findByText(/8\.120/)).toBeInTheDocument();
    expect(
      within(booked).getByText('Bestätigte, verschobene und abgeschlossene Shootings in 2026')
    ).toBeInTheDocument();
    expect(
      within(await tile('In Rechnung gestellt')).getByText(
        '2026 ausgestellte Rechnungen, abzüglich Storno'
      )
    ).toBeInTheDocument();
    expect(
      within(await tile('Eingegangen')).getByText('2026 eingegangene Zahlungen')
    ).toBeInTheDocument();
  });

  it('shows a year with nothing in it yet as zero, not as missing', async () => {
    fakeSummary({ year: 2027, bookedCents: 0, invoicedCents: 0, collectedCents: 0 });
    renderWithProviders(<DashboardPage />, { lang: 'en' });

    for (const label of ['Booked', 'Invoiced', 'Collected']) {
      expect(await within(await tile(label)).findByText('€0')).toBeInTheDocument();
    }
    expect(
      screen.getByText('Confirmed, postponed and completed shoots in 2027')
    ).toBeInTheDocument();
  });

  it('never calls a figure revenue', async () => {
    renderWithProviders(<DashboardPage />, { lang: 'en' });

    await within(await tile('Booked')).findByText('€8,120');
    expect(screen.queryByText(/revenue/i)).not.toBeInTheDocument();
  });

  it('still lists an upcoming enquiry, and leaves out a cancelled one', async () => {
    renderWithProviders(<DashboardPage />, { lang: 'en' });

    expect(await screen.findByText('Jonas Keller')).toBeInTheDocument();
    expect(screen.getByText('Maria Weber')).toBeInTheDocument();
    expect(screen.queryByText('Lea Brandt')).not.toBeInTheDocument();
    expect(screen.getByText('2 upcoming in total')).toBeInTheDocument();
  });
});
