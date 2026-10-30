import type { Metadata } from 'next';

/**
 * Every auth screen shared the root layout's bare "Fotolio" title, so a user
 * with sign-in, the pricing page and their dashboard open saw three
 * indistinguishable tabs — and a shared link previewed as nothing in
 * particular.
 *
 * The titles are German because that is `DEFAULT_LOCALE` and what
 * `<html lang>` says on the server. Metadata is produced server-side, where
 * the visitor's stored language preference is not knowable, and this product
 * deliberately keeps locale out of the URL (see `store/langStore.ts`) — so a
 * visitor who has switched to English gets a German tab title. That is the
 * known cost of un-routed locales, and the default being right for the market
 * is worth more than every tab reading "Fotolio".
 *
 * `noindex` on the group: these pages have nothing to rank for, and a sign-in
 * form in search results is a phishing target rather than a landing page.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
