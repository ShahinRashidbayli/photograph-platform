'use client';

import { useTranslation } from '@/lib/i18n';
import { Closing } from './_landing/Closing';
import { Faq } from './_landing/Faq';
import { FormatsBand } from './_landing/FormatsBand';
import { lpFontClasses } from './_landing/fonts';
import { GalleryShowcase } from './_landing/GalleryShowcase';
import { Hero } from './_landing/Hero';
import { Nav } from './_landing/Nav';
import { Pricing } from './_landing/Pricing';
import { ProductTabs } from './_landing/ProductTabs';
import { Workflow } from './_landing/Workflow';

/**
 * The public marketing page.
 *
 * One idea per section, in the order a photographer asks: what is it (hero),
 * who is it for (formats), what does it look like (product tabs), what do my
 * clients get (gallery), how does a shoot move (workflow), what does it cost
 * (pricing), what else they would ask first (FAQ), then the last ask and the
 * links.
 *
 * No announcement strip above the bar: it was the loudest thing on the page
 * and carried changelog news for existing users, not a reason to sign up.
 *
 * Claims are pinned in `landing.claims.test.tsx`: anything marked "soon" in
 * docs/PRICING.md keeps its badge, and nothing the product does not do (client
 * favourites, for one) is pictured or promised.
 */
export default function LandingPage() {
  const { t } = useTranslation();
  return (
    <div className={`lp-root ${lpFontClasses}`}>
      <a href="#main" className="lp-skip">
        {t('landing.aria.skip')}
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <FormatsBand />
        <ProductTabs />
        <GalleryShowcase />
        <Workflow />
        <Pricing />
        <Faq />
      </main>
      <Closing />
    </div>
  );
}
