import type { Metadata } from 'next';
import 'bootstrap/dist/css/bootstrap.min.css';

export const metadata: Metadata = {
  title: 'Fotolio',
  description: 'Fotolio is a booking and client workflow platform for photographers.',
  icons: {
    icon: [
      { url: '/brand/fotolio-icon.svg', type: 'image/svg+xml', media: '(prefers-color-scheme: light)' },
      { url: '/brand/fotolio-icon-dark.svg', type: 'image/svg+xml', media: '(prefers-color-scheme: dark)' },
    ],
    shortcut: '/brand/fotolio-icon.svg',
    apple: '/brand/fotolio-icon.svg',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
