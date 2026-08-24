import type { Metadata } from 'next';

// Titles live in a layout because the page itself is a client component, and
// `metadata` is only read from server components. See `(auth)/layout.tsx` for
// why these are in German.
export const metadata: Metadata = {
  title: 'Neues Passwort · Fotolio',
  description: 'Legen Sie ein neues Passwort für Ihr Konto fest.',
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
