'use client';

import React from 'react';
import { useTranslation } from '@/lib/i18n';

/**
 * The tombstone a client sees when their gallery has passed its retention
 * window (ADR-001 §5).
 *
 * <p>Deliberately not a 404. The URL carries a 64-character capability token,
 * so whoever reaches this page already held the private link — explaining what
 * happened leaks nothing, while a "page not found" reads as a broken link and
 * turns into a support ticket for the photographer instead of a request to
 * restore the gallery.
 */
export default function ExpiredGalleryNotice({
  photographerName,
  expiresAt,
}: {
  photographerName: string;
  expiresAt: string | null;
}) {
  const { t, format } = useTranslation();

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
        background: '#F8FAFC',
        color: '#0F172A',
      }}
    >
      <div style={{ maxWidth: '520px', textAlign: 'center' }}>
        <div aria-hidden="true" style={{ fontSize: '40px', marginBottom: '16px' }}>
          🗓️
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 12px' }}>
          {t('gallery.expired.title')}
        </h1>
        <p style={{ fontSize: '0.98rem', lineHeight: 1.65, color: '#475569', margin: '0 0 12px' }}>
          {expiresAt
            ? t('gallery.expired.body', { date: format.dayMonthYearLong(expiresAt) })
            : t('gallery.expired.bodyNoDate')}
        </p>
        <p style={{ fontSize: '0.98rem', lineHeight: 1.65, color: '#475569', margin: '0 0 24px' }}>
          {t('gallery.expired.contact', { photographer: photographerName })}
        </p>
        <p
          style={{
            fontSize: '0.82rem',
            lineHeight: 1.55,
            color: '#94A3B8',
            borderTop: '1px solid #E2E8F0',
            paddingTop: '16px',
            margin: 0,
          }}
        >
          {t('gallery.expired.note')}
        </p>
      </div>
    </main>
  );
}
