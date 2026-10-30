import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/config';
import { useLangStore } from '@/store/langStore';

/**
 * `userEvent`, without the typing delay.
 *
 * <p>By default `userEvent` waits between keystrokes to imitate a real typist.
 * The wait is real time, and it is paid per character: the sign-up suite fills
 * five fields — about sixty characters — before it can assert anything, and
 * every one of those is a trip through the event loop. On an idle machine that
 * is fine, and under Jest's parallel workers it is not. `register.test.tsx` was
 * failing roughly one run in two on the default 5s timeout while passing 3/3
 * when run alone, which is the signature of a test that is slow rather than
 * wrong.
 *
 * <p>`delay: null` removes the pause, not the events — each keystroke is still
 * dispatched in order, so anything the component does per character still
 * happens. Debounces keep working: they run on their own timers, and the
 * assertions already wait for them through `findBy*` / `waitFor`.
 *
 * <p>Pass `advanceTimers` through when the test installs fake timers, or
 * `userEvent` will wait on a clock nothing is winding.
 */
export function setupUser(options?: Parameters<typeof userEvent.setup>[0]) {
  return userEvent.setup({ delay: null, ...options });
}

interface RenderOptions {
  /**
   * UI language for this render. Pass it in any test that asserts on visible
   * copy, so the assertion states which language it is written in rather than
   * inheriting whatever the product currently defaults to — changing that
   * default is a product decision and should not turn unrelated suites red.
   */
  lang?: Locale;
}

/**
 * Renders a component with the providers it needs in the app.
 *
 * <p>Retries are off: React Query's default is three attempts with backoff, so
 * a test asserting an error state would sit through several seconds of retries
 * before seeing it — and usually time out instead.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  { lang = DEFAULT_LOCALE }: RenderOptions = {}
): RenderResult & { queryClient: QueryClient } {
  // Before the render, so the first committed tree is already in this
  // language. `jest.setup.ts` clears the persisted store between tests.
  useLangStore.setState({ lang });

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  const result = rtlRender(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  return { ...result, queryClient };
}
