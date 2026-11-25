'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { useTranslation, type TranslationKey } from '@/lib/i18n';
import { useThemeStore } from '@/store/themeStore';
import { SAMPLE } from './mock';
import { STOCK, STOCK_THUMB } from './stock';
import { FACTS } from './FormatsBand';

/** Delay between the result card's steps arriving, once, on load. */
const STEP_GAP_MS = 450;

/**
 * The hero pictures the studio's own booking page — what a photographer's
 * client sees — with one booking's result beside it.
 *
 * It used to picture the photographer's dashboard: a sidebar, a revenue
 * chart, four euro amounts and a table of status chips. That read as
 * accounting software. The booking page is the first thing the product does
 * for a studio (Starter's "your own booking website"), and it is where a
 * photograph belongs. Its fields are the real form's (`r/[subdomain]/
 * RequestForm.tsx`, embedded on `p/[subdomain]`), shown filled in, and its
 * labels are that form's own `request.*` keys, so the picture cannot drift
 * from the page it pictures.
 *
 * The result card's steps arrive one by one, once, and stay. It used to loop
 * (clear, refill, forever) behind a pause button; played once, the motion is
 * over in under two seconds (below WCAG 2.2.2's five), and it is pure CSS: the
 * steps are in the server HTML, and under reduced motion the animation is
 * simply not applied.
 *
 * The room follows the theme: a daylight photograph under a paper wash in
 * light mode (on a phone, an unwashed band above the headline), the night
 * photograph under charcoal in dark. Each photograph suits its own ground —
 * the sparks washed with paper went grey, the field under charcoal went muddy.
 * The ground, type and buttons switch in the stylesheet (`data-tone`); only
 * the photograph is picked here.
 */
export function Hero() {
  const { t, format } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const room = theme === 'light' ? STOCK.field : STOCK.sparks;

  const cardSteps = [
    { label: t('landing.hero.stepEnquiry'), value: t('landing.flow.enquiryData') },
    {
      label: t('landing.hero.stepContract'),
      value: `✓ ${format.dayMonth(SAMPLE.contractSigned)}`,
    },
    { label: t('landing.hero.stepDeposit'), value: `✓ ${t('landing.hero.depositReceived')}` },
    {
      label: t('landing.hero.stepGallery'),
      value: t('landing.mock.photos', { count: format.number(SAMPLE.galleryPhotos) }),
    },
  ];

  const fields: { labelKey: TranslationKey; value: string; wide?: boolean; select?: boolean }[] = [
    { labelKey: 'request.name', value: 'Lena Hoffmann' },
    { labelKey: 'request.email', value: 'lena@example.com' },
    { labelKey: 'request.date', value: format.dayMonthYearLong(SAMPLE.weddingDate) },
    { labelKey: 'request.type', value: t('leadEvent.WEDDING'), select: true },
    { labelKey: 'request.message', value: t('landing.book.messageValue'), wide: true },
  ];

  return (
    <section className="lp-hero-band" data-tone="theme" aria-labelledby="lp-hero-title">
      {/* The photograph is the room's light; the scrim keeps the words on
          solid ground and lets the photograph show to the right. */}
      <Image src={room.src} alt="" fill priority sizes="100vw" className="lp-hero-photo" />
      <div className="lp-hero-scrim" aria-hidden="true" />
      {theme === 'light' && (
        <div className="lp-hero-strip" aria-hidden="true">
          <Image src={room.src} alt="" fill sizes="100vw" />
        </div>
      )}
      <div className="lp-wrap lp-hero">
        <div className="lp-hero-copy">
          <h1 id="lp-hero-title" className="lp-h1">
            {t('landing.hero.title1')}
            <br />
            {t('landing.hero.title2pre')}
            <em className="lp-accent-word">{t('landing.hero.title2accent')}</em>.
          </h1>
          <p className="lp-lede">{t('landing.hero.lede')}</p>
          <div className="lp-actions">
            <Link href="/register" className="lp-btn lp-btn-inverse">
              {t('landing.hero.ctaPrimary')}
            </Link>
            <a href="#product" className="lp-btn lp-btn-ghost-dark">
              {t('landing.hero.ctaSecondary')}
              <Icon name="arrow-right" size={16} strokeWidth={2} />
            </a>
          </div>
          {/* The plan's facts where the decision is made, not a screen further
            down. Properties of the product, never counts of customers. */}
          <dl className="lp-hero-facts">
            {FACTS.map((f) => (
              <div key={f.labelKey}>
                <dt>{t(f.labelKey)}</dt>
                <dd>{t(f.valueKey)}</dd>
              </div>
            ))}
          </dl>
        </div>

        <figure className="lp-art" aria-label={t('landing.hero.artAria')}>
          <div className="lp-site lp-ui" aria-hidden="true">
            <div className="lp-browser-bar">
              <span className="lp-browser-dot" />
              <span className="lp-browser-dot" />
              <span className="lp-browser-dot" />
              <span className="lp-browser-url">studio-berg.fotolio.app</span>
            </div>
            <div className="lp-site-cover">
              <Image
                src={STOCK.embrace.src}
                alt=""
                fill
                sizes="(max-width: 860px) 100vw, 620px"
                className="lp-site-cover-img"
              />
              <p className="lp-site-name">Studio Berg</p>
              <p className="lp-site-tagline">{t('landing.book.tagline')}</p>
            </div>
            <div className="lp-site-form">
              <div className="lp-site-title">{t('request.title')}</div>
              <div className="lp-site-grid">
                {fields.map((f) => (
                  <div key={f.labelKey} className={f.wide ? 'lp-site-wide' : undefined}>
                    <span className="lp-site-label">{t(f.labelKey)}</span>
                    <span className="lp-site-input" data-select={f.select || undefined}>
                      {f.value}
                    </span>
                  </div>
                ))}
              </div>
              <span className="lp-site-send">{t('request.send')}</span>
            </div>
          </div>

          {/* What came of that one request, on the photographer's side. */}
          <div className="lp-art-card lp-ui">
            <div className="lp-art-card-head">
              <Image src={STOCK_THUMB} alt="" width={44} height={44} className="lp-art-thumb" />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>Lena &amp; Kaan</div>
                <div className="lp-ui-muted" style={{ fontSize: '0.8rem' }}>
                  {t('landing.mock.type.wedding')} · {format.dayMonth(SAMPLE.weddingDate)}
                </div>
              </div>
            </div>
            <ul className="lp-art-steps">
              {cardSteps.map((s, i) => (
                <li
                  key={s.label}
                  className="lp-step-in"
                  style={{ animationDelay: `${400 + i * STEP_GAP_MS}ms` }}
                >
                  <span>{s.label}</span>
                  <span className="lp-mono">{s.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </figure>
      </div>
    </section>
  );
}
