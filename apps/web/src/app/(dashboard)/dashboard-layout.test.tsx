import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import { useAuthStore, type AuthUser } from '@/store/authStore';
import DashboardLayout from './layout';

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn().mockResolvedValue({ data: [] }), post: jest.fn() },
}));

jest.mock('@/lib/paging', () => ({
  fetchAllPages: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/hooks/useBookings', () => ({
  useBookings: () => ({ data: [], bookings: [], isLoading: false, error: null }),
}));

import DashboardPage from './dashboard/page';

const PHOTOGRAPHER: AuthUser = {
  id: 'u1',
  email: 'anna@fotografie.de',
  fullName: 'Anna Fischer',
  role: 'PHOTOGRAPHER',
  emailVerified: true,
  tenant: { subdomain: 'anna-foto', plan: 'STARTER' },
};

/**
 * React reports a missing `key` through `console.error`, which no assertion
 * would otherwise notice — the tree still renders, so every other check passes
 * while the reconciler is quietly told it may reorder rows freely. Failing on
 * it is the only way a test can see it.
 */
function failOnReactKeyWarnings() {
  const seen: string[] = [];
  // Captured before the spy replaces it, and called through below so a real
  // React problem still reaches the terminal instead of being swallowed by
  // the very helper that is meant to surface one.
  // eslint-disable-next-line no-console
  const original = console.error;
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const text = args.map(String).join(' ');
    if (text.includes('unique "key" prop')) seen.push(text);
    original(...(args as Parameters<typeof console.error>));
  });
  return seen;
}

describe('DashboardLayout', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    useAuthStore.setState({ user: null });
  });

  it('renders every list with keys', async () => {
    const warnings = failOnReactKeyWarnings();
    useAuthStore.setState({ user: PHOTOGRAPHER });

    renderWithProviders(
      <DashboardLayout>
        <div>page</div>
      </DashboardLayout>,
      { lang: 'en' }
    );

    await waitFor(() => expect(screen.getByText('page')).toBeInTheDocument());

    expect(warnings).toEqual([]);
  });

  /**
   * The shell with the page the router actually nests inside it. The stub
   * above only exercises the sidebar; the warning a user sees after signing in
   * could just as easily come from the page, which React attributes to the
   * layout that owns it.
   */
  it('renders the dashboard page inside the shell without key warnings', async () => {
    const warnings = failOnReactKeyWarnings();
    useAuthStore.setState({ user: PHOTOGRAPHER });

    renderWithProviders(
      <DashboardLayout>
        <DashboardPage />
      </DashboardLayout>,
      { lang: 'en' }
    );

    // Wait for the shell's nav to commit, so the assertion runs against a
    // fully rendered tree rather than the first paint.
    await waitFor(() =>
      expect(screen.getByRole('navigation', { name: /main/i })).toBeInTheDocument()
    );

    expect(warnings).toEqual([]);
  });

  it('renders an unverified account’s banner without key warnings', async () => {
    const warnings = failOnReactKeyWarnings();
    useAuthStore.setState({ user: { ...PHOTOGRAPHER, emailVerified: false } });

    renderWithProviders(
      <DashboardLayout>
        <div>page</div>
      </DashboardLayout>,
      { lang: 'en' }
    );

    await waitFor(() => expect(screen.getByText('page')).toBeInTheDocument());

    expect(warnings).toEqual([]);
  });
});
