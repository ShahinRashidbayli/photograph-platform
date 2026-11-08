'use client';

import { useTranslation, type TranslationKey } from '@/lib/i18n';
import { SAMPLE } from './mock';

type Step = { titleKey: TranslationKey; textKey: TranslationKey; data: string };

const GERMANY: { titleKey: TranslationKey; textKey: TranslationKey }[] = [
  { titleKey: 'landing.de.dsgvoTitle', textKey: 'landing.de.dsgvoText' },
  { titleKey: 'landing.de.gobdTitle', textKey: 'landing.de.gobdText' },
  { titleKey: 'landing.de.smallBusinessTitle', textKey: 'landing.de.smallBusinessText' },
  { titleKey: 'landing.de.languagesTitle', textKey: 'landing.de.languagesText' },
];

/** The five steps every booking moves through, in order — the line is the sequence. */
export function Workflow() {
  const { t, format } = useTranslation();

  const steps: Step[] = [
    {
      titleKey: 'landing.flow.enquiryTitle',
      textKey: 'landing.flow.enquiryText',
      data: t('landing.flow.enquiryData'),
    },
    {
      titleKey: 'landing.flow.bookingTitle',
      textKey: 'landing.flow.bookingText',
      data: t('landing.flow.bookingData', { date: format.dateTime(SAMPLE.shootAt) }),
    },
    {
      titleKey: 'landing.flow.contractTitle',
      textKey: 'landing.flow.contractText',
      data: t('landing.flow.contractData', { date: format.dayMonth(SAMPLE.contractSigned) }),
    },
    {
      titleKey: 'landing.flow.paymentTitle',
      textKey: 'landing.flow.paymentText',
      data: t('landing.flow.paymentData', { amount: format.eur(SAMPLE.depositCents) }),
    },
    {
      titleKey: 'landing.flow.galleryTitle',
      textKey: 'landing.flow.galleryText',
      // Delivered, like the hero card says: the page tells one booking, finished.
      data: t('landing.flow.galleryData', { count: format.number(SAMPLE.galleryPhotos) }),
    },
  ];

  return (
    <section id="workflow" className="lp-section" aria-labelledby="lp-flow-title">
      <div className="lp-wrap">
        <h2 id="lp-flow-title" className="lp-h2" style={{ maxWidth: 720 }}>
          {t('landing.flow.title')}
        </h2>
        <ol className="lp-flow">
          {steps.map((s) => (
            <li key={s.titleKey}>
              <span className="lp-flow-dot" aria-hidden="true" />
              <h3>{t(s.titleKey)}</h3>
              <p>{t(s.textKey)}</p>
              <span className="lp-mono">{s.data}</span>
            </li>
          ))}
        </ol>

        <div className="lp-germany">
          <h3>{t('landing.de.title')}</h3>
          <dl>
            {GERMANY.map((g) => (
              <div key={g.titleKey}>
                <dt>{t(g.titleKey)}</dt>
                <dd>{t(g.textKey)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
