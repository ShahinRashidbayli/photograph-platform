'use client';

import React, { useState } from 'react';
import type { PublicGalleryPayload, DeliveryPhoto } from './page';

/**
 * Client-facing gallery viewer. Deliberately self-contained and light-themed —
 * it renders outside the dashboard shell for a recipient who may not have an
 * account. A lightbox opens on click; downloads are offered only when the
 * photographer left downloads enabled.
 */
export default function GalleryView({ data }: { data: PublicGalleryPayload }) {
  const [active, setActive] = useState<DeliveryPhoto | null>(null);

  const shot = data.shootDate
    ? new Date(data.shootDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.kicker}>{data.photographerName}</div>
        <h1 style={styles.title}>{data.bookingName || 'Your gallery'}</h1>
        <p style={styles.meta}>
          {[data.eventType, shot].filter(Boolean).join(' · ')}
          {data.photos.length > 0 && ` · ${data.photos.length} photo${data.photos.length === 1 ? '' : 's'}`}
        </p>
      </header>

      {data.photos.length === 0 ? (
        <div style={styles.empty}>
          <p>The photographer hasn’t added photos to this gallery yet.</p>
          <p style={styles.emptySub}>Check back soon.</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {data.photos.map((photo) => (
            <figure key={photo.id} style={styles.cell}>
              <button style={styles.cellBtn} onClick={() => setActive(photo)} aria-label="Open photo">
                {photo.thumbnailUrl || photo.viewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.thumbnailUrl || photo.viewUrl || ''}
                    alt={photo.originalFilename || 'Gallery photo'}
                    style={styles.img}
                    loading="lazy"
                  />
                ) : (
                  <div style={styles.imgFallback}>Preview unavailable</div>
                )}
              </button>
              {data.downloadEnabled && photo.viewUrl && (
                <a href={photo.viewUrl} download={photo.originalFilename ?? undefined} style={styles.download}>
                  Download
                </a>
              )}
            </figure>
          ))}
        </div>
      )}

      <footer style={styles.footer}>
        Delivered with <strong>Fotolio</strong>
      </footer>

      {active && (
        <div style={styles.lightbox} onClick={() => setActive(null)}>
          <button style={styles.close} onClick={() => setActive(null)} aria-label="Close">×</button>
          {active.viewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={active.viewUrl} alt={active.originalFilename || 'Gallery photo'} style={styles.lightboxImg} onClick={(e) => e.stopPropagation()} />
          ) : (
            <div style={{ color: '#fff' }}>Preview unavailable</div>
          )}
          {data.downloadEnabled && active.viewUrl && (
            <a
              href={active.viewUrl}
              download={active.originalFilename ?? undefined}
              style={styles.lightboxDownload}
              onClick={(e) => e.stopPropagation()}
            >
              Download
            </a>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#0f0f12',
    color: '#f4f4f5',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: '0 0 60px',
  },
  header: { textAlign: 'center', padding: '64px 24px 40px', maxWidth: 760, margin: '0 auto' },
  kicker: { fontSize: '0.8rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#a1a1aa', marginBottom: 12 },
  title: { fontSize: '2.2rem', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 },
  meta: { fontSize: '0.95rem', color: '#a1a1aa', marginTop: 10 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: 14,
    padding: '0 24px',
    maxWidth: 1400,
    margin: '0 auto',
  },
  cell: { margin: 0, position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#1c1c22' },
  cellBtn: { display: 'block', width: '100%', border: 'none', padding: 0, background: 'none', cursor: 'pointer' },
  img: { width: '100%', height: 260, objectFit: 'cover', display: 'block' },
  imgFallback: { width: '100%', height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717a', fontSize: '0.85rem' },
  download: {
    position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.65)', color: '#fff',
    fontSize: '0.78rem', fontWeight: 600, padding: '6px 12px', borderRadius: 8, textDecoration: 'none', backdropFilter: 'blur(4px)',
  },
  empty: { textAlign: 'center', color: '#a1a1aa', padding: '80px 24px' },
  emptySub: { fontSize: '0.85rem', color: '#71717a', marginTop: 6 },
  footer: { textAlign: 'center', color: '#71717a', fontSize: '0.82rem', marginTop: 50 },
  lightbox: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24, flexDirection: 'column', gap: 16,
  },
  lightboxImg: { maxWidth: '92vw', maxHeight: '82vh', objectFit: 'contain', borderRadius: 8 },
  close: { position: 'absolute', top: 20, right: 28, background: 'none', border: 'none', color: '#fff', fontSize: '2.4rem', cursor: 'pointer', lineHeight: 1 },
  lightboxDownload: { background: '#fff', color: '#0f0f12', fontWeight: 600, fontSize: '0.85rem', padding: '9px 18px', borderRadius: 8, textDecoration: 'none' },
};
