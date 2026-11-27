import type { Metadata } from 'next';
import { Geist, Instrument_Serif } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/components/QueryProvider';
import { HtmlLangSync } from '@/components/HtmlLangSync';
import { ThemeSync } from '@/components/ThemeSync';
import { DEFAULT_LOCALE } from '@/lib/i18n/config';

// One working sans for every label, figure and paragraph, and one editorial
// serif kept for page titles and the marketing headlines. Geist's figures are
// tabular-capable and its German umlauts sit inside the cap height, which
// matters on a screen of "Übersicht", "Verträge" and euro amounts. The serif
// is the studio's voice — a photo-book title, not a UI face — so it never
// appears in a button, a label or a number.
const sans = Geist({ subsets: ['latin', 'latin-ext'], display: 'swap', variable: '--font-sans' });
const serif = Instrument_Serif({
  subsets: ['latin', 'latin-ext'],
  weight: ['400'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-serif',
});

export const metadata: Metadata = {
  title: 'Fotolio',
  description: 'Fotolio is a booking and client workflow platform for photographers.',
  icons: {
    icon: [
      {
        url: '/brand/fotolio-icon.svg',
        type: 'image/svg+xml',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/brand/fotolio-icon-dark.svg',
        type: 'image/svg+xml',
        media: '(prefers-color-scheme: dark)',
      },
    ],
    shortcut: '/brand/fotolio-icon.svg',
    apple: '/brand/fotolio-icon.svg',
  },
};

// Runs before first paint so the page background matches the theme instead of
// flashing the light default while the client store rehydrates from
// localStorage. The theme is the persisted explicit choice, or without one the
// system setting — the rule `store/themeStore.ts` applies after hydration.
// Kept tiny and dependency-free because it's inlined into <head>.
//
// It also corrects <html lang> for the persisted language: the markup ships the
// source locale (this is a server component and localStorage is client-only),
// and assistive tech reads the attribute early, so fixing it here rather than
// in an effect avoids a window where German copy is announced as English.
//
// And it marks the document `data-js`, which is what gates every "hidden until
// revealed" starting state — the landing page's scroll-reveal is the only one
// today. Those rules must not apply when scripts do not run, or a
// server-rendered page is delivered complete and then painted blank; setting
// the flag here rather than from an effect means it is on the element before
// the first paint, so nothing flashes in and back out. It is the first
// statement in the function because the `try` below it must not be able to
// skip it.
//
// An attribute rather than a class, for two reasons: React owns `<html
// class>` (the font variables below) and may drop a script-added class when it
// reconciles that attribute on hydration, and `html.js …` would outrank the
// `.in` rule the observer relies on — see the note in globals.css.
const CLIENT_INIT = `(function(){document.documentElement.setAttribute('data-js','');try{var el=document.documentElement;var m=null;try{var r=localStorage.getItem('theme-storage');var t=r&&JSON.parse(r);m=t&&t.state&&t.state.theme;}catch(e){}if(m!=='dark'&&m!=='light'){m=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(m==='dark'){el.style.backgroundColor='#0E0E0D';el.style.colorScheme='dark';el.setAttribute('data-theme','dark');}else{el.style.backgroundColor='#FAFAF9';el.style.colorScheme='light';el.setAttribute('data-theme','light');}var l=localStorage.getItem('lang-storage');if(l){var p=JSON.parse(l);var g=p&&p.state&&p.state.lang;if(g){document.documentElement.lang=g;}}}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang={DEFAULT_LOCALE}
      suppressHydrationWarning
      className={`${sans.variable} ${serif.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: CLIENT_INIT }} />
      </head>
      <body className={sans.className} suppressHydrationWarning>
        <HtmlLangSync />
        <ThemeSync />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
