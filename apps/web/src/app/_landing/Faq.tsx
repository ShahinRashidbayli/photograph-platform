'use client';

import { useTranslation, type TranslationKey } from '@/lib/i18n';

/**
 * The questions a German photographer asks before signing up. Every answer is
 * something the code does today (see the comment over the keys in the English
 * dictionary); hosting location and the AVV are left out until the operator
 * has settled them, rather than answered vaguely.
 */
const QUESTIONS: { q: TranslationKey; a: TranslationKey }[] = [
  { q: 'landing.faq.trialQ', a: 'landing.faq.trialA' },
  { q: 'landing.faq.cancelQ', a: 'landing.faq.cancelA' },
  { q: 'landing.faq.accountQ', a: 'landing.faq.accountA' },
  { q: 'landing.faq.expiryQ', a: 'landing.faq.expiryA' },
  { q: 'landing.faq.smallBusinessQ', a: 'landing.faq.smallBusinessA' },
];

/** Native `<details>`: keyboard, screen readers and find-in-page work without JS. */
export function Faq() {
  const { t } = useTranslation();
  return (
    <section id="faq" className="lp-section" aria-labelledby="lp-faq-title">
      <div className="lp-wrap lp-faq">
        <h2 id="lp-faq-title" className="lp-h2">
          {t('landing.faq.title')}
        </h2>
        <div className="lp-faq-list">
          {QUESTIONS.map(({ q, a }) => (
            <details key={q}>
              <summary>{t(q)}</summary>
              <p>{t(a)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
