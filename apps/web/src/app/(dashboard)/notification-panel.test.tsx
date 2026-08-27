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

const LEADS = [
  {
    id: 'lead-1',
    name: 'Maria Kellner',
    status: 'NEW',
    eventType: 'WEDDING',
    createdAt: '2026-08-26T10:00:00Z',
  },
  {
    id: 'lead-2',
    name: 'Jonas Weber',
    status: 'NEW',
    eventType: 'PORTRAIT',
    createdAt: '2026-08-25T10:00:00Z',
  },
  {
    id: 'lead-3',
    name: 'Already handled',
    status: 'REPLIED',
    eventType: 'WEDDING',
    createdAt: '2026-08-24T10:00:00Z',
  },
];
const INQUIRIES = [
  {
    id: 'inq-1',
    customerName: 'Lena Vogt',
    status: 'PENDING',
    eventType: 'HOCHZEIT',
    createdAt: '2026-08-27T10:00:00Z',
  },
  {
    id: 'inq-2',
    customerName: 'Decided already',
    status: 'BOOKING_CREATED',
    eventType: 'HOCHZEIT',
    createdAt: '2026-08-23T10:00:00Z',
  },
];

jest.mock('@/lib/paging', () => ({
  fetchAllPages: jest.fn((url: string) =>
    Promise.resolve(url.includes('inquiries') ? INQUIRIES : LEADS)
  ),
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
    expect(screen.getByText('Maria Kellner')).toBeInTheDocument();
    expect(screen.getByText('Lena Vogt')).toBeInTheDocument();
    // Clicking the bell navigates nowhere — that was the complaint.
    expect(push).not.toHaveBeenCalled();
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
    await waitFor(() => expect(screen.queryByText('Maria Kellner')).not.toBeInTheDocument());
  });

  /**
   * Accepting or rejecting an inquiry creates a booking or sends the customer
   * a refusal. That is not a dropdown decision, so those rows link out instead
   * of offering a one-click clear.
   */
  it('offers no one-click clear for an inquiry', async () => {
    await openBell();
    await screen.findByRole('menu', { name: /needs attention/i });

    const row = screen.getByText('Lena Vogt').closest('div')?.parentElement;
    expect(row).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /review/i })).toBeInTheDocument();
    // One lead button per unreplied lead, and none for the inquiry.
    expect(screen.getAllByRole('menuitem', { name: /mark replied/i })).toHaveLength(2);
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
