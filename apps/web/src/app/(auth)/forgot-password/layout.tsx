import type { Metadata } from 'next';

// Titles live in a layout because the page itself is a client component, and
// `metadata` is only read from server components. See `(auth)/layout.tsx` for
// why these are in German.
export const metadata: Metadata = {
  title: 'Passwort zurücksetzen · Fotolio',
  description: 'Fordern Sie einen Link an, um ein neues Passwort zu wählen.',
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
