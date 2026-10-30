import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test-utils/render';
import { useAuthStore, type AuthUser } from '@/store/authStore';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push, replace: jest.fn(), refresh: jest.fn(), back: jest.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

const patch = jest.fn().mockResolvedValue({ data: {} });
jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockResolvedValue({ data: [] }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    patch: (...args: unknown[]) => patch(...args),
  },
}));

const hoursAgo = (n: number) => new Date(Date.now() - n * 3600_000).toISOString();

const LEADS = [
  // Older than a day: overdue.
  {
    id: 'lead-1',
    name: 'Katharina Berg',
    email: 'kb@example.test',
    status: 'NEW',
    eventType: 'Wedding',
    eventDate: '2026-06-12',
    source: 'WEBSITE',
    createdAt: hoursAgo(72),
  },
  // Within the day: new.
  {
    id: 'lead-2',
    name: 'Maria Kellner',
    email: 'mk@example.test',
    status: 'NEW',
    eventType: 'Wedding',
    eventDate: '2026-07-04',
    source: 'WEBSITE',
    createdAt: hoursAgo(6),
  },
  // Submitted without a name — the panel has to say something anyway.
  {
    id: 'lead-3',
    name: null,
    email: null,
    status: 'NEW',
    eventType: null,
    eventDate: null,
    source: 'WEBSITE',
    createdAt: hoursAgo(0.3),
  },
  {
    id: 'lead-4',
    name: 'Already handled',
    status: 'REPLIED',
    eventType: 'Wedding',
    createdAt: hoursAgo(48),
  },
];
const INQUIRIES = [
  {
    id: 'inq-1',
    customerName: null,
    customerEmail: 'anna@example.test',
    status: 'PENDING',
    eventType: 'Wedding',
    proposedDate: null,
    createdAt: hoursAgo(4),
  },
  {
    id: 'inq-2',
    customerName: 'Decided already',
    status: 'BOOKING_CREATED',
    eventType: 'Wedding',
    createdAt: hoursAgo(50),
  },
];

const fetchAllPages = jest.fn((url: string) =>
  Promise.resolve(url.includes('inquiries') ? INQUIRIES : LEADS)
);
jest.mock('@/lib/paging', () => ({
  fetchAllPages: (...args: unknown[]) => fetchAllPages(...(args as [string])),
}));

jest.mock('@/hooks/useBookings', () => ({
  useBookings: () => ({ data: [], bookings: [], isLoading: false, error: null }),
}));

import DashboardLayout from './layout';

const PHOTOGRAPHER: AuthUser = {
  id: 'u1',
  email: 'anna@fotografie.de',
  fullName: 'Anna Fischer',
  role: 'PHOTOGRAPHER',
  emailVerified: true,
  tenant: { subdomain: 'anna-foto', plan: 'STARTER' },
};

/**
 * The bell used to navigate to /leads, which answered "how many" with a page
 * load and never answered "which". These cover what it answers now.
 */
