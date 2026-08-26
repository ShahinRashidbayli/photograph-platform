import React from 'react';
import { renderWithProviders } from '@/test-utils/render';
import { useAuthStore, type AuthUser } from '@/store/authStore';

let PATH = '/dashboard';
jest.mock('next/navigation', () => ({
  usePathname: () => PATH,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn(), back: jest.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  useParams: () => ({}),
}));

const ROWS = [
  {
    id: 'a1',
    name: 'One',
    fullName: 'One P',
    title: 'One',
    clientName: 'One',
    clientEmail: 'a@x.de',
    email: 'a@x.de',
    status: 'CONFIRMED',
    state: 'ACTIVE',
    createdAt: '2026-08-20T10:00:00Z',
    startTime: '2026-09-01T10:00:00Z',
    eventDate: '2026-09-01',
    deliveredAt: '2026-08-20',
    createdDate: '2026-08-20',
    expiresAt: '2026-10-01T10:00:00Z',
    totalAmount: 48000,
    amount: 48000,
    photoCount: 4,
    token: 'tok-aaaaaaaaaaaaaaaaaaaa-1',
    accessToken: 'tok-aaaaaaaaaaaaaaaaaaaa-1',
    shareToken: 'tok-aaaaaaaaaaaaaaaaaaaa-1',
    eventType: 'WEDDING',
    source: 'WEBSITE',
  },
  {
    id: 'a2',
    name: 'Two',
    fullName: 'Two P',
    title: 'Two',
    clientName: 'Two',
    clientEmail: 'b@x.de',
    email: 'b@x.de',
    status: 'PENDING',
    state: 'ACTIVE',
    createdAt: '2026-08-21T10:00:00Z',
    startTime: '2026-09-02T10:00:00Z',
    eventDate: '2026-09-02',
    deliveredAt: '2026-08-21',
    createdDate: '2026-08-21',
    expiresAt: '2026-10-02T10:00:00Z',
    totalAmount: 72000,
    amount: 72000,
    photoCount: 7,
    token: 'tok-bbbbbbbbbbbbbbbbbbbb-2',
    accessToken: 'tok-bbbbbbbbbbbbbbbbbbbb-2',
    shareToken: 'tok-bbbbbbbbbbbbbbbbbbbb-2',
    eventType: 'PORTRAIT',
    source: 'INSTAGRAM',
  },
];

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    // Most screens read a list; /api/team reads an object. Returning rows for
    // both would only prove the pages survive a shape they never receive.
    get: jest.fn((url: string) =>
      Promise.resolve({
        data: String(url).startsWith('/api/team')
          ? { members: [], invitations: [], seatsUsed: 1, seatsTotal: 3, canManage: true }
          : (globalThis as any).__ROWS,
      })
    ),
    post: jest.fn(() => Promise.resolve({ data: {} })),
    put: jest.fn(() => Promise.resolve({ data: {} })),
    patch: jest.fn(() => Promise.resolve({ data: {} })),
    delete: jest.fn(() => Promise.resolve({ data: {} })),
  },
}));
jest.mock('@/lib/paging', () => ({
  fetchAllPages: jest.fn(() => Promise.resolve((globalThis as any).__ROWS)),
}));
jest.mock('@/hooks/useBookings', () => ({
  useBookings: () => ({
    data: (globalThis as any).__ROWS,
    bookings: (globalThis as any).__ROWS,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));
(globalThis as any).__ROWS = ROWS;

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

import DashboardLayout from '@/app/(dashboard)/layout';

const PHOTOGRAPHER: AuthUser = {
  id: 'u1',
  email: 'anna@fotografie.de',
  fullName: 'Anna Fischer',
  role: 'PHOTOGRAPHER',
  emailVerified: true,
  tenant: { subdomain: 'anna-foto', plan: 'STARTER' },
};

const PAGES: [string, string][] = [
  ['dashboard', '/dashboard'],
  ['bookings', '/bookings'],
  ['clients', '/clients'],
  ['leads', '/leads'],
  ['galleries', '/galleries'],
  ['payments', '/payments'],
  ['portfolio', '/portfolio'],
  ['documents', '/documents'],
  ['settings', '/settings'],
  ['reports', '/reports'],
  ['revenue', '/revenue'],
];

/**
 * React reports a missing key through `console.error` and carries on rendering,
 * so nothing that inspects the tree can see it — collecting the call is the
 * only way an assertion can. Other `console.error` output is swallowed on
 * purpose: these pages log expected fetch failures against the mocked API, and
 * letting those through buries the one line this file exists to surface.
 */
function capture() {
  const seen: string[] = [];
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const text = args.map(String).join(' ');
    if (text.includes('unique "key" prop')) seen.push(text);
  });
  return seen;
}

/**
 * Every page the shell nests, rendered with populated lists, asserted free of
 * React key warnings.
 *
 * <p>`dashboard-layout.test.tsx` covers the shell itself, but it mocks the API
 * to return `[]` — and an empty list cannot produce a key warning, so it can
 * only ever prove the sidebar is fine. The warning a user actually hits comes
 * from a list with rows in it, which means the fixture has to have rows.
 *
 * <p>The rows carry a superset of the fields these pages read, `id` included.
 * That last part is the point: React reports a missing key the same way
 * whether the `key` prop was forgotten or evaluated to `undefined`, and
 * `key={row.id}` on a payload whose primary key is named something else is
 * silently the second case. Dropping `id` from one row here makes four of
 * these tests fail, which is the check working.
 */
describe('key warnings across the dashboard', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    useAuthStore.setState({ user: null });
  });

  it.each(PAGES)('%s', async (name, path) => {
    PATH = path;
    const warnings = capture();
    useAuthStore.setState({ user: PHOTOGRAPHER });
    // Required lazily: the page has to be loaded after the mocks above are in
    // place, and `name` is what varies per case.
    // eslint-disable-next-line no-undef
    const Page = require(`@/app/(dashboard)/${name}/page`).default;
    renderWithProviders(
      <DashboardLayout>
        <Page />
      </DashboardLayout>,
      { lang: 'en' }
    );
    await new Promise((r) => setTimeout(r, 120));
    // Mapped to strings so a failure prints the page and React's own "check
    // the render method of X" pointer rather than just a length mismatch.
    expect(warnings.map((w) => `${name}: ${w.slice(0, 240)}`)).toEqual([]);
  });
});
