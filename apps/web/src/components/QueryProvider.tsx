'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

/**
 * App-wide React Query provider. The client is created lazily in state so it's
 * stable across re-renders and never shared between requests (SSR-safe).
 *
 * Defaults are tuned for this dashboard: a short freshness window means
 * navigating back to a page within 30s serves cached data instantly (no
 * refetch), while still revalidating afterwards. Window-focus refetch is off by
 * default to avoid surprise reloads — opt in per-query where live data matters.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
