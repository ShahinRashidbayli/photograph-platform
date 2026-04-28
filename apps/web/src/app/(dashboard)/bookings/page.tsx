'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { Booking } from '@/types/api';
import {
  getBookingsColors,
  getBookingsStyles,
} from './bookings.styles';

type FilterKey = 'all' | 'deposit' | 'confirmed' | 'pending';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'deposit', label: 'Deposit' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'pending', label: 'Pending' },
];

const MOCK_BOOKINGS: Booking[] = [
  {
    id: 'b1',
    clientName: 'Yilmaz & Chen',
    clientEmail: 'yilmaz@example.com',
    eventDate: '2026-04-22',
    eventType: 'Wedding Session',
    location: 'Berlin, Germany',
    totalAmountCents: 120000,
    depositAmountCents: 30000,
    status: 'DEPOSIT_PAID',
    createdAt: '2026-03-20',
  },
  {
    id: 'b2',
    clientName: 'Braun family',
    clientEmail: 'braun@example.com',
    eventDate: '2026-04-26',
    eventType: 'Family Session',
    location: 'Munich, Germany',
    totalAmountCents: 45000,
    depositAmountCents: 45000,
    status: 'CONFIRMED',
    createdAt: '2026-03-15',
  },
  {
    id: 'b3',
    clientName: 'Stefan & Eva',
    clientEmail: 'stefan@example.com',
    eventDate: '2026-05-03',
    eventType: 'Wedding Session',
    location: 'Hamburg, Germany',
    totalAmountCents: 180000,
    depositAmountCents: 45000,
    status: 'DEPOSIT_PAID',
    createdAt: '2026-03-10',
  },
  {
    id: 'b4',
    clientName: 'Lena Hoffmann',
    clientEmail: 'lena@example.com',
    eventDate: '2026-05-12',
    eventType: 'Portrait Session',
    location: 'Cologne, Germany',
    totalAmountCents: 35000,
    depositAmountCents: 0,
    status: 'ENQUIRY',
    createdAt: '2026-04-01',
  },
  {
    id: 'b5',
    clientName: 'Markus Weber',
    clientEmail: 'markus@example.com',
    eventDate: '2026-05-18',
    eventType: 'Corporate Headshots',
    location: 'Frankfurt, Germany',
    totalAmountCents: 92000,
    depositAmountCents: 92000,
    status: 'CONFIRMED',
    createdAt: '2026-04-05',
  },
];

const MOCK_PHONES: Record<string, string> = {
  b1: '+49 176 333 2211',
  b2: '+49 162 444 3322',
  b3: '+49 178 555 4433',
  b4: '+49 151 666 5544',
  b5: '+49 175 777 6655',
};

const MOCK_NOTES: Record<string, string> = {
  b1: 'Wedding ceremony at St. Michael Church, reception at Hotel Adlon. 6 hours coverage. Standard package.',
  b2: 'Outdoor family shoot in English Garden. Two children (ages 4 and 7). Casual style.',
  b3: 'Rooftop venue. Sunset ceremony preferred. Engagement album add-on requested.',
  b4: 'Personal branding portraits for new website. Studio shoot, neutral backdrop.',
  b5: 'Team of 12. Office location. LinkedIn-ready headshots, consistent lighting across all.',
};

const AVATAR_PALETTE_LIGHT = [
  { bg: '#DBEAFE', fg: '#1D4ED8' },
  { bg: '#FCE7F3', fg: '#BE185D' },
  { bg: '#DCFCE7', fg: '#15803D' },
  { bg: '#FEF3C7', fg: '#B45309' },
  { bg: '#EDE9FE', fg: '#6D28D9' },
];
const AVATAR_PALETTE_DARK = [
  { bg: 'rgba(59, 130, 246, 0.22)', fg: '#93C5FD' },
  { bg: 'rgba(236, 72, 153, 0.22)', fg: '#F9A8D4' },
  { bg: 'rgba(16, 185, 129, 0.22)', fg: '#6EE7B7' },
  { bg: 'rgba(217, 119, 6, 0.22)', fg: '#FCD34D' },
  { bg: 'rgba(139, 92, 246, 0.22)', fg: '#C4B5FD' },
];

