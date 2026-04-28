'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useThemeStore } from '@/store/themeStore';
import { portfolioStyles as styles } from './portfolio.styles';

interface PortfolioCollection {
  id: string;
  name: string;
  count: number;
  featured?: boolean;
}

interface PortfolioItem {
  id: string;
  title: string;
  collectionId: string;
  date: string;
  likes: number;
  image: string;
}

const MOCK_COLLECTIONS: PortfolioCollection[] = [
  { id: '1', name: 'Weddings', count: 24, featured: true },
  { id: '2', name: 'Portraits', count: 18 },
  { id: '3', name: 'Events', count: 15 },
  { id: '4', name: 'Fashion', count: 12 },
  { id: '5', name: 'Nature', count: 21 },
];

const MOCK_PORTFOLIO_ITEMS: PortfolioItem[] = [
  { id: '1', title: 'Berlin Wedding', collectionId: '1', date: '2026-04-15', likes: 45, image: 'wedding-1.jpg' },
  { id: '2', title: 'Corporate Headshots', collectionId: '2', date: '2026-04-10', likes: 32, image: 'portrait-1.jpg' },
  { id: '3', title: 'Conference Setup', collectionId: '3', date: '2026-04-08', likes: 28, image: 'event-1.jpg' },
  { id: '4', title: 'Fashion Show', collectionId: '4', date: '2026-04-05', likes: 56, image: 'fashion-1.jpg' },
  { id: '5', title: 'Mountain Landscape', collectionId: '5', date: '2026-03-28', likes: 89, image: 'nature-1.jpg' },
  { id: '6', title: 'Sunrise at Beach', collectionId: '5', date: '2026-03-25', likes: 92, image: 'nature-2.jpg' },
  { id: '7', title: 'Summer Wedding', collectionId: '1', date: '2026-03-20', likes: 67, image: 'wedding-2.jpg' },
  { id: '8', title: 'Studio Portrait', collectionId: '2', date: '2026-03-18', likes: 41, image: 'portrait-2.jpg' },
];

function CollectionListItem({
  collection,
  isActive,
  onSelect,
  colors,
}: Readonly<{ collection: PortfolioCollection; isActive: boolean; onSelect: () => void; colors?: any }>) {
  const defaultColors = { bg: '#F7F8FA', text: '#111827', subText: '#6B7280', cardBg: '#fff', border: '#E5E7EB' };
  const c = colors || defaultColors;

  return (
    <button
      style={{
        ...styles.listItem,
        ...(isActive ? styles.listItemActive : {}),
        border: 'none',
        background: isActive ? `rgba(37, 99, 235, 0.1)` : c.cardBg,
        color: c.text,
        transition: 'all 0.2s ease',
      }}
      onClick={onSelect}
    >
      <div style={{ ...styles.listItemTitle, color: c.text }}>{collection.name}</div>
      <div style={{ ...styles.listItemMeta, color: c.subText }}>
        {collection.count} photo{collection.count !== 1 ? 's' : ''}
      </div>
    </button>
  );
}

