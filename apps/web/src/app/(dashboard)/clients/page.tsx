'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useThemeStore } from '@/store/themeStore';
import api from '@/lib/api';
import { Client } from '@/types/api';
import { getInitials, pickAvatarColor } from '@/lib/avatar';
import {
  getClientsColors,
  getClientsStyles,
  type ClientsTheme,
} from './clients.styles';

type ClientFilter = 'All' | 'Active' | 'Repeat';

function formatEUR(cents: number) {
  return `€${(cents / 100).toLocaleString('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

const ICONS = {
  search: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  ),
  plus: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  whatsapp: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.6 6.32A7.85 7.85 0 0 0 12.05 4a7.94 7.94 0 0 0-6.88 11.91L4 20l4.2-1.1a7.93 7.93 0 0 0 3.84.98h.01a7.94 7.94 0 0 0 5.55-13.56Zm-5.55 12.21h-.01a6.6 6.6 0 0 1-3.36-.92l-.24-.14-2.5.65.67-2.43-.16-.25a6.6 6.6 0 0 1 10.3-8.13 6.55 6.55 0 0 1 1.94 4.69 6.6 6.6 0 0 1-6.64 6.53Zm3.61-4.94c-.2-.1-1.18-.58-1.36-.65s-.31-.1-.45.1c-.13.2-.5.65-.62.78-.11.13-.23.15-.43.05a5.42 5.42 0 0 1-1.6-.99 6 6 0 0 1-1.1-1.38c-.12-.2 0-.31.09-.41.09-.09.2-.23.3-.34.1-.12.13-.2.2-.33.07-.13.03-.25-.02-.35-.05-.1-.45-1.08-.61-1.48-.16-.39-.32-.34-.45-.34h-.38a.74.74 0 0 0-.53.25 2.21 2.21 0 0 0-.7 1.65c0 .97.71 1.91.81 2.05.1.13 1.4 2.13 3.39 2.99.47.2.85.32 1.14.41.48.15.92.13 1.26.08.39-.06 1.18-.48 1.35-.95.16-.47.16-.87.12-.95-.05-.08-.18-.13-.38-.23Z" />
    </svg>
  ),
  email: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  ),
  arrowRight: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  ),
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  calendar: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  euro: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10h12M4 14h9" />
      <path d="M19 5a7 7 0 1 0 0 14" />
    </svg>
  ),
};

type Styles = Record<string, React.CSSProperties>;
type ColorTokens = ReturnType<typeof getClientsColors>;

function StatCard({
  label,
  value,
  hint,
  icon,
  iconBg,
  iconColor,
  s,
}: Readonly<{
  label: string;
  value: number | string;
  hint: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  s: Styles;
}>) {
  return (
    <div style={s.statCard}>
      <div style={s.statTopRow}>
        <span style={s.statLabel}>{label}</span>
        <span style={{ ...s.statIcon, background: iconBg, color: iconColor }}>{icon}</span>
      </div>
      <div style={s.statValue}>{value}</div>
      <span style={s.statHint}>{hint}</span>
    </div>
  );
}

function ClientListItem({
  client,
  isActive,
  isHovered,
  onSelect,
  onHover,
  s,
  c,
}: Readonly<{
  client: Client;
  isActive: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onHover: (_hov: boolean) => void;
  s: Styles;
  c: ColorTokens;
}>) {
  const avatar = pickAvatarColor(client.id || client.fullName, c.isDark);

  let itemStyle: React.CSSProperties = { ...s.listItem };
  if (isActive) itemStyle = { ...itemStyle, ...s.listItemActive };
  else if (isHovered) itemStyle = { ...itemStyle, ...s.listItemHover };

  return (
    <button
      type="button"
      style={itemStyle}
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <span style={{ ...s.listItemAvatar, background: avatar.bg, color: avatar.fg }}>
        {getInitials(client.fullName)}
      </span>
      <div style={s.listItemContent}>
        <span style={s.listItemName}>{client.fullName}</span>
        <span style={s.listItemMeta}>
          {client.totalBookings} booking{client.totalBookings !== 1 ? 's' : ''} · {formatEUR(client.totalSpentCents)}
        </span>
      </div>
      {client.upcomingBookings > 0 ? (
        <span
          style={{
            ...s.badgeSm,
            background: c.primaryBg,
            color: c.primaryStrong,
          }}
        >
          <span style={{ ...s.badgeDot, background: c.primary }} />
          {client.upcomingBookings} upcoming
        </span>
      ) : null}
    </button>
  );
}

function ClientDetail({
  client,
  s,
  c,
  onNewBooking,
}: Readonly<{ client: Client | null; s: Styles; c: ColorTokens; onNewBooking: () => void }>) {
  if (!client) {
    return (
      <div style={s.emptyState}>
        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: c.text }}>No client selected</div>
        <div>Pick a client from the list to see details.</div>
      </div>
    );
  }

  const lastBookingDate = client.lastBookingDate ? new Date(client.lastBookingDate) : null;
  const joinedDate = new Date(client.createdAt);
  const avatar = pickAvatarColor(client.id || client.fullName, c.isDark);
  const waHref = client.phone
    ? `https://wa.me/${client.phone.replace(/[^0-9]/g, '')}`
    : null;

  return (
    <>
      <div style={s.detailHeader}>
        <div style={s.detailHeaderLeft}>
          <span style={{ ...s.detailAvatar, background: avatar.bg, color: avatar.fg }}>
            {getInitials(client.fullName)}
          </span>
          <div style={s.detailHeaderText}>
            <div style={s.detailTitleRow}>
              <span style={s.detailTitle}>{client.fullName}</span>
              {client.upcomingBookings > 0 ? (
                <span
                  style={{
                    ...s.badge,
                    background: c.primaryBg,
                    color: c.primaryStrong,
                  }}
                >
                  <span style={{ ...s.badgeDot, background: c.primary }} />
                  {client.upcomingBookings} upcoming
                </span>
              ) : null}
            </div>
            <span style={s.detailSubtitle}>
              Joined {joinedDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>
        <div style={s.detailActions}>
          <a
            href={waHref ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!waHref}
            title={waHref ? 'Open WhatsApp chat' : 'No phone number on file'}
            style={{
              ...s.secondaryButton,
              textDecoration: 'none',
              ...(waHref ? {} : { opacity: 0.5, pointerEvents: 'none' }),
            }}
          >
            {ICONS.whatsapp} WhatsApp
          </a>
          <a
            href={`mailto:${client.email}`}
            title={`Email ${client.email}`}
            style={{ ...s.secondaryButton, textDecoration: 'none' }}
          >
            {ICONS.email} Email
          </a>
          <button type="button" style={s.invertedPrimaryButton} onClick={onNewBooking}>
            {ICONS.plus} New booking
          </button>
        </div>
      </div>

      <div style={s.detailBody}>
        <div style={s.statsGrid}>
          <div style={s.statBox}>
            <span style={s.statBoxLabel}>Total spent</span>
            <span style={s.statBoxValue}>{formatEUR(client.totalSpentCents)}</span>
          </div>
          <div style={s.statBox}>
            <span style={s.statBoxLabel}>Bookings</span>
            <span style={s.statBoxValue}>{client.totalBookings}</span>
          </div>
          <div style={s.statBox}>
            <span style={s.statBoxLabel}>Upcoming</span>
            <span style={s.statBoxValue}>{client.upcomingBookings}</span>
          </div>
          <div style={s.statBox}>
            <span style={s.statBoxLabel}>Last session</span>
            <span style={s.statBoxValue}>
              {lastBookingDate
                ? lastBookingDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : '—'}
            </span>
          </div>
        </div>

        <div style={s.section}>
          <span style={s.sectionTitle}>Contact information</span>
          <div style={s.sectionCard}>
            <div style={s.infoGrid}>
              <div style={s.infoRow}>
                <span style={s.infoLabel}>Email</span>
                <span style={s.infoValue}>{client.email}</span>
              </div>
              <div style={s.infoRow}>
                <span style={s.infoLabel}>Phone</span>
                <span style={s.infoValue}>{client.phone || '—'}</span>
              </div>
              <div style={s.infoRow}>
                <span style={s.infoLabel}>Joined</span>
                <span style={s.infoValue}>
                  {joinedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div style={s.section}>
          <span style={s.sectionTitle}>Client notes</span>
          <div style={s.notesReadonly}>
            {client.notes?.trim()
              ? client.notes
              : 'No notes added for this client yet.'}
          </div>
          <span style={s.notesHint}>Editing client notes is coming soon.</span>
        </div>
      </div>
    </>
  );
}

function ClientListSkeleton({ s }: Readonly<{ s: Styles }>) {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={s.skeletonItem}>
          <div style={{ ...s.skeletonBlock, width: 44, height: 44, borderRadius: 12 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ ...s.skeletonBlock, height: 12, width: '60%' }} />
            <div style={{ ...s.skeletonBlock, height: 10, width: '40%' }} />
          </div>
        </div>
      ))}
    </>
  );
}

