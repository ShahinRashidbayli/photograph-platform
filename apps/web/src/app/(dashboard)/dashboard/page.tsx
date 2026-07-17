'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuthStore, useIsPhotographer } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import api from '@/lib/api';
import { Booking, Lead } from '@/types/api';
import { getBookingStatusMeta, toneToVisual } from '@/lib/booking-status';
import { getInitials, pickAvatarColor } from '@/lib/avatar';
import { useTranslation } from '@/lib/i18n';
import { useRouter } from 'next/navigation';
import {
  getDashboardColors,
  getDashboardStyles,
} from './dashboard.styles';

const ICONS = {
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
  const isPhotographer = useIsPhotographer();
  const { t, tPlural, format } = useTranslation();

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
    now.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthBookings = bookings.filter(b => new Date(b.eventDate) >= monthStart);
    const notCancelled = bookings.filter(b => b.status !== 'CANCELLED');
    const revenue = notCancelled.reduce((sum, b) => sum + (b.totalAmountCents || 0), 0);
    const collected = notCancelled.reduce((sum, b) => sum + (b.depositAmountCents || 0), 0);
    const activeClients = new Set(
      bookings.filter(b => b.status !== 'CANCELLED' && b.status !== 'COMPLETED').map(b => b.clientEmail),
    ).size;
    const upcoming = bookings.filter(
      b => b.status !== 'CANCELLED' && b.status !== 'COMPLETED' && new Date(b.eventDate) >= now,
    ).length;
    const newLeads = leads.filter(l => l.status === 'NEW').length;
    return {
      thisMonth: thisMonthBookings.length,
      revenue,
      collected,
      activeClients,
      upcoming,
      newLeads,
      totalLeads: leads.length,
    };
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

  const getDay = (date: string) => new Date(date).getDate();

  const formatBudget = (range?: string | null) => {
    switch (range) {
      case 'OVER_1000':
        return t('budget.OVER_1000');
      case '500_1000':
        return t('budget.500_1000');
      case '200_500':
        return t('budget.200_500');
      case 'UNDER_200':
        return t('budget.UNDER_200');
      default:
        return t('budget.unknown');
    }
  };

  const formatEventType = (type: string) =>
    type
      ? type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()
      : t('dashboard.eventFallback');

  // The tone (colour bucket) still comes from the shared status map; only the
  // label is re-resolved here so the badge follows the active language.
  const getBookingStatusStyle = (status: string) => {
    const meta = getBookingStatusMeta(status);
    return { ...toneToVisual(meta.tone, colors), label: t(meta.labelKey) };
  };

  const getLeadScoreStyle = (score: string) => {
    if (score === 'HIGH') {
      return {
        bg: colors.successBg,
        color: colors.successText,
        dot: colors.success,
        label: t('leadScore.HIGH'),
      };
    }
    if (score === 'MED') {
      return {
        bg: colors.warningBg,
        color: colors.warningText,
        dot: colors.warning,
        label: t('leadScore.MED'),
      };
    }
    return {
      bg: colors.neutralBg,
      color: colors.neutralText,
      dot: colors.neutral,
      label: t('leadScore.LOW'),
    };
  };

  if (!isPhotographer) {
    return (
      <div style={styles.main}>
        <div style={styles.pageHeader}>
          <div>
            <h1 style={styles.pageTitle}>
              {t('dashboard.welcome', { name: user?.fullName ?? user?.email ?? '' })}
            </h1>
            <p style={styles.pageSubtitle}>
              {t('dashboard.clientSubtitle')}
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
            {t('dashboard.welcome', { name: user?.fullName ?? user?.email ?? '' })}
            {user?.tenant?.plan && (
              <span style={styles.planBadge}>{t('dashboard.planBadge', { plan: user.tenant.plan })}</span>
            )}
          </h1>
          <p style={styles.pageSubtitle}>
            {t('dashboard.subtitle')}
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
            {t('dashboard.viewPortfolio')}
          </button>
          <button
            type="button"
            style={styles.primaryButton}
            onClick={() => router.push('/bookings')}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            {ICONS.plus}
            {t('dashboard.createBooking')}
          </button>
        </div>
      </header>

      {/* Metrics Grid */}
      <div className="dash-metric-grid" style={styles.metricGrid}>
        <MetricCard
          styles={styles}
          colors={colors}
          label={t('dashboard.kpi.bookingsThisMonth')}
          value={String(kpis.thisMonth)}
          trend={t('dashboard.kpi.upcomingTotal', { count: kpis.upcoming })}
          trendColor={colors.textMuted}
        />
        <MetricCard
          styles={styles}
          colors={colors}
          label={t('dashboard.kpi.totalRevenue')}
          value={format.eur(kpis.revenue)}
          trend={t('dashboard.kpi.collected', { amount: format.eur(kpis.collected) })}
          trendColor={colors.successText}
        />
        <MetricCard
          styles={styles}
          colors={colors}
          label={t('dashboard.kpi.activeClients')}
          value={String(kpis.activeClients)}
          trend={tPlural('dashboard.kpi.openBooking', kpis.activeClients)}
          trendColor={colors.textMuted}
        />
        <MetricCard
          styles={styles}
          colors={colors}
          label={t('dashboard.kpi.newLeads')}
          value={String(kpis.newLeads)}
          trend={tPlural('dashboard.kpi.leadsTotal', kpis.totalLeads)}
          trendColor={kpis.newLeads > 0 ? colors.warningText : colors.textMuted}
        />
      </div>

      {/* Upcoming bookings + recent leads */}
      <div className="dash-section-grid" style={styles.sectionGrid}>
        {/* Upcoming Bookings */}
        <section style={styles.sectionCard} aria-labelledby="upcoming-bookings">
          <div style={styles.cardHeader}>
            <h3 id="upcoming-bookings" style={styles.cardTitle}>
              {t('dashboard.upcomingBookings')}
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
              {t('dashboard.viewAll')} {ICONS.arrowRight}
            </Link>
          </div>

          {loading ? (
            <ListSkeleton styles={styles} colors={colors} kind="booking" />
          ) : upcomingBookings.length === 0 ? (
            <div style={styles.emptyState}>{t('dashboard.emptyBookings')}</div>
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
                          {format.monthAbbrUpper(booking.eventDate)}
                        </span>
                        <span style={styles.bookingDateDay}>
                          {getDay(booking.eventDate)}
                        </span>
                      </div>
                      <div style={styles.rowMetaInfo}>
                        <div style={styles.rowName}>{booking.clientName}</div>
                        <div style={styles.rowMeta}>
                          {booking.eventType || t('dashboard.eventFallback')}
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
              {t('dashboard.recentLeads')}
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
              {t('dashboard.viewAll')} {ICONS.arrowRight}
            </Link>
          </div>

          {loading ? (
            <ListSkeleton styles={styles} colors={colors} kind="lead" />
          ) : sortedLeads.length === 0 ? (
            <div style={styles.emptyState}>{t('dashboard.emptyLeads')}</div>
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
  // Contextual line under the value, always derived from real data.
  trend?: string;
  trendColor?: string;
};

function MetricCard({
  styles,
  colors,
  label,
  value,
  trend,
  trendColor,
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
      <span style={styles.metricLabel}>{label}</span>
      <div style={styles.metricValue}>{value}</div>
      {trend && (
        <div style={{ ...styles.metricTrend, color: trendColor ?? styles.metricTrend?.color }}>
          {trend}
        </div>
      )}
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
