import type { Metadata } from 'next';
import { Cormorant_Garamond, Inter } from 'next/font/google';
import './globals.css';

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

// Runs before first paint so the page background matches the persisted theme
// instead of flashing the light default while the client store rehydrates from
// localStorage. Kept tiny and dependency-free because it's inlined into <head>.
const THEME_INIT = `(function(){try{var r=localStorage.getItem('theme-storage');if(!r)return;var t=JSON.parse(r);var m=t&&t.state&&t.state.theme;var el=document.documentElement;if(m==='dark'){el.style.backgroundColor='#0A0A0C';el.style.colorScheme='dark';}else{el.style.backgroundColor='#F7F8FB';el.style.colorScheme='light';}}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${cormorant.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className={inter.className} suppressHydrationWarning>{children}</body>
    </html>
  );
}
