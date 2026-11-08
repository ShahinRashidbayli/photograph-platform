'use client';

import React, { useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { getColors, fontSize, pageTitle, radius } from '@/lib/design-tokens';
import { startOfToday } from '@/lib/date';
import { useTranslation } from '@/lib/i18n';
import { Alert, Note } from '@/components/ui';
import { useBookings } from '@/hooks/useBookings';
import { useCustomerGalleries, type CustomerGallery } from '@/hooks/useGalleries';
import { daysUntil, galleryFor, splitShoots } from '../bookings/customer.portal';
import { getPortalStyles, linkButton } from '../bookings/customer.styles';
import { PortalIcon, useOccasion } from '../bookings/PortalParts';

const NONE: CustomerGallery[] = [];

/**
 * The client's galleries: every delivered set of photos that is still open,
 * with how long it stays open, and a place held for each shoot still ahead.
 *
 * <p>This page used to be a hard-coded English "No galleries yet" for every
 * client, delivered photos or not — there was no way for a client to list
 * their own galleries at all.
 */
export function CustomerGalleries() {
  const { t, tPlural, format } = useTranslation();
  const { theme } = useThemeStore();
  const c = useMemo(() => getColors(theme), [theme]);
  const s = getPortalStyles(c);
  const occasion = useOccasion();
  const subdomain = useAuthStore((st) => st.user?.tenant?.subdomain ?? null);

  const galleriesQ = useCustomerGalleries();
  const bookingsQ = useBookings(false);
  const galleries = galleriesQ.data ?? NONE;
  const today = startOfToday();
  // A shoot still ahead has no gallery yet; it gets a quiet placeholder so the
  // client knows where the photos will turn up.
  const upcoming = splitShoots(bookingsQ.data ?? [], today).upcoming.filter(
    (b) => galleryFor(b.id, galleries) === null
  );

  return (
    <div style={{ ...s.page, maxWidth: 1040, gap: 28 }}>
      <header style={s.headerText}>
        <h1 style={{ ...pageTitle, margin: 0 }}>{t('portal.galleries.title')}</h1>
        <p style={s.subtitle}>{t('portal.galleries.subtitle')}</p>
      </header>

      {galleriesQ.isLoading && <Note>{t('galleries.loading')}</Note>}
      {galleriesQ.isError && <Alert tone="danger">{t('portal.galleries.error')}</Alert>}

      {!galleriesQ.isLoading && !galleriesQ.isError && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 400px), 1fr))',
            gap: 24,
          }}
        >
          {galleries.length === 0 && upcoming.length === 0 && (
            <div style={s.card}>
              <p style={s.empty}>{t('portal.galleries.empty')}</p>
            </div>
          )}

          {galleries.map((g) => {
            const href = subdomain ? `/g/${subdomain}/${g.accessToken}` : null;
            const open = linkButton(c, 'primary');
            const zip = linkButton(c, 'secondary');
            const left = g.expiresAt ? daysUntil(g.expiresAt.slice(0, 10), today) : null;
            return (
              <article key={g.id} style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                {g.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a presigned R2 URL; the image optimizer stays off for these
                  <img
                    src={g.coverUrl}
                    alt=""
                    style={{ display: 'block', width: '100%', height: 260, objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    aria-hidden
                    style={{
                      height: 260,
                      background: c.surfaceAlt,
                      color: c.textSubtle,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {PortalIcon.photo}
                  </div>
                )}
                <div
                  style={{
                    padding: '18px 20px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <h2 style={{ ...s.shootTitle, margin: 0 }}>{occasion(g.eventType)}</h2>
                    <span style={s.shootMeta}>
                      {[
                        g.shootDate ? format.dayMonthYearLong(g.shootDate) : null,
                        tPlural('portal.meta.photos', g.photoCount),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                  {g.expiresAt && left !== null && (
                    <span
                      style={{
                        fontSize: fontSize.base,
                        color: left <= 14 ? c.warningText : c.textSubtle,
                      }}
                    >
                      {tPlural('portal.galleries.daysLeft', Math.max(left, 0), {
                        date: format.dayMonthYearLong(g.expiresAt),
                      })}
                    </span>
                  )}
                  {href && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={open.className}
                        style={open.style}
                      >
                        {t('portal.todo.photosAction')}
                      </a>
                      {g.downloadEnabled && subdomain && (
                        // A plain same-origin link, as on the gallery itself: the
                        // ZIP streams straight to disk instead of into the tab.
                        <a
                          href={`/api/public/galleries/${encodeURIComponent(subdomain)}/${encodeURIComponent(g.accessToken)}/download`}
                          download
                          className={zip.className}
                          style={zip.style}
                        >
                          {t('portal.galleries.downloadAll')}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}

          {upcoming.map((b) => (
            <article
              key={b.id}
              style={{
                border: `1px dashed ${c.border}`,
                borderRadius: radius.card,
                background: c.surfaceAlt,
                minHeight: 260,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                gap: 6,
              }}
            >
              <span aria-hidden style={{ color: c.textSubtle, marginBottom: 'auto' }}>
                {PortalIcon.photo}
              </span>
              <h2 style={{ ...s.h2, color: c.textMuted }}>
                {occasion(b.eventType)} · {format.dayMonthYearLong(b.eventDate)}
              </h2>
              <p style={{ ...s.rowMeta, margin: 0, fontSize: fontSize.md }}>
                {t('portal.galleries.upcoming')}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
