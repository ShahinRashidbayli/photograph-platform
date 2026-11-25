'use client';

import Image from 'next/image';
import { useTranslation, type TranslationKey } from '@/lib/i18n';
import { STOCK, type StockPhoto } from './stock';

/** `focus` is the crop's anchor where the subject is off-centre in a square tile. */
const FORMATS: { labelKey: TranslationKey; photo: StockPhoto; focus?: string }[] = [
  { labelKey: 'landing.formats.wedding', photo: STOCK.wedding },
  { labelKey: 'landing.formats.portrait', photo: STOCK.portrait },
  { labelKey: 'landing.formats.family', photo: STOCK.family },
  { labelKey: 'landing.formats.newborn', photo: STOCK.newborn },
  { labelKey: 'landing.formats.business', photo: STOCK.business, focus: 'center 25%' },
  { labelKey: 'landing.formats.couples', photo: STOCK.couples },
  { labelKey: 'landing.formats.event', photo: STOCK.event },
  { labelKey: 'landing.formats.reportage', photo: STOCK.reportage, focus: '20% center' },
];

/**
 * Facts, not marketing figures: each number is a property of the product or a
 * plan (docs/PRICING.md), never a count of customers or bookings. Shown in the
 * hero, under its buttons.
 */
export const FACTS: { valueKey: TranslationKey; labelKey: TranslationKey }[] = [
  { valueKey: 'landing.facts.trialValue', labelKey: 'landing.facts.trial' },
  { valueKey: 'landing.facts.feeValue', labelKey: 'landing.facts.fee' },
  { valueKey: 'landing.facts.retentionValue', labelKey: 'landing.facts.retention' },
  { valueKey: 'landing.facts.invoicesValue', labelKey: 'landing.facts.invoices' },
];

/**
 * The band under the hero — light in light mode, dark in dark: the kinds of
 * shoot the studio runs, each as a photograph. It was a sideways-scrolling list
 * of words, which needed a pause button and still said nothing a photographer
 * could see. The pictures are decorative (`alt=""`) because the caption under
 * each one is the content.
 */
export function FormatsBand() {
  const { t } = useTranslation();

  return (
    <section
      className="lp-dark lp-section lp-formats"
      data-tone="theme"
      aria-labelledby="lp-formats-title"
    >
      <div className="lp-wrap">
        <h2 id="lp-formats-title" className="lp-h2" style={{ maxWidth: 640 }}>
          {t('landing.formats.title')}
        </h2>
        <ul className="lp-formats-grid">
          {FORMATS.map(({ labelKey, photo, focus }) => (
            <li key={labelKey}>
              <div className="lp-formats-frame">
                <Image
                  src={photo.src}
                  alt=""
                  fill
                  sizes="(max-width: 860px) 50vw, 320px"
                  style={focus ? { objectPosition: focus } : undefined}
                />
              </div>
              <span>{t(labelKey)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
