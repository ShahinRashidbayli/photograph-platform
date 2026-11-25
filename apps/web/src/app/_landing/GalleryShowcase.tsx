'use client';

import Image from 'next/image';
import { useTranslation, type TranslationKey } from '@/lib/i18n';
import { SAMPLE } from './mock';
import { STOCK, type StockPhoto } from './stock';

/** Alt text goes through the dictionaries: a screen reader on the German page reads German. */
const GRID: { photo: StockPhoto; altKey: TranslationKey }[] = [
  { photo: STOCK.rings, altKey: 'landing.gallery.alt.rings' },
  { photo: STOCK.brideBouquet, altKey: 'landing.gallery.alt.brideBouquet' },
  { photo: STOCK.dress, altKey: 'landing.gallery.alt.dress' },
  { photo: STOCK.shoes, altKey: 'landing.gallery.alt.shoes' },
  { photo: STOCK.bouquet, altKey: 'landing.gallery.alt.bouquet' },
  { photo: STOCK.veil, altKey: 'landing.gallery.alt.veil' },
  { photo: STOCK.steps, altKey: 'landing.gallery.alt.steps' },
  { photo: STOCK.forest, altKey: 'landing.gallery.alt.forest' },
];

/**
 * The client's side of the product: their gallery page as they open it. Built
 * to show only what the gallery really does — a private link, the cover, the
 * expiry and downloads one by one or as a ZIP. No favourites, sharing or
 * comments: the product has none of them, and a picture of a heart button is
 * a promise.
 */
export function GalleryShowcase() {
  const { t, format } = useTranslation();

  return (
    <section
      id="galleries"
      className="lp-section lp-band"
      data-tone="theme"
      aria-labelledby="lp-gallery-title"
    >
      <div className="lp-wrap">
        <div className="lp-head-row">
          <h2 id="lp-gallery-title" className="lp-h2" style={{ maxWidth: 640 }}>
            {t('landing.gallery.title')}
          </h2>
          <p className="lp-lede" style={{ margin: 0, maxWidth: 420, fontSize: '1.1rem' }}>
            {t('landing.gallery.lede')}
          </p>
        </div>

        <figure
          className="lp-gallery"
          aria-label={t('landing.gallery.aria')}
          style={{ marginInline: 0, marginBottom: 0 }}
        >
          <div className="lp-browser-bar" aria-hidden="true">
            <span className="lp-browser-dot" />
            <span className="lp-browser-dot" />
            <span className="lp-browser-dot" />
            <span className="lp-browser-url">studio-berg.fotolio.app/g/lena-kaan</span>
          </div>
          <div className="lp-cover">
            <Image
              src={STOCK.field.src}
              alt=""
              fill
              sizes="(max-width: 1440px) 100vw, 1312px"
              className="lp-cover-img"
            />
            <p className="lp-cover-title">{t('landing.gallery.coverTitle')}</p>
            <p className="lp-cover-byline">
              {t('landing.gallery.byline')}&nbsp;&nbsp;|&nbsp;&nbsp;<u>studio-berg.fotolio.app</u>
            </p>
          </div>
          <div className="lp-gallery-body">
            <div className="lp-gallery-toolbar">
              <span className="lp-num">
                {t('landing.gallery.meta', {
                  count: format.number(SAMPLE.galleryPhotos),
                  date: format.dayMonthYearLong(SAMPLE.galleryOnlineUntil),
                })}
              </span>
              <span className="lp-gallery-download" aria-hidden="true">
                {t('landing.gallery.downloadAll')}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </div>
            <ul className="lp-gallery-grid">
              {GRID.map(({ photo, altKey }) => (
                <li key={photo.src}>
                  <Image
                    src={photo.src}
                    alt={t(altKey)}
                    fill
                    sizes="(max-width: 860px) 50vw, 320px"
                  />
                </li>
              ))}
            </ul>
          </div>
        </figure>

        <ul className="lp-points">
          <li>
            <b>{t('landing.gallery.linkTitle')}</b>
            <span>{t('landing.gallery.linkText')}</span>
          </li>
          <li>
            <b>{t('landing.gallery.zipTitle')}</b>
            <span>{t('landing.gallery.zipText')}</span>
          </li>
          <li>
            <b>{t('landing.gallery.retentionTitle')}</b>
            <span className="lp-num">{t('landing.gallery.retentionText')}</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
