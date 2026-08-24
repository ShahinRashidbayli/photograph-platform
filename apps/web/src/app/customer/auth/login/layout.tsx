import type { Metadata } from 'next';

// Titles live in a layout because the page itself is a client component, and
// `metadata` is only read from server components. See `(auth)/layout.tsx` for
// why these are in German.
export const metadata: Metadata = {
  title: 'Kunden-Anmeldung · Fotolio',
  description: 'Melden Sie sich mit einem einmaligen Link an — ohne Passwort.',
};

export default function CustomerLoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
