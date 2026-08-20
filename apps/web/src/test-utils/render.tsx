import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender, type RenderResult } from '@testing-library/react';

/**
 * Renders a component with the providers it needs in the app.
 *
 * <p>Retries are off: React Query's default is three attempts with backoff, so
 * a test asserting an error state would sit through several seconds of retries
 * before seeing it — and usually time out instead.
 */
export function renderWithProviders(
  ui: React.ReactElement
): RenderResult & { queryClient: QueryClient } {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  const result = rtlRender(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  return { ...result, queryClient };
}