function pickAvatarColor(seed: string, isDark: boolean) {
  const palette = isDark ? AVATAR_PALETTE_DARK : AVATAR_PALETTE_LIGHT;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length];
}

function getInitials(name: string) {
  const parts = (name ?? '').trim().split(/\s+/);
  return ((parts[0]?.[0] ?? 'U') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function formatEUR(cents: number) {
  return `€${(cents / 100).toLocaleString('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function matchesFilter(booking: Booking, filter: FilterKey) {
  if (filter === 'all') return true;
  if (filter === 'deposit') return booking.status === 'DEPOSIT_PAID';
  if (filter === 'confirmed') return booking.status === 'CONFIRMED';
  if (filter === 'pending') return booking.status === 'ENQUIRY';
  return true;
}

type StatusVisual = {
  bg: string;
  color: string;
  dot: string;
  label: string;
};

function getStatusVisual(
  status: string,
  c: ReturnType<typeof getBookingsColors>,
  variant: 'list' | 'detail' = 'list',
): StatusVisual {
  switch (status) {
    case 'CONFIRMED':
      return {
        bg: c.primaryBg,
        color: c.primaryStrong,
        dot: c.primary,
        label: 'Confirmed',
      };
    case 'DEPOSIT_PAID':
      return {
        bg: c.warningBg,
        color: c.warningText,
        dot: c.warning,
        label: variant === 'detail' ? 'Deposit pending' : 'Deposit',
      };
    case 'FULLY_PAID':
      return {
        bg: c.successBg,
        color: c.successText,
        dot: c.success,
        label: 'Fully paid',
      };
    case 'COMPLETED':
      return {
        bg: c.indigoBg,
        color: c.indigoText,
        dot: c.indigoText,
        label: 'Completed',
      };
    case 'CANCELLED':
      return {
        bg: c.dangerBg,
        color: c.dangerText,
        dot: c.danger,
        label: 'Cancelled',
      };
    case 'ENQUIRY':
    default:
      return {
        bg: c.warningBg,
        color: c.warningText,
        dot: c.warning,
        label: 'Pending',
      };
  }
}

const ICONS = {
  calendar: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="16" y1="2" x2="16" y2="6" />
    </svg>
  ),
  euro: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 7c-1.5-1.5-3.5-2.5-6-2.5C7.5 4.5 4 8 4 12s3.5 7.5 8 7.5c2.5 0 4.5-1 6-2.5" />
      <line x1="3" y1="10" x2="13" y2="10" />
      <line x1="3" y1="14" x2="13" y2="14" />
    </svg>
  ),
  clock: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  search: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
};

export default function BookingsPage() {
  const { theme } = useThemeStore();
  const { user } = useAuthStore();
  const styles = useMemo(() => getBookingsStyles(theme), [theme]);
  const colors = useMemo(() => getBookingsColors(theme), [theme]);

  const [bookings, setBookings] = useState<Booking[]>(MOCK_BOOKINGS);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(MOCK_BOOKINGS[0].id);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  useEffect(() => {
    const role = user?.role?.toUpperCase();
    const isPhotographer = role === 'PHOTOGRAPHER' || role === 'ADMIN';
    const endpoint = isPhotographer
      ? '/api/photographerBookings?size=50'
      : `/api/customerBookings?size=50&clientId=${user?.id}`;

    api
      .get<Booking[]>(endpoint)
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setBookings(res.data);
          setSelectedId(res.data[0].id);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [user?.role, user?.id]);

  const filteredBookings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings.filter((b) => {
      if (!matchesFilter(b, filter)) return false;
      if (!q) return true;
      return (
        b.clientName.toLowerCase().includes(q) ||
        (b.eventType?.toLowerCase().includes(q) ?? false) ||
        (b.location?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [bookings, filter, search]);

  const stats = useMemo(() => {
    const active = bookings.filter(
      (b) => b.status !== 'CANCELLED' && b.status !== 'COMPLETED',
    );
    const revenue = active.reduce((sum, b) => sum + (b.totalAmountCents || 0), 0);
    const pending = active.reduce(
      (sum, b) =>
        sum + Math.max((b.totalAmountCents || 0) - (b.depositAmountCents || 0), 0),
      0,
    );
    return { active: active.length, revenue, pending };
  }, [bookings]);

  const selected = useMemo(
    () =>
      bookings.find((b) => b.id === selectedId) ??
      filteredBookings[0] ??
      bookings[0] ??
      null,
    [bookings, filteredBookings, selectedId],
  );

  if (loading && bookings.length === 0) {
    return (
      <div
        style={{
          ...styles.pageWrapper,
          padding: '60px 28px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '0.95rem', color: colors.textMuted }}>
          Loading bookings...
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageWrapper}>
      <style>{`
        @media (max-width: 1100px) {
          .bk-summary { grid-template-columns: 1fr 1fr !important; }
          .bk-container { grid-template-columns: 1fr !important; }
          .bk-list-panel, .bk-detail-panel { max-height: none !important; }
        }
        @media (max-width: 600px) {
          .bk-summary { grid-template-columns: 1fr !important; }
          .bk-info-grid { grid-template-columns: 1fr !important; }
          .bk-payment-top { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Page header */}
      <header style={styles.pageHeader}>
        <div style={{ minWidth: 0 }}>
          <h1 style={styles.pageTitle}>Bookings</h1>
          <p style={styles.pageSubtitle}>
            Manage all active bookings, payments, and client details in one place.
          </p>
        </div>
        <div style={styles.headerActions}>
          <button
            type="button"
            style={styles.secondaryButton}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.surfaceHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = colors.surface;
            }}
          >
            Calendar
          </button>
          <button
            type="button"
            style={styles.invertedPrimaryButton}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            New booking
          </button>
        </div>
      </header>

      {/* Summary cards */}
      <div className="bk-summary" style={styles.summaryRow}>
        <StatCard
          styles={styles}
          label="Active bookings"
          value={String(stats.active)}
          icon={ICONS.calendar}
          iconBg={colors.primaryBg}
          iconColor={colors.primaryStrong}
        />
        <StatCard
          styles={styles}
          label="Revenue"
          value={formatEUR(stats.revenue)}
          icon={ICONS.euro}
          iconBg={colors.successBg}
          iconColor={colors.successText}
        />
        <StatCard
          styles={styles}
          label="Pending"
          value={formatEUR(stats.pending)}
          icon={ICONS.clock}
          iconBg={colors.warningBg}
          iconColor={colors.warningText}
        />
      </div>

      {/* Master + detail */}
      <div className="bk-container" style={styles.container}>
        {/* List panel */}
        <section className="bk-list-panel" style={styles.listPanel}>
          <div style={styles.listHeader}>
            <div style={styles.listTitle}>Search bookings</div>
            <div style={styles.listSubtitle}>
              Filter and find bookings by status or client.
            </div>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: colors.textMuted,
                  display: 'inline-flex',
                }}
                aria-hidden
              >
                {ICONS.search}
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search bookings..."
                aria-label="Search bookings"
                style={{
                  ...styles.searchBox,
                  paddingLeft: 34,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = colors.primary;
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.primaryBg}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = colors.border;
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          <div style={styles.filterTabs} role="tablist">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(f.key)}
                  style={{
                    ...styles.filterTab,
                    ...(active ? styles.filterTabActive : {}),
                  }}
                  onMouseEnter={(e) => {
                    if (!active)
                      e.currentTarget.style.background = colors.surfaceHover;
                  }}
                  onMouseLeave={(e) => {
                    if (!active)
                      e.currentTarget.style.background = colors.surface;
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <div style={styles.listScroll}>
            {filteredBookings.length === 0 ? (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  color: colors.textMuted,
                  fontSize: '0.875rem',
                }}
              >
                No bookings match these filters.
              </div>
            ) : (
              filteredBookings.map((booking) => (
                <BookingListItem
                  key={booking.id}
                  booking={booking}
                  isActive={selected?.id === booking.id}
                  isHovered={hoveredItem === booking.id}
                  onSelect={() => setSelectedId(booking.id)}
                  onHoverChange={(hov) =>
                    setHoveredItem(hov ? booking.id : null)
                  }
                  styles={styles}
                  colors={colors}
                />
              ))
            )}
          </div>
        </section>

        {/* Detail panel */}
        <section className="bk-detail-panel" style={styles.detailPanel}>
          {selected ? (
            <BookingDetail booking={selected} styles={styles} colors={colors} />
          ) : (
            <div style={styles.emptyState}>
              Select a booking to view details
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

type StatCardProps = {
  styles: Record<string, React.CSSProperties>;
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
};

function StatCard({ styles, label, value, icon, iconBg, iconColor }: StatCardProps) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statTopRow}>
        <span style={styles.statLabel}>{label}</span>
        <span
          style={{
            ...styles.statIcon,
            background: iconBg,
            color: iconColor,
          }}
          aria-hidden
        >
          {icon}
        </span>
      </div>
      <div style={styles.statValue}>{value}</div>
    </div>
  );
}

