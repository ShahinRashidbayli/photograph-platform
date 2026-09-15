import type { ReactNode } from 'react';

/**
 * The slot a layout renders its route's page into.
 *
 * <p>It draws nothing — no element, no wrapper, no style — and exists only to
 * keep `children` out of a sibling array.
 *
 * <p>The App Router does not hand a layout a plain element. It hands it a lazy
 * node whose payload resolves to one, and a lazy node carries no key of its
 * own. Put it beside siblings — a banner above it, a dialog after it — and
 * React is reconciling a *list*: once the payload has landed it resolves the
 * lazy, finds no key on what comes out, and reports "Each child in a list
 * should have a unique key prop", naming the layout that rendered the list.
 * Nothing is actually wrong. The router owns that node and there is nowhere to
 * put a key on it. It surfaces a beat after sign-in rather than on first paint
 * because the shell renders its loading screen first, and only the re-render
 * after {@code /api/auth/me} lands has a page resolved enough to look inside.
 *
 * <p>The cost of leaving it is not the noise. React prints one such warning
 * per parent element type and then goes quiet, so a permanent false positive
 * on a `div` is enough to swallow every genuine missing key under every other
 * `div` in the app — the exact class of bug
 * {@code dashboard-key-warnings.test.tsx} exists to catch.
 *
 * <p>Wrapping the page in a component of its own puts it back in a
 * single-child position, which React reconciles without ever asking for a key.
 */
export function RouteSlot({ children }: Readonly<{ children: ReactNode }>) {
  return <>{children}</>;
}
