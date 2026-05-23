'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useThemeStore } from '@/store/themeStore';
import api from '@/lib/api';
import { getGalleriesColors, getGalleriesStyles } from './galleries.styles';

type AppColors = ReturnType<typeof getGalleriesColors>;
type AppStyles = ReturnType<typeof getGalleriesStyles>;

interface Gallery {
  id: string;
  bookingId: string;
  bookingName: string;
  eventType: string;
  shootDate: string;
  photoCount: number;
  downloadEnabled: boolean;
  watermarkEnabled: boolean;
  expiresAt: string;
  accessToken: string;
  viewCount: number;
}

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

// ─── SVG icons ────────────────────────────────────────────────────────────────
const IconEye = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconCopy = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
const IconGallery = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);
const IconClock = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);
const IconCheck = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconX = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ─── GalleryListItem ──────────────────────────────────────────────────────────
function GalleryListItem({
  gallery,
  isActive,
  onSelect,
  styles,
  colors,
}: Readonly<{ gallery: Gallery; isActive: boolean; onSelect: () => void; styles: AppStyles; colors: AppColors }>) {
  const days = daysUntil(gallery.expiresAt);
  const isExpired = days < 0;
  const isWarning = days < 7 && days >= 0;

  return (
    <button
      style={{
        ...styles.listItem,
        ...(isActive ? styles.listItemActive : {}),
      }}
      onClick={onSelect}
    >
      <div style={styles.listItemTitle}>{gallery.bookingName}</div>
      <div style={styles.listItemMeta}>
        {gallery.eventType} · {gallery.photoCount} photos
      </div>
      <div style={{ ...styles.listItemMeta, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        {isExpired ? (
          <><IconX /><span style={{ color: colors.dangerText }}>Expired</span></>
        ) : isWarning ? (
          <><IconClock /><span style={{ color: colors.warningText }}>{days} days left</span></>
        ) : (
          <><IconCheck /><span style={{ color: colors.successText }}>{days} days left</span></>
        )}
      </div>
    </button>
  );
}

// ─── GalleryDetail ────────────────────────────────────────────────────────────
function GalleryDetail({
  gallery,
  styles,
}: Readonly<{ gallery: Gallery | null; styles: AppStyles }>) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    if (!gallery) return;
    navigator.clipboard.writeText(`gallery.fotolio.app/${gallery.accessToken}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!gallery) {
    return (
      <div style={styles.emptyState}>
        <IconGallery />
        <span>Select a gallery to view</span>
      </div>
    );
  }

  const days = daysUntil(gallery.expiresAt);
  const isExpired = days < 0;
  const isWarning = days < 7 && days >= 0;

  const expiryBadgeStyle = isExpired
    ? styles.expiryExpired
    : isWarning
      ? styles.expiryWarning
      : styles.expiryActive;

  const shootDate = new Date(gallery.shootDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const expiryDate = new Date(gallery.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <>
      <div style={styles.detailHeader}>
        <div>
          <div style={styles.detailTitle}>{gallery.bookingName}</div>
          <div style={styles.detailSubtitle}>
            {gallery.eventType} · Shot on {shootDate}
          </div>
        </div>
        <div style={styles.detailActions}>
          <a
            href={`https://gallery.fotolio.app/${gallery.accessToken}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...styles.actionButton, ...styles.actionButtonPrimary, textDecoration: 'none' }}
          >
            <IconEye /> View gallery
          </a>
        </div>
      </div>

      <div style={styles.detailBody}>
        <div style={styles.statsGrid}>
          <div style={styles.statBox}>
            <div style={styles.statBoxLabel}>Photos</div>
            <div style={styles.statBoxValue}>{gallery.photoCount}</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statBoxLabel}>Views</div>
            <div style={styles.statBoxValue}>{gallery.viewCount}</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statBoxLabel}>Days left</div>
            <div style={styles.statBoxValue}>{isExpired ? '—' : days}</div>
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>Access Information</div>
          <div style={styles.infoGrid}>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Download</span>
              <span style={{ ...styles.infoValue, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                {gallery.downloadEnabled ? <><IconCheck /> Enabled</> : <><IconX /> Disabled</>}
              </span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Watermark</span>
              <span style={{ ...styles.infoValue, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                {gallery.watermarkEnabled ? <><IconCheck /> Enabled</> : <><IconX /> Disabled</>}
              </span>
            </div>
            <div style={{ ...styles.infoRow, borderBottom: 'none', paddingBottom: 0 }}>
              <span style={styles.infoLabel}>Expires</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                <span style={styles.infoValue}>{expiryDate}</span>
                <span style={{ ...styles.expiryBadge, ...expiryBadgeStyle }}>
                  {isExpired ? 'Expired' : isWarning ? `${days} days` : `${days} days`}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>Gallery Link</div>
          <div style={styles.codeBlock}>
            {`gallery.fotolio.app/${gallery.accessToken}`}
          </div>
          <button
            style={{ ...styles.actionButton, ...styles.actionButtonOutline, width: '100%', marginTop: '10px', justifyContent: 'center' }}
            onClick={copyLink}
          >
            <IconCopy /> {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── GalleriesPage ────────────────────────────────────────────────────────────
export default function GalleriesPage() {
  const { theme } = useThemeStore();
  const styles = useMemo(() => getGalleriesStyles(theme), [theme]);
  const colors = useMemo(() => getGalleriesColors(theme), [theme]);

  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [selectedGalleryId, setSelectedGalleryId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'All' | 'Active' | 'Expired'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGalleries = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get<Gallery[]>('/api/galleries')
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setGalleries(list);
        setSelectedGalleryId(list[0]?.id ?? null);
      })
      .catch(() => setError('Could not load galleries. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadGalleries(); }, [loadGalleries]);

  const filteredGalleries = useMemo(() => {
    let filtered = galleries;
    if (filterStatus === 'Active') filtered = filtered.filter(g => daysUntil(g.expiresAt) >= 0);
    else if (filterStatus === 'Expired') filtered = filtered.filter(g => daysUntil(g.expiresAt) < 0);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter(g =>
      g.bookingName.toLowerCase().includes(q) || g.eventType.toLowerCase().includes(q),
    );
  }, [galleries, filterStatus, searchQuery]);

  const selectedGallery = useMemo(
    () => galleries.find(g => g.id === selectedGalleryId) ?? galleries[0] ?? null,
    [galleries, selectedGalleryId],
  );

  const stats = useMemo(() => ({
    total: galleries.length,
    active: galleries.filter(g => daysUntil(g.expiresAt) >= 0).length,
    totalPhotos: galleries.reduce((sum, g) => sum + g.photoCount, 0),
  }), [galleries]);

  if (loading) {
    return (
      <div style={styles.pageWrapper}>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
        <div style={styles.container}>
          <div style={styles.listPanel}>
            <div style={styles.listScroll}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 16px', marginBottom: 10 }}
                >
                  <div style={{ height: 13, width: '60%', borderRadius: 6, background: colors.surfaceAlt, animation: 'pulse 1.6s ease-in-out infinite' }} />
                  <div style={{ height: 11, width: '40%', borderRadius: 6, background: colors.surfaceAlt, animation: 'pulse 1.6s ease-in-out infinite' }} />
                </div>
              ))}
            </div>
          </div>
          <div style={styles.detailPanel}>
            <div style={styles.emptyState}>Loading galleries…</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.pageWrapper}>
        <div style={styles.errorPanel}>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>Couldn&apos;t load galleries</div>
          <div style={styles.errorText}>{error}</div>
          <button style={styles.retryButton} onClick={loadGalleries}>Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageWrapper}>
      <header style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>Your Galleries</h1>
          <p style={styles.pageSubtitle}>View, download, and manage your photo galleries.</p>
        </div>
        <div style={styles.headerStats}>
          <div style={styles.headerStatCard}>
            <div style={styles.headerStatLabel}>Galleries</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <div style={styles.headerStatValue}>{stats.total}</div>
              <div style={styles.headerStatChange}>{stats.active} active</div>
            </div>
          </div>
          <div style={styles.headerStatCard}>
            <div style={styles.headerStatLabel}>Total Photos</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <div style={styles.headerStatValue}>{stats.totalPhotos}</div>
              <div style={styles.headerStatChange}>available</div>
            </div>
          </div>
        </div>
      </header>

      <div style={styles.container}>
        <div style={styles.listPanel}>
          <div style={styles.listHeader}>
            <div style={styles.listTitle}>Galleries</div>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search galleries..."
              aria-label="Search galleries"
              style={styles.searchBox}
            />
          </div>

          <div style={styles.filterTabs}>
            {(['All', 'Active', 'Expired'] as const).map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                style={{
                  ...styles.filterTab,
                  ...(filterStatus === status ? styles.filterTabActive : {}),
                }}
              >
                {status}
              </button>
            ))}
          </div>

          <div style={styles.listScroll}>
            {filteredGalleries.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: colors.textMuted, fontSize: '0.875rem' }}>
                {galleries.length === 0 ? 'No galleries yet.' : 'No galleries match these filters.'}
              </div>
            ) : (
              filteredGalleries.map(gallery => (
                <GalleryListItem
                  key={gallery.id}
                  gallery={gallery}
                  isActive={selectedGalleryId === gallery.id}
                  onSelect={() => setSelectedGalleryId(gallery.id)}
                  styles={styles}
                  colors={colors}
                />
              ))
            )}
          </div>
        </div>

        <div style={styles.detailPanel}>
          <GalleryDetail gallery={selectedGallery} styles={styles} />
        </div>
      </div>
    </div>
  );
}
