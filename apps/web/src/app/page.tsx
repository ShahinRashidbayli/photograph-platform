import type { Metadata } from 'next';
import LandingPage from './LandingPage';

/**
 * The public marketing page.
 *
 * <p>A server component whose only job is to carry {@link metadata}. The page
 * itself is a client component (theme store, language toggle, pricing switch,
 * scroll reveal) and a client component cannot export `metadata` — so for as
 * long as the two lived in one file, the landing page inherited the root
 * layout's generic `title: 'Fotolio'` and had no Open Graph tags at all.
 * Pasting the URL into WhatsApp, Slack or LinkedIn produced a bare link with
 * no title, no description and no image, on the one page whose entire job is
 * to convert a visitor who arrived from a shared link.
 */

const TITLE = 'Fotolio — Bookings, clients and galleries for photographers';
const DESCRIPTION =
  'Leads, bookings and private client galleries in one workspace. Built for photographers in Germany — bilingual DE / EN and DSGVO-konform. 14-day free trial, no credit card.';

// Absolute URLs are required for og:image, and Next needs a base to build them
// from. Falls back to the production host so a preview deploy without the env
// var still emits valid tags rather than dropping the image entirely.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://fotolio.de';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Fotolio',
    title: TITLE,
    description: DESCRIPTION,
    // `de_DE` is the primary market; the page itself is bilingual and switches
    // on a client-side toggle, so both are declared rather than one guessed.
    locale: 'de_DE',
    alternateLocale: ['en_US'],
    // No `images` here on purpose: `opengraph-image.tsx` next to this file
    // supplies them, and Next fills in the absolute URL and the dimensions.
    // Listing a path by hand is how the tag ended up pointing at a file that
    // was never committed.
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function Page() {
  return <LandingPage />;
}
