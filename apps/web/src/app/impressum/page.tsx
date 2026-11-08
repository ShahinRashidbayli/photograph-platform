import type { Metadata } from 'next';
import { LegalPageShell } from '@/components/legal/LegalPageShell';
import { IMPRESSUM, type LegalDoc } from '@/lib/legal-content';
import { stockCredits } from '../_landing/stock';

export const metadata: Metadata = {
  title: 'Impressum · Fotolio',
  description: 'Anbieterkennzeichnung gemäß § 5 DDG.',
};

/**
 * The photo credits for the landing page's stand-in photographs live here,
 * not in its footer. Most are CC BY / BY-SA, which require author, licence and
 * source to be named — the Impressum, linked from every page, is the usual
 * place for that in Germany, and it keeps a line of photographer names and
 * URLs off the marketing page. Derived from `_landing/stock.ts`, so a photo
 * added there is credited without anyone remembering to.
 */
const IMPRESSUM_WITH_CREDITS: LegalDoc = {
  ...IMPRESSUM,
  sections: [
    ...IMPRESSUM.sections,
    {
      heading: 'Bildnachweise',
      blocks: [
        { type: 'p', text: 'Fotos auf der Startseite (Urheber · Lizenz · Quelle):' },
        {
          type: 'list',
          items: stockCredits().map((c) => `${c.by} · ${c.licence} · ${c.source}`),
        },
      ],
    },
  ],
};

export default function ImpressumPage() {
  return <LegalPageShell doc={IMPRESSUM_WITH_CREDITS} />;
}