type ListItemProps = {
  booking: Booking;
  isActive: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onHoverChange: (_hov: boolean) => void;
  styles: Record<string, React.CSSProperties>;
  colors: ReturnType<typeof getBookingsColors>;
};

function BookingListItem({
  booking,
  isActive,
  isHovered,
  onSelect,
  onHoverChange,
  styles,
  colors,
}: ListItemProps) {
  const date = new Date(booking.eventDate);
  const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const day = date.getDate();
  const status = getStatusVisual(booking.status, colors, 'list');
  const subtitle = booking.eventType ?? 'Session';
  const locationOrHint =
    booking.status === 'ENQUIRY'
      ? 'Awaiting deposit'
      : booking.location ?? '';

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      style={{
        ...styles.listItem,
        ...(isHovered && !isActive ? styles.listItemHover : {}),
        ...(isActive ? styles.listItemActive : {}),
      }}
      aria-current={isActive ? 'true' : undefined}
    >
      <div style={styles.listItemDate}>
        <span style={styles.listItemDateMonth}>{month}</span>
        <span style={styles.listItemDateDay}>{day}</span>
      </div>
      <div style={styles.listItemContent}>
        <div style={styles.listItemTopRow}>
          <span style={styles.listItemName}>{booking.clientName}</span>
          <span style={styles.listItemAmount}>
            {formatEUR(booking.totalAmountCents)}
          </span>
        </div>
        <div style={styles.listItemBottomRow}>
          <span style={styles.listItemMeta}>
            {subtitle}
            {locationOrHint ? ` · ${locationOrHint}` : ''}
          </span>
          <span
            style={{
              ...styles.badge,
              background: status.bg,
              color: status.color,
            }}
          >
            <span
              style={{ ...styles.badgeDot, background: status.dot }}
            />
            {status.label}
          </span>
        </div>
      </div>
    </button>
  );
}

