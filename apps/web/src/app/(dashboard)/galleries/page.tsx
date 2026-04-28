'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { galleriesStyles as styles } from './galleries.styles';

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

const MOCK_GALLERIES: Gallery[] = [
  {
    id: 'g1',
    bookingId: 'b2',
    bookingName: 'Portrait Session',
    eventType: 'Portrait',
    shootDate: '2026-05-02',
    photoCount: 48,
    downloadEnabled: true,
    watermarkEnabled: false,
    expiresAt: '2026-08-02',
    accessToken: 'gal-abc123-portrait',
    viewCount: 12,
  },
  {
    id: 'g2',
    bookingId: 'b3',
    bookingName: 'Family Photos',
    eventType: 'Family',
    shootDate: '2026-04-25',
    photoCount: 72,
    downloadEnabled: true,
    watermarkEnabled: false,
    expiresAt: '2026-07-25',
    accessToken: 'gal-def456-family',
    viewCount: 8,
  },
];

function GalleryListItem({
  gallery,
  isActive,
  onSelect,
  colors,
}: Readonly<{ gallery: Gallery; isActive: boolean; onSelect: () => void; colors?: any }>) {
  const defaultColors = { bg: '#F7F8FA', text: '#111827', subText: '#6B7280', cardBg: '#fff', border: '#E5E7EB' };
  const c = colors || defaultColors;

  const expiryDate = new Date(gallery.expiresAt);
  const today = new Date();
  const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const isExpired = daysUntilExpiry < 0;
  const isWarning = daysUntilExpiry < 7 && daysUntilExpiry >= 0;

  return (
    <button
      style={{
        ...styles.listItem,
        ...(isActive ? styles.listItemActive : {}),
        border: 'none',
        background: isActive ? `rgba(37, 99, 235, 0.1)` : c.cardBg,
        color: c.text,
        transition: 'all 0.2s ease',
        textAlign: 'left',
      }}
      onClick={onSelect}
    >
      <div style={{ ...styles.listItemTitle, color: c.text }}>{gallery.bookingName}</div>
      <div style={{ ...styles.listItemMeta, color: c.subText }}>
        {gallery.eventType} • {gallery.photoCount} photos
      </div>
      <div style={{ ...styles.listItemMeta, color: c.subText, fontSize: '10px' }}>
        {isExpired
          ? '❌ Expired'
          : isWarning
            ? `⏰ ${daysUntilExpiry} days left`
            : `✓ ${daysUntilExpiry} days left`}
      </div>
    </button>
  );
}

