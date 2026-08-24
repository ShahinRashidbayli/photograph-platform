import type { Metadata } from 'next';

// Titles live in a layout because the page itself is a client component, and
// `metadata` is only read from server components. See `(auth)/layout.tsx` for
// why these are in German.
export const metadata: Metadata = {
  title: 'Anmeldung · Fotolio',
  description: 'Ihr Anmeldelink wird geprüft.',
};

export default function CustomerVerifyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