type DetailProps = {
  booking: Booking;
  styles: Record<string, React.CSSProperties>;
  colors: ReturnType<typeof getBookingsColors>;
};

function BookingDetail({ booking, styles, colors }: DetailProps) {
  const date = new Date(booking.eventDate);
  const dateLabel = date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const status = getStatusVisual(booking.status, colors, 'detail');
  const total = booking.totalAmountCents;
  const deposit = booking.depositAmountCents || 0;
  const remaining = Math.max(total - deposit, 0);
  const percent = total > 0 ? Math.min(100, Math.round((deposit / total) * 100)) : 0;
  const phone = MOCK_PHONES[booking.id] ?? '—';
  const notes = MOCK_NOTES[booking.id] ?? 'No notes added yet.';
  const palette = pickAvatarColor(booking.id, colors.isDark);

  const progressColor =
    percent === 0 ? colors.warning : percent >= 100 ? colors.success : colors.primary;
  const progressTextColor =
    percent === 0
      ? colors.warningText
      : percent >= 100
        ? colors.successText
        : colors.primaryStrong;

  return (
    <>
      <div style={styles.detailHeader}>
        <div style={styles.detailHeaderLeft}>
          <div
            style={{
              ...styles.detailAvatar,
              background: palette.bg,
              color: palette.fg,
            }}
            aria-hidden
          >
            {getInitials(booking.clientName)}
          </div>
          <div style={styles.detailHeaderText}>
            <div style={styles.detailTitleRow}>
              <span style={styles.detailTitle}>{booking.clientName}</span>
              <span
                style={{
                  ...styles.badge,
                  background: status.bg,
                  color: status.color,
                }}
              >
                <span
                  style={{ ...styles.badgeDot, background: status.dot }}
                />
                {status.label}
              </span>
            </div>
            <div style={styles.detailSubtitle}>
              {booking.eventType ?? 'Session'} · {dateLabel}
              {booking.location ? ` · ${booking.location}` : ''}
            </div>
          </div>
        </div>
        <div style={styles.detailActions}>
          <button
            type="button"
            style={styles.secondaryButton}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.surfaceHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = colors.surface;
            }}
          >
            Edit
          </button>
          <button
            type="button"
            style={styles.primaryButton}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.primarySolidHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = colors.primarySolid;
            }}
          >
            Send message
          </button>
          <button type="button" style={styles.dangerButton}>
            Cancel
          </button>
        </div>
      </div>

      <div style={styles.detailBody}>
        {/* Client info */}
        <section style={styles.section}>
          <div style={styles.sectionTitle}>Client info</div>
          <div className="bk-info-grid" style={styles.infoGrid}>
            <InfoRow
              label="Name"
              value={booking.clientName}
              styles={styles}
            />
            <InfoRow
              label="Email"
              value={booking.clientEmail}
              styles={styles}
            />
            <InfoRow label="Phone" value={phone} styles={styles} />
            <InfoRow
              label="Location"
              value={booking.location ?? '—'}
              styles={styles}
            />
          </div>
        </section>

        {/* Payment */}
        <section style={styles.section}>
          <div style={styles.sectionTitle}>Payment</div>
          <div style={styles.sectionCard}>
            <div className="bk-payment-top" style={styles.paymentTopRow}>
              <div>
                <div style={styles.paymentLabel}>Total</div>
                <div style={styles.paymentValue}>{formatEUR(total)}</div>
              </div>
              <div>
                <div style={styles.paymentLabel}>Status</div>
                <span
                  style={{
                    ...styles.badge,
                    background: status.bg,
                    color: status.color,
                  }}
                >
                  <span
                    style={{ ...styles.badgeDot, background: status.dot }}
                  />
                  {status.label}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={styles.progressMeta}>
                <span style={styles.paymentLabel}>Deposit paid</span>
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: progressTextColor,
                  }}
                >
                  {percent}%
                </span>
              </div>
              <div style={styles.progressTrack}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${Math.max(percent, percent === 0 ? 0 : 4)}%`,
                    background: progressColor,
                  }}
                />
              </div>
              <div style={styles.progressMeta}>
                <span>{formatEUR(deposit)} paid</span>
                <span>{formatEUR(remaining)} remaining</span>
              </div>
            </div>
          </div>
        </section>

        {/* Notes */}
        <section style={styles.section}>
          <div style={styles.sectionTitle}>Notes</div>
          <div style={styles.notesBox}>{notes}</div>
        </section>
      </div>
    </>
  );
}

function InfoRow({
  label,
  value,
  styles,
}: Readonly<{
  label: string;
  value: string;
  styles: Record<string, React.CSSProperties>;
}>) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>{label}</span>
      <span style={styles.infoValue}>{value}</span>
    </div>
  );
}
