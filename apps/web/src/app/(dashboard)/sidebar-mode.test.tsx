import React from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders, setupUser } from '@/test-utils/render';
import { useAuthStore, type AuthUser } from '@/store/authStore';

let PATH = '/bookings';
jest.mock('next/navigation', () => ({
  usePathname: () => PATH,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn(), back: jest.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  useParams: () => ({}),
}));

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => Promise.resolve({ data: [] })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
    put: jest.fn(() => Promise.resolve({ data: {} })),
    patch: jest.fn(() => Promise.resolve({ data: {} })),
    delete: jest.fn(() => Promise.resolve({ data: {} })),
  },
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (q: string) => ({
    matches: false,
    media: q,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});

import DashboardLayout from '@/app/(dashboard)/layout';

const PHOTOGRAPHER: AuthUser = {
  id: 'u1',
  email: 'anna@fotografie.de',
  fullName: 'Anna Fischer',
  role: 'PHOTOGRAPHER',
  emailVerified: true,
  tenant: { subdomain: 'anna-foto', plan: 'STARTER' },
};

const CLIENT: AuthUser = { ...PHOTOGRAPHER, id: 'c1', role: 'CLIENT' };

const render = () =>
  renderWithProviders(
    <DashboardLayout>
      <div>page</div>
    </DashboardLayout>,
    { lang: 'en' }
  );

/**
 * The sidebar shows one half of the product at a time.
 *
 * <p>What these hold is the part that is easy to get wrong later: the switch
 * has to follow the route, because a link to a community page that opened with
 * the workspace list would leave the photographer looking at a sidebar that
 * does not contain the page they are on.
 */
describe('the sidebar mode switch', () => {
  afterEach(() => {
    PATH = '/bookings';
    useAuthStore.setState({ user: null });
  });

  it('shows one half at a time, and swaps without navigating', async () => {
    const user = setupUser();
    useAuthStore.setState({ user: PHOTOGRAPHER });
    render();

    expect(screen.getByRole('link', { name: /Bookings/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Gear guide/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Community' }));

    expect(screen.getByRole('link', { name: /Gear guide/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Bookings/ })).not.toBeInTheDocument();
  });

  it('opens on the half the route belongs to', () => {
    PATH = '/community/studios';
    useAuthStore.setState({ user: PHOTOGRAPHER });
    render();

    expect(screen.getByRole('tab', { name: 'Community' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('link', { name: /Studios/ })).toBeInTheDocument();
  });

  /** A control offering one choice is not a choice. */
  it('is absent for a client, whose nav has only one half', () => {
    useAuthStore.setState({ user: CLIENT });
    render();

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });
});
