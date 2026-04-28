'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useThemeStore } from '@/store/themeStore';
import { Client } from '@/types/api';
import { clientsStyles as styles } from './clients.styles';

const MOCK_CLIENTS: Client[] = [
  {
    id: '1',
    name: 'Maria & Klaus',
    email: 'maria@example.com',
    phone: '+49 176 333 2211',
    location: 'Berlin, Germany',
    totalSpent: 850,
    bookingsCompleted: 1,
    upcomingBookings: 0,
    lastBookingDate: '2026-06-14',
    notes: 'Wonderful couple, very happy with photos. Referred 3 friends.',
    joinedAt: '2025-04-15',
  },
  {
    id: '2',
    name: 'Sophie Richter',
    email: 'sophie@example.com',
    phone: '+49 162 444 3322',
    location: 'Munich, Germany',
    totalSpent: 350,
    bookingsCompleted: 1,
    upcomingBookings: 0,
    lastBookingDate: '2026-05-02',
    notes: 'Professional client, very organized. Uses photos for LinkedIn.',
    joinedAt: '2025-04-10',
  },
  {
    id: '3',
    name: 'Thomas Müller',
    email: 'thomas@example.com',
    phone: '+49 178 555 4433',
    location: 'Hamburg, Germany',
    totalSpent: 150,
    bookingsCompleted: 1,
    upcomingBookings: 1,
    lastBookingDate: '2026-04-25',
    notes: 'Casual family client, very relaxed during shoot.',
    joinedAt: '2025-04-09',
  },
  {
    id: '4',
    name: 'Laura & Ben',
    email: 'laura@example.com',
    phone: '+49 151 666 5544',
    location: 'Cologne, Germany',
    totalSpent: 1200,
    bookingsCompleted: 1,
    upcomingBookings: 1,
    lastBookingDate: '2026-07-20',
    notes: 'Premium clients, very high satisfaction. Interest in album design.',
    joinedAt: '2025-04-08',
  },
  {
    id: '5',
    name: 'Nina Kraft',
    email: 'nina@example.com',
    phone: '+49 175 777 6655',
    location: 'Frankfurt, Germany',
    totalSpent: 120,
    bookingsCompleted: 2,
    upcomingBookings: 0,
    lastBookingDate: '2026-04-30',
    notes: 'Repeat customer. Loves casual family photos.',
    joinedAt: '2025-04-07',
  },
];

function ClientListItem({
  client,
  isActive,
  onSelect,
  colors,
}: Readonly<{ client: Client; isActive: boolean; onSelect: () => void; colors?: any }>) {
  const defaultColors = { bg: '#F7F8FA', text: '#111827', subText: '#6B7280', cardBg: '#fff', border: '#E5E7EB', hover: '#F3F4F6' };
  const c = colors || defaultColors;

  return (
    <button
      style={{
        ...styles.listItem,
        ...(isActive ? styles.listItemActive : {}),
        border: 'none',
        background: isActive ? `rgba(37, 99, 235, 0.1)` : c.cardBg,
        textAlign: 'left',
        cursor: 'pointer',
        color: c.text,
        transition: 'all 0.2s ease',
      }}
      onClick={onSelect}
    >
      <div style={styles.listItemAvatar}>
        {client.name
          .split(' ')
          .slice(0, 2)
          .map((n) => n[0])
          .join('')
          .toUpperCase()}
      </div>
      <div style={styles.listItemContent}>
        <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px', letterSpacing: '-0.01em', lineHeight: '1.3', color: c.text }}>{client.name}</div>
        <div style={{ fontSize: '12px', lineHeight: '1.4', fontWeight: 500, marginBottom: '3px', color: c.subText }}>
          {client.bookingsCompleted} booking{client.bookingsCompleted !== 1 ? 's' : ''} · €{client.totalSpent}
        </div>
        <div style={{ fontSize: '11px', color: c.subText, lineHeight: '1.4' }}>
          {client.location}
        </div>
      </div>
      <div style={styles.listItemRight}>
        {client.upcomingBookings > 0 && (
          <div style={styles.upcomingBadge}>
            {client.upcomingBookings} upcoming
          </div>
        )}
      </div>
    </button>
  );
}

