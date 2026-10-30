'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Subscribe to a CSS media query from React.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect` on purpose: the
 * server has no viewport, so the server snapshot is always `false` and the
 * client re-reads the real value during hydration. A naive `useState(
 * window.matchMedia(...).matches)` throws during SSR; a naive effect-based
 * version renders one frame of the wrong layout.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined') return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    // Server snapshot: assume the roomy layout, which is what the desktop-first
    // styles already describe.
    () => false
  );
}
