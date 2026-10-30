import type { Metadata } from 'next';

// Titles live in a layout because the page itself is a client component, and
// `metadata` is only read from server components. See `(auth)/layout.tsx` for
// why these are in German.
export const metadata: Metadata = {
  title: 'E-Mail bestätigen · Fotolio',
  description: 'Bestätigen Sie Ihre E-Mail-Adresse für Ihr Fotolio-Konto.',
};

export default function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
