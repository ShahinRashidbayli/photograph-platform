import { Cormorant_Garamond, Host_Grotesk, JetBrains_Mono } from 'next/font/google';

/**
 * The marketing page's own faces, loaded only on the route that imports them.
 *
 * The app keeps Geist (root layout); declaring these there would put three more
 * font files on every dashboard request for a page most sessions never open.
 *
 * - Host Grotesk: the page's voice — a neo-grotesk, calm and exact.
 * - JetBrains Mono: data only (dates, amounts, invoice numbers), never labels.
 * - Cormorant Garamond: the photographer's own pages as pictured on this one
 *   (the studio name on the booking page, the gallery cover title) and the
 *   hero's one accent word, because that is the register those pages are set in.
 */
export const lpSans = Host_Grotesk({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-lp',
});

export const lpMono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-lp-mono',
});

export const lpDisplay = Cormorant_Garamond({
  subsets: ['latin', 'latin-ext'],
  weight: ['500'],
  display: 'swap',
  variable: '--font-lp-display',
});

export const lpFontClasses = `${lpSans.variable} ${lpMono.variable} ${lpDisplay.variable}`;