function ClientDetail({ client, colors }: Readonly<{ client: Client | null; colors?: any }>) {
  const [notes, setNotes] = React.useState('');
  const [hasChanges, setHasChanges] = React.useState(false);
  const defaultColors = { text: '#111827', subText: '#6B7280', cardBg: '#fff', bg: '#f9fafb', border: '#e5e7eb' };
  const c = colors || defaultColors;

  React.useEffect(() => {
    if (client) {
      setNotes(client.notes || '');
      setHasChanges(false);
    }
  }, [client]);

  if (!client) {
    return (
      <div style={styles.emptyState}>
        <div style={{ fontSize: '16px', color: c.subText }}>👥 Select a client to view details</div>
      </div>
    );
  }

  const lastBookingDate = client.lastBookingDate ? new Date(client.lastBookingDate) : null;

  return (
    <>
      <div style={{...styles.detailHeader, borderBottomColor: c.border}}>
        <div>
          <div style={{...styles.detailTitle, color: c.text}}>{client.name}</div>
          <div style={{...styles.detailSubtitle, color: c.subText}}>
            {client.location} · Joined {new Date(client.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </div>
        </div>
        <div style={styles.detailActions}>
          <button style={{ ...styles.actionButton, ...styles.actionButtonPrimary }}>
            New Booking
          </button>
        </div>
      </div>

      <div style={{...styles.detailBody}}>
        <div style={styles.statsGrid}>
          <div style={{...styles.statBox, background: 'rgba(0, 0, 0, 0.05)', borderColor: c.border}}>
            <div style={{...styles.statBoxLabel, color: c.subText}}>Total Spent</div>
            <div style={{...styles.statBoxValue, color: c.text}}>€{client.totalSpent}</div>
          </div>
          <div style={{...styles.statBox, background: 'rgba(0, 0, 0, 0.05)', borderColor: c.border}}>
            <div style={{...styles.statBoxLabel, color: c.subText}}>Bookings</div>
            <div style={{...styles.statBoxValue, color: c.text}}>{client.bookingsCompleted}</div>
          </div>
          <div style={{...styles.statBox, background: 'rgba(0, 0, 0, 0.05)', borderColor: c.border}}>
            <div style={{...styles.statBoxLabel, color: c.subText}}>Upcoming</div>
            <div style={{...styles.statBoxValue, color: c.text}}>{client.upcomingBookings}</div>
          </div>
          <div style={{...styles.statBox, background: 'rgba(0, 0, 0, 0.05)', borderColor: c.border}}>
            <div style={{...styles.statBoxLabel, color: c.subText}}>Last Session</div>
            <div style={{...styles.statBoxValue, color: c.text}}>
              {lastBookingDate
                ? lastBookingDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : '—'}
            </div>
          </div>
        </div>

        <div style={styles.section}>
          <div style={{...styles.sectionTitle, color: c.subText}}>Contact Information</div>
          <div style={styles.infoGrid}>
            <div style={{...styles.infoRow, borderBottomColor: c.border}}>
              <span style={{...styles.infoLabel, color: c.subText}}>Email</span>
              <span style={{...styles.infoValue, color: c.text}}>{client.email}</span>
            </div>
            <div style={{...styles.infoRow, borderBottomColor: c.border}}>
              <span style={{...styles.infoLabel, color: c.subText}}>Phone</span>
              <span style={{...styles.infoValue, color: c.text}}>{client.phone || 'Not provided'}</span>
            </div>
            <div style={{ ...styles.infoRow, borderBottom: 'none', paddingBottom: 0 }}>
              <span style={{...styles.infoLabel, color: c.subText}}>Location</span>
              <span style={{...styles.infoValue, color: c.text}}>{client.location || 'Not provided'}</span>
            </div>
          </div>
        </div>

        <div style={styles.section}>
          <div style={{...styles.sectionTitle, color: c.subText}}>Client Notes</div>
          <textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setHasChanges(true);
            }}
            placeholder="Add notes about this client..."
            style={{...styles.notesTextarea, color: c.text, backgroundColor: 'rgba(0, 0, 0, 0.05)', borderColor: c.border}}
          />
          {hasChanges && (
            <button style={{ ...styles.actionButton, ...styles.actionButtonPrimary, width: '100%', marginTop: '10px' }}>
              Save Notes
            </button>
          )}
        </div>

        <div style={styles.contactActions}>
          <button style={{ ...styles.actionButton, ...styles.actionButtonOutline, flex: 1, color: c.text, borderColor: c.border, background: 'transparent' }}>
            💬 WhatsApp
          </button>
          <button style={{ ...styles.actionButton, ...styles.actionButtonOutline, flex: 1, color: c.text, borderColor: c.border, background: c.cardBg }}>
            📧 Email
          </button>
        </div>
      </div>
    </>
  );
}