function PortfolioGrid({ items, colors }: Readonly<{ items: PortfolioItem[]; colors: any }>) {
  const c = colors;
  const imageBg = c.bg === '#F9FAFB' ? '#E5E7EB' : '#374151';

  if (items.length === 0) {
    return (
      <div style={styles.emptyState}>
        <div style={{ color: c.subText }}>📸 No portfolio items found</div>
      </div>
    );
  }

  return (
    <div style={styles.portfolioGrid}>
      {items.map((item) => (
        <div key={item.id} style={{ ...styles.portfolioCard, border: `1px solid ${c.border}`, background: c.cardBg }}>
          <div style={{ ...styles.portfolioCardImage, background: imageBg }} />
          <div style={{ ...styles.portfolioCardContent }}>
            <div style={{ ...styles.portfolioCardTitle, color: c.text }}>{item.title}</div>
            <div style={{ ...styles.portfolioCardMeta, color: c.subText }}>
              ❤️ {item.likes} • {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PortfolioHeader({ collection, colors }: Readonly<{ collection: PortfolioCollection | null; colors: any }>) {
  const c = colors;

  if (!collection) {
    return (
      <div style={styles.emptyState}>
        <div style={{ color: c.subText }}>👈 Select a collection to view</div>
      </div>
    );
  }

  return (
    <>
      <div style={{ ...styles.detailHeader, borderBottomColor: c.border }}>
        <div>
          <div style={{ ...styles.detailTitle, color: c.text }}>{collection.name}</div>
          <div style={{ ...styles.detailSubtitle, color: c.subText }}>
            {collection.count} photos in this collection
          </div>
        </div>
        <div style={styles.detailActions}>
          <button style={{ ...styles.actionButton, ...styles.actionButtonOutline, color: c.text, borderColor: c.border, background: 'transparent' }}>
            📥 Download
          </button>
          <button style={{ ...styles.actionButton, ...styles.actionButtonPrimary }}>✏️ Edit</button>
        </div>
      </div>

      <div style={styles.detailBody}>
        <div style={{ ...styles.statsGrid }}>
          <div style={{ ...styles.statBox, borderColor: c.border, background: c.bg === '#F9FAFB' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)' }}>
            <div style={{ ...styles.statBoxLabel, color: c.subText }}>Photos</div>
            <div style={{ ...styles.statBoxValue, color: c.text }}>{collection.count}</div>
          </div>
          <div style={{ ...styles.statBox, borderColor: c.border, background: c.bg === '#F9FAFB' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)' }}>
            <div style={{ ...styles.statBoxLabel, color: c.subText }}>Total Likes</div>
            <div style={{ ...styles.statBoxValue, color: c.text }}>287</div>
          </div>
          <div style={{ ...styles.statBox, borderColor: c.border, background: c.bg === '#F9FAFB' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)' }}>
            <div style={{ ...styles.statBoxLabel, color: c.subText }}>Avg Likes</div>
            <div style={{ ...styles.statBoxValue, color: c.text }}>36</div>
          </div>
          <div style={{ ...styles.statBox, borderColor: c.border, background: c.bg === '#F9FAFB' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)' }}>
            <div style={{ ...styles.statBoxLabel, color: c.subText }}>Top Photo</div>
            <div style={{ ...styles.statBoxValue, color: c.text }}>92 ❤️</div>
          </div>
        </div>

        <PortfolioGrid items={MOCK_PORTFOLIO_ITEMS.filter((item) => item.collectionId === collection.id)} colors={colors} />
      </div>
    </>
  );
}

export default function PortfolioPage() {
  const searchParams = useSearchParams();
  const { theme } = useThemeStore();
  const [collections] = useState<PortfolioCollection[]>(MOCK_COLLECTIONS);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'All' | 'Featured'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const themeColors = {
    light: { bg: '#F9FAFB', cardBg: '#FFFFFF', text: '#111827', subText: '#6B7280', border: '#E5E7EB', hover: '#F3F4F6' },
    dark: { bg: '#111827', cardBg: '#1F2937', text: '#F3F4F6', subText: '#D1D5DB', border: '#374151', hover: '#374151' },
  };
  const colors = themeColors[theme];

  useEffect(() => {
    const selected = searchParams.get('selected');
    if (selected) {
      setSelectedCollectionId(selected);
    } else if (!selectedCollectionId) {
      setSelectedCollectionId(MOCK_COLLECTIONS[0]?.id || null);
    }
  }, [searchParams, selectedCollectionId]);

  const filteredCollections = useMemo(() => {
    let filtered = collections;
    if (filterStatus === 'Featured') filtered = filtered.filter((c) => c.featured);
    if (!searchQuery.trim()) return filtered;
    const query = searchQuery.trim().toLowerCase();
    return filtered.filter((c) => c.name.toLowerCase().includes(query));
  }, [collections, filterStatus, searchQuery]);

  const selectedCollection = useMemo(
    () => collections.find((c) => c.id === selectedCollectionId) || collections[0] || null,
    [collections, selectedCollectionId],
  );

  const stats = useMemo(() => ({
    total: collections.length,
    featured: collections.filter((c) => c.featured).length,
    totalPhotos: MOCK_PORTFOLIO_ITEMS.length,
  }), [collections]);

  const statsCards = useMemo(() => [
    { label: 'Collections', value: stats.total, change: `${stats.featured} featured` },
    { label: 'Total Photos', value: stats.totalPhotos, change: 'across all' },
    { label: 'Total Likes', value: '892', change: 'all time' },
  ], [stats]);

  return (
    <div style={{ ...styles.pageWrapper, background: colors.bg, color: colors.text, transition: 'background 0.3s ease, color 0.3s ease' }}>
      <div style={{ ...styles.pageHeader, background: colors.cardBg, borderColor: colors.border, color: colors.text, transition: 'all 0.3s ease' }}>
        <div>
          <div style={{ ...styles.pageTitle, color: colors.text }}>Portfolio</div>
          <div style={{ ...styles.pageSubtitle, color: colors.subText }}>Showcase your best work, organize collections, and track engagement.</div>
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
            <div style={{ ...styles.listTitle, color: colors.text }}>Collections</div>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search collections..."
              style={{ ...styles.searchBox, background: colors.bg, color: colors.text, borderColor: colors.border }}
            />
          </div>

          <div style={{ ...styles.filterTabs, borderBottomColor: colors.border }}>
            {(['All', 'Featured'] as const).map((status) => (
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
            {filteredCollections.map((collection) => (
              <CollectionListItem
                key={collection.id}
                collection={collection}
                isActive={selectedCollectionId === collection.id}
                onSelect={() => setSelectedCollectionId(collection.id)}
                colors={colors}
              />
            ))}
          </div>
        </div>

        <div style={{ ...styles.detailPanel, background: colors.cardBg, borderColor: colors.border, transition: 'all 0.3s ease' }}>
          <PortfolioHeader collection={selectedCollection} colors={colors} />
        </div>
      </div>
    </div>
  );
}