describe('notification panel', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: PHOTOGRAPHER });
    push.mockClear();
    patch.mockClear();
    fetchAllPages.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    useAuthStore.setState({ user: null });
  });

  async function openBell() {
    renderWithProviders(
      <DashboardLayout>
        <div />
      </DashboardLayout>,
      { lang: 'en' }
    );
    // The badge only appears once the counts land.
    const bell = await screen.findByRole('button', { name: /needs? attention/i });
    await userEvent.click(bell);
    return bell;
  }

  it('opens the waiting items instead of navigating away', async () => {
    await openBell();

    expect(await screen.findByRole('menu', { name: /needs attention/i })).toBeInTheDocument();
    expect(screen.getByText('Katharina Berg')).toBeInTheDocument();
    expect(screen.getByText('Maria Kellner')).toBeInTheDocument();
    // Clicking the bell navigates nowhere — that was the complaint.
    expect(push).not.toHaveBeenCalled();
  });

  /**
   * The panel shows what is still waiting, so that is what it should ask for.
   *
   * <p>It used to ask for everything and filter in the browser — from the
   * dashboard *layout*, so on every screen, in every open tab, every 60
   * seconds, walking the studio's whole lead and inquiry history a hundred
   * rows per round trip to render a list that is almost always short. Both
   * endpoints take `?status=`, and the waiting set is bounded by how fast the
   * photographer works rather than by how long they have been in business.
   *
   * <p>Pinned because the failure is invisible: the panel looks identical
   * either way, and the cost only shows up on the busiest account.
   */
  it('asks the server for the waiting rows rather than the whole history', async () => {
    await openBell();

    expect(fetchAllPages).toHaveBeenCalledWith('/api/leads', { status: 'NEW' });
    expect(fetchAllPages).toHaveBeenCalledWith('/api/inquiries', { status: 'PENDING' });
  });

  it('lists only what is actually waiting', async () => {
    await openBell();
    await screen.findByRole('menu', { name: /needs attention/i });

    // A replied lead and a decided inquiry are done with, and the badge does
    // not count them either.
    expect(screen.queryByText('Already handled')).not.toBeInTheDocument();
    expect(screen.queryByText('Decided already')).not.toBeInTheDocument();
  });

  it('marks a lead replied through the real transition, and drops the row', async () => {
    await openBell();
    await screen.findByRole('menu', { name: /needs attention/i });

    const rows = screen.getAllByRole('menuitem', { name: /mark replied/i });
    await userEvent.click(rows[0]);

    await waitFor(() =>
      // Not a local read flag: this is LeadService#markReplied, the same
      // transition that clears the badge and lands in the audit trail.
      expect(patch).toHaveBeenCalledWith('/api/leads/lead-1/status', { status: 'REPLIED' })
    );
    await waitFor(() => expect(screen.queryByText('Katharina Berg')).not.toBeInTheDocument());
  });

  /**
   * Accepting or rejecting an inquiry creates a booking or sends the customer
   * a refusal. That is not a dropdown decision, so those rows link out instead
   * of offering a one-click clear.
   */
  it('offers no one-click clear for an inquiry', async () => {
    await openBell();
    await screen.findByRole('menu', { name: /needs attention/i });

    expect(screen.getByRole('menuitem', { name: /^review$/i })).toBeInTheDocument();
    // One tick per unreplied lead, and none for the inquiry.
    expect(screen.getAllByRole('menuitem', { name: /mark replied/i })).toHaveLength(3);
  });

  /**
   * Five equal rows are five equal claims on the photographer's attention, and
   * they are not equal — an enquiry from three days ago is a booking going to
   * someone else.
   */
  it('separates what is late from what just arrived, with counts', async () => {
    await openBell();
    await screen.findByRole('menu', { name: /needs attention/i });

    // 72h old.
    expect(screen.getByText((_, el) => el?.textContent === 'Overdue · 1')).toBeTruthy();
    // 6h, 20min and the 4h inquiry.
    expect(screen.getByText((_, el) => el?.textContent === 'New · 3')).toBeTruthy();
  });

  /** A form submitted without a name still has to be recognisable. */
  it('names the nameless by what is known about them', async () => {
    await openBell();
    await screen.findByRole('menu', { name: /needs attention/i });

    expect(screen.getByText('Inquiry without a name')).toBeInTheDocument();
    // Its address is what identifies it, so it moves into the subtitle.
    expect(screen.getByText(/anna@example\.test/)).toBeInTheDocument();
    expect(screen.getByText('No name')).toBeInTheDocument();
  });

  it('clears every lead at once, and leaves the inquiry alone', async () => {
    await openBell();
    await screen.findByRole('menu', { name: /needs attention/i });

    await userEvent.click(screen.getByRole('menuitem', { name: /mark all replied/i }));

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(3));
    for (const id of ['lead-1', 'lead-2', 'lead-3']) {
      expect(patch).toHaveBeenCalledWith(`/api/leads/${id}/status`, { status: 'REPLIED' });
    }
    // The inquiry is untouched: clearing one means accepting or rejecting it.
    expect(patch).not.toHaveBeenCalledWith(expect.stringContaining('inq-1'), expect.anything());
    await waitFor(() => expect(screen.getByText('Inquiry without a name')).toBeInTheDocument());
  });

  it('closes on Escape', async () => {
    await openBell();
    await screen.findByRole('menu', { name: /needs attention/i });

    await userEvent.keyboard('{Escape}');

    await waitFor(() =>
      expect(screen.queryByRole('menu', { name: /needs attention/i })).not.toBeInTheDocument()
    );
  });
});
