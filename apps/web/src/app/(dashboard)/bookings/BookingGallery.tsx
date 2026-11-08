'use client';

import React from 'react';
import Link from 'next/link';
import type { Gallery } from '@/hooks/useGalleries';
import { useTranslation } from '@/lib/i18n';
import type { getDetailStyles } from './bookingDetail.styles';

/**
 * The delivery gallery made for this booking, or what to do about not having
 * one yet. The galleries route owns creating and managing them; this says
 * where the booking stands and links there.
 */
export function BookingGallery({
  gallery,
  shootDone,
  subdomain,
  s,
}: {
  gallery: Gallery | null;
  shootDone: boolean;
  /** The studio's subdomain, for the client's own link. */
  subdomain: string | null;
  s: ReturnType<typeof getDetailStyles>;
}) {
  const { t, tPlural, format } = useTranslation();

  if (!gallery) {
    return (
      <section aria-labelledby="bk-gallery-title">
        <h3 id="bk-gallery-title" style={{ ...s.h3, marginBottom: 12 }}>
          {t('bookings.gallery.title')}
        </h3>
        <p style={s.bodyStrong}>{t('bookings.gallery.none')}</p>
        <p style={{ ...s.body, marginTop: 4 }}>
          {shootDone ? t('bookings.gallery.noneAfter') : t('bookings.gallery.noneBefore')}
        </p>
        {shootDone && (
          <Link href="/galleries" style={{ ...s.textLink, marginTop: 12 }}>
            {t('bookings.action.createGallery')}
            <ArrowIcon />
          </Link>
        )}
      </section>
    );
  }

  const status =
    gallery.expiryState === 'PURGED'
      ? t('bookings.gallery.purged')
      : gallery.expiryState === 'EXPIRED'
        ? t('bookings.gallery.expired')
        : gallery.expiresAt
          ? t('bookings.gallery.onlineUntil', { date: format.dayMonthYearLong(gallery.expiresAt) })
          : null;

  return (
    <section aria-labelledby="bk-gallery-title">
      <h3 id="bk-gallery-title" style={{ ...s.h3, marginBottom: 12 }}>
        {t('bookings.gallery.title')}
      </h3>
      <p style={s.bodyStrong}>{tPlural('bookings.progress.photos', gallery.photoCount)}</p>
      {status && <p style={{ ...s.body, marginTop: 4 }}>{status}</p>}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12 }}>
        {subdomain && gallery.expiryState === 'ACTIVE' && (
          <a
            href={`/g/${subdomain}/${gallery.accessToken}`}
            target="_blank"
            rel="noopener noreferrer"
            style={s.textLink}
          >
            {t('bookings.gallery.viewAsClient')}
            <ExternalIcon />
          </a>
        )}
        <Link href="/galleries" style={s.textLink}>
          {t('bookings.gallery.manage')}
          <ArrowIcon />
        </Link>
      </div>
    </section>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}
