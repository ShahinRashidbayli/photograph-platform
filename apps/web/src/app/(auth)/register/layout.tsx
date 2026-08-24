import type { Metadata } from 'next';

// Titles live in a layout because the page itself is a client component, and
// `metadata` is only read from server components. See `(auth)/layout.tsx` for
// why these are in German.
export const metadata: Metadata = {
  title: 'Studio erstellen · Fotolio',
  description: 'Starten Sie Ihre 14-tägige kostenlose Testphase — ohne Kreditkarte.',
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