function GalleryDetail({ gallery, colors }: Readonly<{ gallery: Gallery | null; colors?: any }>) {
  const c = colors;

  if (!gallery) {
    return (
      <div style={styles.emptyState}>
        <div style={{ fontSize: '16px', color: c.subText }}>🖼️ Select a gallery to view</div>
      </div>
    );
  }

  const shootDate = new Date(gallery.shootDate);
  const expiryDate = new Date(gallery.expiresAt);
  const today = new Date();
  const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const isExpired = daysUntilExpiry < 0;
  const isWarning = daysUntilExpiry < 7 && daysUntilExpiry >= 0;

  let expiryBadgeStyle = styles.expiryActive;
  if (isExpired) expiryBadgeStyle = styles.expiryExpired;
  else if (isWarning) expiryBadgeStyle = styles.expiryWarning;

  return (
    <>
      <div style={{ ...styles.detailHeader, borderBottomColor: c.border }}>
        <div>
          <div style={{ ...styles.detailTitle, color: c.text }}>{gallery.bookingName}</div>
          <div style={{ ...styles.detailSubtitle, color: c.subText }}>
            {gallery.eventType} • Shot on {shootDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
        <div style={styles.detailActions}>
          <button
            style={{
              ...styles.actionButton,
              ...styles.actionButtonPrimary,
            }}
          >
            👁️ View Gallery
          </button>
          <button
            style={{
              ...styles.actionButton,
              ...styles.actionButtonOutline,
              color: c.text,
              borderColor: c.border,
              background: 'transparent',
            }}
          >
            ⬇️ Download All
          </button>
        </div>
      </div>

      <div style={{ ...styles.detailBody }}>
        <div style={styles.statsGrid}>
          <div style={{ ...styles.statBox, borderColor: c.border, background: c.bg === '#F9FAFB' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)' }}>
            <div style={{ ...styles.statBoxLabel, color: c.subText }}>Photos</div>
            <div style={{ ...styles.statBoxValue, color: c.text }}>{gallery.photoCount}</div>
          </div>
          <div style={{ ...styles.statBox, borderColor: c.border, background: c.bg === '#F9FAFB' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)' }}>
            <div style={{ ...styles.statBoxLabel, color: c.subText }}>Views</div>
            <div style={{ ...styles.statBoxValue, color: c.text }}>{gallery.viewCount}</div>
          </div>
          <div style={{ ...styles.statBox, borderColor: c.border, background: c.bg === '#F9FAFB' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)' }}>
            <div style={{ ...styles.statBoxLabel, color: c.subText }}>Expires</div>
            <div style={{ ...styles.statBoxValue, color: c.text }}>
              {isExpired ? '—' : daysUntilExpiry}
            </div>
          </div>
        </div>

        <div style={styles.section}>
          <div style={{ ...styles.sectionTitle, color: c.subText }}>Access Information</div>
          <div style={styles.infoGrid}>
            <div style={{ ...styles.infoRow, borderBottomColor: c.border }}>
              <span style={{ ...styles.infoLabel, color: c.subText }}>Download</span>
              <span style={{ ...styles.infoValue, color: c.text }}>
                {gallery.downloadEnabled ? '✓ Enabled' : '✕ Disabled'}
              </span>
            </div>
            <div style={{ ...styles.infoRow, borderBottomColor: c.border }}>
              <span style={{ ...styles.infoLabel, color: c.subText }}>Watermark</span>
              <span style={{ ...styles.infoValue, color: c.text }}>
                {gallery.watermarkEnabled ? '✓ Enabled' : '✕ Disabled'}
              </span>
            </div>
            <div style={{ ...styles.infoRow, borderBottom: 'none', paddingBottom: 0 }}>
              <span style={{ ...styles.infoLabel, color: c.subText }}>Expires</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                <span style={{ ...styles.infoValue, color: c.text }}>
                  {expiryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span style={{ ...styles.expiryBadge, ...expiryBadgeStyle }}>
                  {isExpired ? '❌ Expired' : isWarning ? `⏰ ${daysUntilExpiry} days` : `✓ ${daysUntilExpiry} days`}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.section}>
          <div style={{ ...styles.sectionTitle, color: c.subText }}>Gallery Link</div>
          <div
            style={{
              padding: '12px 14px',
              background: c.bg === '#F9FAFB' ? '#F3F4F6' : '#374151',
              borderRadius: '10px',
              border: `1px solid ${c.border}`,
              fontFamily: 'monospace',
              fontSize: '12px',
              color: c.text,
              wordBreak: 'break-all',
              lineHeight: '1.5',
            }}
          >
            {`gallery.fotolio.app/${gallery.accessToken}`}
          </div>
          <button
            style={{
              ...styles.actionButton,
              ...styles.actionButtonOutline,
              width: '100%',
              marginTop: '10px',
              color: c.text,
              borderColor: c.border,
              background: 'transparent',
            }}
          >
            📋 Copy Link
          </button>
        </div>
      </div>
    </>
  );
}

export default function GalleriesPage() {
  const { theme } = useThemeStore();
  const [galleries] = useState<Gallery[]>(MOCK_GALLERIES);
  const [selectedGalleryId, setSelectedGalleryId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'All' | 'Active' | 'Expired'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const themeColors = {
    light: { bg: '#F9FAFB', cardBg: '#FFFFFF', text: '#111827', subText: '#6B7280', border: '#E5E7EB', hover: '#F3F4F6' },
    dark: { bg: '#111827', cardBg: '#1F2937', text: '#F3F4F6', subText: '#D1D5DB', border: '#374151', hover: '#374151' },
  };
  const colors = themeColors[theme];

  useEffect(() => {
    if (!selectedGalleryId) {
      setSelectedGalleryId(MOCK_GALLERIES[0]?.id || null);
    }
  }, [selectedGalleryId]);

  const filteredGalleries = useMemo(() => {
    let filtered = galleries;

    if (filterStatus === 'Active') {
      filtered = filtered.filter((g) => {
        const daysUntilExpiry = Math.ceil((new Date(g.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilExpiry >= 0;
      });
    } else if (filterStatus === 'Expired') {
      filtered = filtered.filter((g) => {
        const daysUntilExpiry = Math.ceil((new Date(g.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilExpiry < 0;
      });
    }

    if (!searchQuery.trim()) return filtered;

    const query = searchQuery.trim().toLowerCase();
    return filtered.filter((g) =>
      g.bookingName.toLowerCase().includes(query) || g.eventType.toLowerCase().includes(query),
    );
  }, [galleries, filterStatus, searchQuery]);

  const selectedGallery = useMemo(
    () => galleries.find((g) => g.id === selectedGalleryId) || galleries[0] || null,
    [galleries, selectedGalleryId],
  );

  const stats = useMemo(() => {
    const total = galleries.length;
    const active = galleries.filter((g) => {
      const daysUntilExpiry = Math.ceil((new Date(g.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return daysUntilExpiry >= 0;
    }).length;
    const totalPhotos = galleries.reduce((sum, g) => sum + g.photoCount, 0);

    return { total, active, totalPhotos };
  }, [galleries]);

  const statsCards = useMemo(
    () => [
      { label: 'Galleries', value: stats.total, change: `${stats.active} active` },
      { label: 'Total Photos', value: stats.totalPhotos, change: 'available' },
    ],
    [stats],
  );

  return (
    <div style={{ ...styles.pageWrapper, background: colors.bg, color: colors.text, transition: 'background 0.3s ease, color 0.3s ease' }}>
      <div style={{ ...styles.pageHeader, background: colors.cardBg, borderColor: colors.border, color: colors.text, transition: 'all 0.3s ease' }}>
        <div>
          <div style={{ ...styles.pageTitle, color: colors.text }}>Your Galleries</div>
          <div style={{ ...styles.pageSubtitle, color: colors.subText }}>View, download, and manage your photo galleries.</div>
        </div>
        <div style={styles.headerStats}>
          {statsCards.map((card) => (
            <div key={card.label} style={{ ...styles.headerStatCard, background: colors.cardBg, borderColor: colors.border, transition: 'all 0.3s ease' }}>
              <div style={{ ...styles.headerStatLabel, color: colors.subText }}>{card.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <div style={{ ...styles.headerStatValue, color: colors.text }}>{card.value}</div>
                <div style={{ ...styles.headerStatChange, color: colors.subText }}>{card.change}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...styles.container, background: colors.bg }}>
        <div style={{ ...styles.listPanel, background: colors.cardBg, borderColor: colors.border, transition: 'all 0.3s ease' }}>
          <div style={{ ...styles.listHeader, borderBottomColor: colors.border }}>
            <div style={{ ...styles.listTitle, color: colors.text }}>Galleries</div>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search galleries..."
              style={{ ...styles.searchBox, background: colors.bg, color: colors.text, borderColor: colors.border }}
            />
          </div>

          <div style={{ ...styles.filterTabs, borderBottomColor: colors.border }}>
            {(['All', 'Active', 'Expired'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                style={{
                  ...styles.filterTab,
                  ...(filterStatus === status ? styles.filterTabActive : {}),
                  color: filterStatus === status ? '#fff' : colors.subText,
                  background: filterStatus === status ? '#2563EB' : 'transparent',
                  borderColor: colors.border,
                  transition: 'all 0.2s ease',
                }}
              >
                {status}
              </button>
            ))}
          </div>

          <div style={styles.listScroll}>
            {filteredGalleries.map((gallery) => (
              <GalleryListItem
                key={gallery.id}
                gallery={gallery}
                isActive={selectedGalleryId === gallery.id}
                onSelect={() => setSelectedGalleryId(gallery.id)}
                colors={colors}
              />
            ))}
          </div>
        </div>

        <div style={{ ...styles.detailPanel, background: colors.cardBg, borderColor: colors.border, transition: 'all 0.3s ease' }}>
          <GalleryDetail gallery={selectedGallery} colors={colors} />
        </div>
      </div>
    </div>
  );
}
