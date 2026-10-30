import React, { Suspense } from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import { useAuthStore, type AuthUser } from '@/store/authStore';

let PATH = '/dashboard';
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
import SettingsLayout from '@/app/(dashboard)/settings/layout';

const PHOTOGRAPHER: AuthUser = {
  id: 'u1',
  email: 'anna@fotografie.de',
  fullName: 'Anna Fischer',
  role: 'PHOTOGRAPHER',
  emailVerified: true,
  tenant: { subdomain: 'anna-foto', plan: 'STARTER' },
};

function Page() {
  return <div>page content</div>;
}

/**
 * The page, in the shape the App Router actually hands a layout: a lazy *node*
 * whose payload resolves to an element — not to a component, and not to a
 * plain element handed over directly.
 *
 * <p>Resolving it first is the whole point. React only looks inside a lazy
 * child once its payload has landed, so an unresolved one never reaches the
 * key check — which is why this shows up a beat after sign-in (the shell
 * renders its loading screen first, then re-renders with the page already
 * resolved) rather than on the first paint.
 */
async function resolvedLazyPage(): Promise<React.ReactNode> {
  // `lazy` is typed for components because that is what application code uses
  // it for; the router resolves its payload to an element, which is the case
  // under test.
  const node = React.lazy(
    () => Promise.resolve({ default: <Page /> }) as unknown as Promise<{ default: React.FC }>
  ) as unknown as React.ReactNode;
  const { unmount } = renderWithProviders(<Suspense fallback={null}>{node}</Suspense>);
  await screen.findByText('page content');
  unmount();
  return node;
}

function capture() {
  const seen: string[] = [];
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const text = args.map(String).join(' ');
    if (text.includes('unique "key" prop')) seen.push(text);
  });
  return seen;
}

/**
 * A layout that renders `{children}` next to siblings puts the router's page
 * into a child *array*, and React reports a lazy array member with no key as a
 * missing key — naming the layout, not the page, so it reads like a bug in the
 * sidebar.
 *
 * <p>Worth holding a test on because React prints only the first such warning
 * per parent element type: one permanent false positive on a `div` silences
 * every real missing key under every other `div` in the app, which is exactly
 * what `dashboard-key-warnings.test.tsx` exists to catch.
 *
 * <p>That same de-duplication is why both layouts are asserted in one pass
 * rather than one test each — after the first `div` has warned, a second one
 * cannot, so separate cases would only ever exercise whichever ran first. The
 * warning names the layout it came from, so a failure still says which.
 */
describe('the router’s children are not an unkeyed list member', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    useAuthStore.setState({ user: null });
  });

  it('neither the dashboard shell nor the settings frame', async () => {
    const shellPage = await resolvedLazyPage();
    const settingsPage = await resolvedLazyPage();
    const warnings = capture();
    useAuthStore.setState({ user: PHOTOGRAPHER });

    PATH = '/dashboard';
    renderWithProviders(<DashboardLayout>{shellPage}</DashboardLayout>, { lang: 'en' }).unmount();
    PATH = '/settings';
    renderWithProviders(<SettingsLayout>{settingsPage}</SettingsLayout>, { lang: 'en' }).unmount();

    await new Promise((r) => setTimeout(r, 120));
    expect(warnings.map((w) => w.replace(/\s+/g, ' ').slice(0, 220))).toEqual([]);
  });
});