export default function ClientsPage() {
  const searchParams = useSearchParams();
  const { theme } = useThemeStore();
  const [clients] = useState<Client[]>(MOCK_CLIENTS);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'All' | 'Active' | 'Repeat'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const themeColors = {
    light: { bg: '#F9FAFB', cardBg: '#FFFFFF', text: '#111827', subText: '#6B7280', border: '#E5E7EB', hover: '#F3F4F6' },
    dark: { bg: '#111827', cardBg: '#1F2937', text: '#F3F4F6', subText: '#D1D5DB', border: '#374151', hover: '#374151' },
  };
  const colors = themeColors[theme];

  useEffect(() => {
    const selected = searchParams.get('selected');
    if (selected) {
      setSelectedClientId(selected);
    } else if (!selectedClientId) {
      setSelectedClientId(MOCK_CLIENTS[0]?.id || null);
    }
  }, [searchParams, selectedClientId]);

  const filteredClients = useMemo(() => {
    let filtered = clients;
    if (filterStatus === 'Active') filtered = filtered.filter((c) => c.upcomingBookings > 0);
    if (filterStatus === 'Repeat') filtered = filtered.filter((c) => c.bookingsCompleted > 1);
    if (!searchQuery.trim()) return filtered;
    const query = searchQuery.trim().toLowerCase();
    return filtered.filter((client) =>
      client.name.toLowerCase().includes(query)
      || client.email.toLowerCase().includes(query)
      || client.location?.toLowerCase().includes(query),
    );
  }, [clients, filterStatus, searchQuery]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || clients[0] || null,
    [clients, selectedClientId],
  );

  const stats = useMemo(() => {
    const total = clients.length;
    const active = clients.filter((c) => c.upcomingBookings > 0).length;
    const totalRevenue = clients.reduce((sum, c) => sum + c.totalSpent, 0);
    const avgSpend = Math.round(totalRevenue / total);

    return {
      total,
      active,
      totalRevenue,
      avgSpend,
    };
  }, [clients]);

  const statsCards = useMemo(() => [
    {
      label: 'Total Clients',
      value: stats.total,
      change: `€${stats.totalRevenue} revenue`,
    },
    {
      label: 'Active Bookings',
      value: stats.active,
      change: `Upcoming sessions`,
    },
    {
      label: 'Average Spend',
      value: `€${stats.avgSpend}`,
      change: 'Per client',
    },
  ], [stats]);

  return (
    <div style={{ ...styles.pageWrapper, background: colors.bg, color: colors.text, transition: 'background 0.3s ease, color 0.3s ease' }}>
      <div style={{ ...styles.pageHeader, background: colors.cardBg, borderColor: colors.border, color: colors.text, transition: 'all 0.3s ease' }}>
        <div>
          <div style={{ ...styles.pageTitle, color: colors.text }}>Clients</div>
          <div style={{ ...styles.pageSubtitle, color: colors.subText }}>Manage client relationships, track sessions, and build lasting connections.</div>
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
          <div style={{...styles.listHeader, borderBottomColor: colors.border}}>
            <div style={{...styles.listTitle, color: colors.text}}>Clients</div>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search clients..."
              style={{...styles.searchBox, background: colors.bg, color: colors.text, borderColor: colors.border}}
            />
          </div>

          <div style={{...styles.filterTabs, borderBottomColor: colors.border}}>
            {(['All', 'Active', 'Repeat'] as const).map((status) => (
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
            {filteredClients.map((client) => (
              <ClientListItem
                key={client.id}
                client={client}
                isActive={selectedClientId === client.id}
                onSelect={() => setSelectedClientId(client.id)}
                colors={colors}
              />
            ))}
          </div>
        </div>

        <div style={{...styles.detailPanel, background: colors.cardBg, borderColor: colors.border, transition: 'all 0.3s ease'}}>
          <ClientDetail client={selectedClient} colors={colors} />
        </div>
      </div>
    </div>
  );
}
