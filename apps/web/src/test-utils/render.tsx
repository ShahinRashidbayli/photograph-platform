import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender, type RenderResult } from '@testing-library/react';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/config';
import { useLangStore } from '@/store/langStore';

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
