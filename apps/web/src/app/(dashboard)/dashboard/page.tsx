'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import api from '@/lib/api';
import { Booking, Lead } from '@/types/api';
import { getBookingStatusMeta, toneToVisual } from '@/lib/booking-status';
import { getInitials, pickAvatarColor } from '@/lib/avatar';
import { useRouter } from 'next/navigation';
import {
  getDashboardColors,
  getDashboardStyles,
} from './dashboard.styles';

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
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  trending: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  arrowUp: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  ),
  plus: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  arrowRight: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  ),
};

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const theme = useThemeStore((s) => s.theme);
  const role = user?.role?.toUpperCase();
  const isPhotographer = role === 'PHOTOGRAPHER' || role === 'ADMIN';

  const styles = useMemo(() => getDashboardStyles(theme), [theme]);
  const colors = useMemo(() => getDashboardColors(theme), [theme]);

  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  useEffect(() => {
    Promise.allSettled([
      api.get<Booking[]>('/api/photographerBookings?size=50'),
      api.get<Lead[]>('/api/leads'),
    ]).then(([bookingsRes, leadsRes]) => {
      setBookings(
        bookingsRes.status === 'fulfilled' && Array.isArray(bookingsRes.value.data)
          ? bookingsRes.value.data
          : [],
      );
      setLeads(
        leadsRes.status === 'fulfilled' && Array.isArray(leadsRes.value.data)
          ? leadsRes.value.data
          : [],
      );
      setLoading(false);
    });
  }, []);

  const kpis = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthBookings = bookings.filter(b => new Date(b.eventDate) >= monthStart);
    const revenue = bookings
      .filter(b => b.status !== 'CANCELLED')
      .reduce((sum, b) => sum + (b.totalAmountCents || 0), 0);
    const activeClients = new Set(
      bookings.filter(b => b.status !== 'CANCELLED' && b.status !== 'COMPLETED').map(b => b.clientEmail),
    ).size;
    const newLeads = leads.filter(l => l.status === 'NEW').length;
    return { thisMonth: thisMonthBookings.length, revenue, activeClients, newLeads };
  }, [bookings, leads]);

  const upcomingBookings = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return bookings
      .filter((b) => {
        if (b.status === 'CANCELLED' || b.status === 'COMPLETED') return false;
        return new Date(b.eventDate) >= now;
      })
      .sort(
        (a, b) =>
          new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime(),
      )
      .slice(0, 4);
  }, [bookings]);

  const sortedLeads = useMemo(() => {
    return [...leads]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 4);
  }, [leads]);

  const getMonthShort = (date: string) =>
    new Date(date)
      .toLocaleDateString('en-US', { month: 'short' })
      .toUpperCase();
  const getDay = (date: string) => new Date(date).getDate();

  const formatBudget = (range?: string | null) => {
    switch (range) {
      case 'OVER_1000':
        return '€1000+';
      case '500_1000':
        return '€500–999';
      case '200_500':
        return '€200–499';
      case 'UNDER_200':
        return 'under €200';
      default:
        return '—';
    }
  };

  const formatEventType = (type: string) =>
    type
      ? type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()
      : 'Event';

  const getBookingStatusStyle = (status: string) => {
    const meta = getBookingStatusMeta(status);
    return { ...toneToVisual(meta.tone, colors), label: meta.label };
  };

  const getLeadScoreStyle = (score: string) => {
    if (score === 'HIGH') {
      return {
        bg: colors.successBg,
        color: colors.successText,
        dot: colors.success,
        label: 'High',
      };
    }
    if (score === 'MED') {
      return {
        bg: colors.warningBg,
        color: colors.warningText,
        dot: colors.warning,
        label: 'Medium',
      };
    }
    return {
      bg: colors.neutralBg,
      color: colors.neutralText,
      dot: colors.neutral,
      label: 'Low',
    };
  };

  if (!isPhotographer) {
    return (
      <div style={styles.main}>
        <div style={styles.pageHeader}>
          <div>
            <h1 style={styles.pageTitle}>
              Welcome back, {user?.fullName ?? user?.email}
            </h1>
            <p style={styles.pageSubtitle}>
              View your upcoming bookings and galleries.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.main}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
        @media (max-width: 960px) {
          .dash-metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .dash-section-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 520px) {
          .dash-metric-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Header */}
      <header style={styles.pageHeader}>
        <div style={{ minWidth: 0 }}>
          <h1 style={styles.pageTitle}>
            Welcome back, {user?.fullName ?? user?.email}
            {user?.tenant?.plan && (
              <span style={styles.planBadge}>{user.tenant.plan} Plan</span>
            )}
          </h1>
          <p style={styles.pageSubtitle}>
            Here&apos;s your studio overview
            {user?.tenant?.subdomain && (
              <>
                <span aria-hidden style={{ color: colors.textSubtle }}>•</span>
                <span style={styles.subdomainChip}>
                  {user.tenant.subdomain}
                </span>
              </>
            )}
          </p>
        </div>
        <div style={styles.headerActions}>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={() => router.push('/portfolio')}
            onMouseEnter={(e) => { e.currentTarget.style.background = colors.surfaceHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = colors.surface; }}
          >
            View portfolio
          </button>
          <button
            type="button"
            style={styles.primaryButton}
            onClick={() => router.push('/bookings')}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            {ICONS.plus}
            Create booking
          </button>
        </div>
      </header>

      {/* Metrics Grid */}
      <div className="dash-metric-grid" style={styles.metricGrid}>
        <MetricCard
          styles={styles}
          colors={colors}
          label="Bookings this month"
          value={String(kpis.thisMonth)}
          iconBg={colors.primaryBg}
          iconColor={colors.primaryStrong}
          icon={ICONS.calendar}
        />
        <MetricCard
          styles={styles}
          colors={colors}
          label="Total revenue"
          value={`€${(kpis.revenue / 100).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          iconBg={colors.primaryBg}
          iconColor={colors.primaryStrong}
          icon={ICONS.euro}
        />
        <MetricCard
          styles={styles}
          colors={colors}
          label="Active clients"
          value={String(kpis.activeClients)}
          iconBg={colors.primaryBg}
          iconColor={colors.primaryStrong}
          icon={ICONS.users}
        />
        <MetricCard
          styles={styles}
          colors={colors}
          label="New leads"
          value={String(kpis.newLeads)}
          iconBg={colors.primaryBg}
          iconColor={colors.primaryStrong}
          icon={ICONS.trending}
        />
      </div>

      {/* Upcoming bookings + recent leads */}
      <div className="dash-section-grid" style={styles.sectionGrid}>
        {/* Upcoming Bookings */}
        <section style={styles.sectionCard} aria-labelledby="upcoming-bookings">
          <div style={styles.cardHeader}>
            <h3 id="upcoming-bookings" style={styles.cardTitle}>
              Upcoming bookings
            </h3>
            <Link
              href="/bookings"
              style={styles.cardLink}
              onMouseEnter={(e) => {
                e.currentTarget.style.gap = '8px';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.gap = '4px';
              }}
            >
              View all {ICONS.arrowRight}
            </Link>
          </div>

          {loading ? (
            <ListSkeleton styles={styles} colors={colors} kind="booking" />
          ) : upcomingBookings.length === 0 ? (
            <div style={styles.emptyState}>No upcoming bookings.</div>
          ) : (
            <div style={styles.listContainer}>
              {upcomingBookings.map((booking, idx) => {
                const status = getBookingStatusStyle(booking.status);
                const rowKey = `b-${booking.id}`;
                const isHovered = hoveredRow === rowKey;
                return (
                  <div
                    key={booking.id}
                    style={{
                      ...styles.listRow,
                      ...(idx > 0 ? styles.listRowDivider : {}),
                      background: isHovered
                        ? colors.surfaceHover
                        : 'transparent',
                    }}
                    onMouseEnter={() => setHoveredRow(rowKey)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <div style={styles.listRowLeft}>
                      <div style={styles.bookingDatePill}>
                        <span style={styles.bookingDateMonth}>
                          {getMonthShort(booking.eventDate)}
                        </span>
                        <span style={styles.bookingDateDay}>
                          {getDay(booking.eventDate)}
                        </span>
                      </div>
                      <div style={styles.rowMetaInfo}>
                        <div style={styles.rowName}>{booking.clientName}</div>
                        <div style={styles.rowMeta}>
                          {booking.eventType || 'Event'}
                          {booking.location ? ` • ${booking.location}` : ''}
                        </div>
                      </div>
                    </div>
                    <span
                      style={{
                        ...styles.badge,
                        background: status.bg,
                        color: status.color,
                      }}
                    >
                      <span
                        style={{
                          ...styles.badgeDot,
                          background: status.dot,
                        }}
                      />
                      {status.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent Leads */}
        <section style={styles.sectionCard} aria-labelledby="recent-leads">
          <div style={styles.cardHeader}>
            <h3 id="recent-leads" style={styles.cardTitle}>
              Recent leads
            </h3>
            <Link
              href="/leads"
              style={styles.cardLink}
              onMouseEnter={(e) => {
                e.currentTarget.style.gap = '8px';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.gap = '4px';
              }}
            >
              View all {ICONS.arrowRight}
            </Link>
          </div>

          {loading ? (
            <ListSkeleton styles={styles} colors={colors} kind="lead" />
          ) : sortedLeads.length === 0 ? (
            <div style={styles.emptyState}>No recent leads.</div>
          ) : (
            <div style={styles.listContainer}>
              {sortedLeads.map((lead, idx) => {
                const score = getLeadScoreStyle(lead.score);
                const palette = pickAvatarColor(lead.id, colors.isDark);
                const rowKey = `l-${lead.id}`;
                const isHovered = hoveredRow === rowKey;
                return (
                  <div
                    key={lead.id}
                    style={{
                      ...styles.listRow,
                      ...(idx > 0 ? styles.listRowDivider : {}),
                      background: isHovered
                        ? colors.surfaceHover
                        : 'transparent',
                    }}
                    onMouseEnter={() => setHoveredRow(rowKey)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <div style={styles.listRowLeft}>
                      <div
                        style={{
                          ...styles.avatarBubble,
                          background: palette.bg,
                          color: palette.fg,
                        }}
                        aria-hidden
                      >
                        {getInitials(lead.name)}
                      </div>
                      <div style={styles.rowMetaInfo}>
                        <div style={styles.rowName}>{lead.name}</div>
                        <div style={styles.rowMeta}>
                          {formatEventType(lead.eventType)} •{' '}
                          {formatBudget(lead.budgetRange)}
                        </div>
                      </div>
                    </div>
                    <span
                      style={{
                        ...styles.badge,
                        background: score.bg,
                        color: score.color,
                      }}
                    >
                      <span
                        style={{
                          ...styles.badgeDot,
                          background: score.dot,
                        }}
                      />
                      {score.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

type MetricCardProps = {
  styles: Record<string, React.CSSProperties>;
  colors: ReturnType<typeof getDashboardColors>;
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
};

function MetricCard({
  styles,
  colors,
  label,
  value,
  icon,
  iconBg,
  iconColor,
}: MetricCardProps) {
  const [hover, setHover] = useState(false);
  return (
    <div
      style={{
        ...styles.metricCard,
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hover ? colors.elevatedShadow : colors.overlayShadow,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={styles.metricTopRow}>
        <span style={styles.metricLabel}>{label}</span>
        <span
          style={{
            ...styles.metricIcon,
            background: iconBg,
            color: iconColor,
          }}
          aria-hidden
        >
          {icon}
        </span>
      </div>
      <div style={styles.metricValue}>{value}</div>
    </div>
  );
}

type ListSkeletonProps = {
  styles: Record<string, React.CSSProperties>;
  colors: ReturnType<typeof getDashboardColors>;
  kind: 'booking' | 'lead';
};

function ListSkeleton({ styles, kind }: ListSkeletonProps) {
  return (
    <div style={styles.skeleton}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={styles.skeletonRow}>
          <div
            style={{
              ...styles.skeletonBlock,
              width: kind === 'booking' ? 56 : 36,
              height: kind === 'booking' ? 56 : 36,
              borderRadius: kind === 'booking' ? 12 : 18,
            }}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div
              style={{
                ...styles.skeletonBlock,
                height: 12,
                width: '55%',
                borderRadius: 6,
              }}
            />
            <div
              style={{
                ...styles.skeletonBlock,
                height: 10,
                width: '35%',
                borderRadius: 6,
              }}
            />
          </div>
          <div
            style={{
              ...styles.skeletonBlock,
              height: 22,
              width: 70,
              borderRadius: 999,
            }}
          />
        </div>
      ))}
    </div>
  );
}