export default function ClientsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useThemeStore();
  const themeKey: ClientsTheme = theme === 'dark' ? 'dark' : 'light';
  const s = useMemo(() => getClientsStyles(themeKey), [themeKey]);
  const c = useMemo(() => getClientsColors(themeKey), [themeKey]);

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<ClientFilter>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadClients = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get<Client[]>('/api/clients')
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setClients(list);
        const selected = searchParams.get('selected');
        setSelectedClientId(selected ?? list[0]?.id ?? null);
      })
      .catch(() => setError('We couldn’t load your clients. Please check your connection and try again.'))
      .finally(() => setLoading(false));
  }, [searchParams]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const filteredClients = useMemo(() => {
    let list = clients;
    if (filterStatus === 'Active') list = list.filter((cl) => cl.upcomingBookings > 0);
    else if (filterStatus === 'Repeat') list = list.filter((cl) => cl.totalBookings > 1);

    const q = searchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter((cl) => {
        const haystack = `${cl.fullName} ${cl.email}`.toLowerCase();
        return haystack.includes(q);
      });
    }
    return list;
  }, [clients, filterStatus, searchTerm]);

  const selectedClient = useMemo(
    () => filteredClients.find((cl) => cl.id === selectedClientId) || filteredClients[0] || null,
    [filteredClients, selectedClientId],
  );

  const stats = useMemo(() => {
    const total = clients.length;
    const active = clients.filter((cl) => cl.upcomingBookings > 0).length;
    const totalRevenueCents = clients.reduce((sum, cl) => sum + cl.totalSpentCents, 0);
    const avgSpendCents = total > 0 ? Math.round(totalRevenueCents / total) : 0;
    return { total, active, totalRevenueCents, avgSpendCents };
  }, [clients]);

  return (
    <div style={s.pageWrapper}>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
      <div style={s.pageHeader}>
        <div>
          <h1 style={s.pageTitle}>Clients</h1>
          <p style={s.pageSubtitle}>
            Manage client relationships, track sessions, and build lasting connections.
          </p>
        </div>
        <div style={s.headerActions}>
          <button
            type="button"
            style={s.invertedPrimaryButton}
            onClick={() => router.push('/bookings')}
          >
            {ICONS.plus} New booking
          </button>
        </div>
      </div>

      <div style={s.summaryRow}>
        <StatCard
          label="Total clients"
          value={stats.total}
          hint={`${formatEUR(stats.totalRevenueCents)} lifetime revenue`}
          icon={ICONS.users}
          iconBg={c.primaryBg}
          iconColor={c.primaryStrong}
          s={s}
        />
        <StatCard
          label="Active bookings"
          value={stats.active}
          hint="Clients with upcoming sessions"
          icon={ICONS.calendar}
          iconBg={c.primaryBg}
          iconColor={c.primaryStrong}
          s={s}
        />
        <StatCard
          label="Average spend"
          value={formatEUR(stats.avgSpendCents)}
          hint="Per client lifetime"
          icon={ICONS.euro}
          iconBg={c.primaryBg}
          iconColor={c.primaryStrong}
          s={s}
        />
      </div>

      {error ? (
        <div style={{ ...s.listPanel, maxHeight: 'none' }}>
          <div style={s.errorPanel}>
            <div style={s.errorPanelTitle}>Couldn&apos;t load clients</div>
            <div style={s.errorPanelText}>{error}</div>
            <button type="button" style={s.retryButton} onClick={loadClients}>
              Try again
            </button>
          </div>
        </div>
      ) : (
        <div style={s.container}>
          <div style={s.listPanel}>
            <div style={s.listHeader}>
              <span style={s.listTitle}>All clients</span>
              <span style={s.listSubtitle}>Sorted by recent activity · spend & bookings at a glance</span>
              <div style={s.searchWrapper}>
                <span style={s.searchIcon}>{ICONS.search}</span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search name or email…"
                  style={s.searchBox}
                />
              </div>
            </div>

            <div style={s.filterTabs}>
              {(['All', 'Active', 'Repeat'] as ClientFilter[]).map((status) => {
                const isActive = filterStatus === status;
                return (
                  <button
                    type="button"
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    style={{
                      ...s.filterTab,
                      ...(isActive ? s.filterTabActive : {}),
                    }}
                  >
                    {status}
                  </button>
                );
              })}
            </div>

            <div style={s.listScroll}>
              {loading ? (
                <ClientListSkeleton s={s} />
              ) : clients.length === 0 ? (
                <div style={s.emptyState}>
                  <div style={{ color: c.text, fontWeight: 600 }}>No clients yet</div>
                  <div>Clients appear here automatically once you create their first booking.</div>
                  <button
                    type="button"
                    style={{ ...s.primaryButton, marginTop: '4px' }}
                    onClick={() => router.push('/bookings')}
                  >
                    {ICONS.plus} New booking
                  </button>
                </div>
              ) : filteredClients.length === 0 ? (
                <div style={s.emptyState}>
                  <div style={{ color: c.text, fontWeight: 600 }}>No clients match</div>
                  <div>Try a different filter or search term.</div>
                </div>
              ) : (
                filteredClients.map((client) => (
                  <ClientListItem
                    key={client.id}
                    client={client}
                    isActive={selectedClient?.id === client.id}
                    isHovered={hoveredId === client.id}
                    onSelect={() => setSelectedClientId(client.id)}
                    onHover={(hov) => setHoveredId(hov ? client.id : null)}
                    s={s}
                    c={c}
                  />
                ))
              )}
            </div>
          </div>

          <div style={s.detailPanel}>
            {loading ? (
              <div style={s.emptyState}>Loading client details…</div>
            ) : (
              <ClientDetail
                client={selectedClient}
                s={s}
                c={c}
                onNewBooking={() => router.push('/bookings')}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
