import type { Metadata } from 'next';
import { Cormorant_Garamond, Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-cormorant',
});

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
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${cormorant.variable}`}>
      <body className={inter.className} suppressHydrationWarning>{children}</body>
    </html>
  );
}
