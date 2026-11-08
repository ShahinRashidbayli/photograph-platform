'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useAuthStore, useIsPhotographer } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { parseApiDate, startOfToday } from '@/lib/date';
import { useBookings } from '@/hooks/useBookings';
import { useLeads } from '@/hooks/useLeads';
import { Lead } from '@/types/api';
import { getBookingStatusMeta, isBillableStatus, toneToVisual } from '@/lib/booking-status';
import { getInitials, pickAvatarColor } from '@/lib/avatar';
import { useTranslation } from '@/lib/i18n';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { getDashboardColors, getDashboardStyles } from './dashboard.styles';

const ICONS = {
  plus: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  arrowRight: (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  ),
};

/** Stable while the query has no data, so the KPI memo does not recompute every render. */
const NO_LEADS: Lead[] = [];

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const theme = useThemeStore((s) => s.theme);
  const isPhotographer = useIsPhotographer();
  const { t, tPlural, format } = useTranslation();

  const styles = useMemo(() => getDashboardStyles(theme), [theme]);
  const colors = useMemo(() => getDashboardColors(theme), [theme]);

  const router = useRouter();
  // Every KPI below is a sum or a count over these two lists, so a truncated
  // list is not a shorter screen — it is a wrong number, silently. Bookings
  // came back capped at 50 and leads at the API's default of 20, so a studio
  // past either threshold saw understated revenue, collected and client
  // counts with nothing to indicate it.
  //
  // useBookings already pages through the whole list (and caches it, so the
  // bookings screen and this one share one fetch); leads get the same
  // treatment inside useLeads, whose cache the leads screen shares.
  const { data: bookingsData, isLoading: bookingsLoading } = useBookings(true);
  const bookings = useMemo(() => bookingsData ?? [], [bookingsData]);
  // Best-effort: a failed leads read shows as no leads rather than an error
  // over KPIs that mostly come from bookings.
  const { data: leadsData, isLoading: leadsLoading } = useLeads();
  const leads = leadsData ?? NO_LEADS;
  const loading = bookingsLoading || leadsLoading;

  const kpis = useMemo(() => {
    const now = startOfToday();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthBookings = bookings.filter((b) => parseApiDate(b.eventDate) >= monthStart);
    const billable = bookings.filter((b) => isBillableStatus(b.status));
    const revenue = billable.reduce((sum, b) => sum + (b.totalAmountCents || 0), 0);
    // Collected must reflect what's actually been paid (derived server-side from
    // real invoice/payment rows), not the quoted deposit — otherwise an accepted
    // but unpaid booking shows its deposit as already banked.
    const collected = billable.reduce((sum, b) => sum + (b.amountPaidCents ?? 0), 0);
    const activeClients = new Set(
      billable.filter((b) => b.status !== 'COMPLETED').map((b) => b.clientEmail)
    ).size;
    const upcoming = billable.filter(
      (b) => b.status !== 'COMPLETED' && parseApiDate(b.eventDate) >= now
    ).length;
    const newLeads = leads.filter((l) => l.status === 'NEW').length;
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
    const now = startOfToday();
    return bookings
      .filter((b) => {
        if (!isBillableStatus(b.status) || b.status === 'COMPLETED') return false;
        return parseApiDate(b.eventDate) >= now;
      })
      .sort((a, b) => parseApiDate(a.eventDate).getTime() - parseApiDate(b.eventDate).getTime())
      .slice(0, 4);
  }, [bookings]);

  const sortedLeads = useMemo(() => {
    return [...leads]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
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
            <p style={styles.pageSubtitle}>{t('dashboard.clientSubtitle')}</p>
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
        .dash-metric-grid > * + * { border-left: 1px solid var(--dash-divider); }
        @media (max-width: 960px) {
          .dash-metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .dash-metric-grid > :nth-child(3) { border-left: none; }
          .dash-metric-grid > :nth-child(n + 3) { border-top: 1px solid var(--dash-divider); }
          .dash-section-grid { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>

      {/* Header */}
      <header style={styles.pageHeader}>
        <div style={{ minWidth: 0 }}>
          <h1 style={styles.pageTitle}>
            {t('dashboard.welcome', { name: user?.fullName ?? user?.email ?? '' })}
          </h1>
          <p style={styles.pageSubtitle}>
            {t('dashboard.subtitle')}
            {user?.tenant?.subdomain && (
              <>
                <span aria-hidden style={{ color: colors.textSubtle }}>
                  ·
                </span>
                <span style={styles.subdomainChip}>{user.tenant.subdomain}</span>
              </>
            )}
            {user?.tenant?.plan && (
              <span style={styles.planBadge}>
                {t('dashboard.planBadge', { plan: user.tenant.plan })}
              </span>
            )}
          </p>
        </div>
        <div style={styles.headerActions}>
          <Button onClick={() => router.push('/portfolio')}>{t('dashboard.viewPortfolio')}</Button>
          <Button variant="primary" onClick={() => router.push('/bookings')}>
            {ICONS.plus}
            {t('dashboard.createBooking')}
          </Button>
        </div>
      </header>

      {/* Metrics Grid */}
      <div
        className="dash-metric-grid"
        style={{ ...styles.metricGrid, ['--dash-divider' as string]: colors.border }}
      >
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
          trendColor={colors.textMuted}
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
            <Link href="/bookings" style={styles.cardLink} className="dash-card-link">
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
                return (
                  <Link
                    key={booking.id}
                    href={`/bookings?id=${encodeURIComponent(booking.id)}`}
                    className="ui-row-hover"
                    style={{
                      ...styles.listRow,
                      ...(idx > 0 ? styles.listRowDivider : {}),
                      ['--ui-row-hover' as string]: colors.surfaceHover,
                    }}
                  >
                    <div style={styles.listRowLeft}>
                      <div style={styles.bookingDatePill}>
                        <span style={styles.bookingDateMonth}>
                          {format.monthAbbrUpper(booking.eventDate)}
                        </span>
                        <span style={styles.bookingDateDay}>{getDay(booking.eventDate)}</span>
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
                  </Link>
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
            <Link href="/leads" style={styles.cardLink} className="dash-card-link">
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
                return (
                  <Link
                    key={lead.id}
                    href={`/leads?selected=${encodeURIComponent(lead.id)}`}
                    className="ui-row-hover"
                    style={{
                      ...styles.listRow,
                      ...(idx > 0 ? styles.listRowDivider : {}),
                      ['--ui-row-hover' as string]: colors.surfaceHover,
                    }}
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
                          {formatEventType(lead.eventType)} • {formatBudget(lead.budgetRange)}
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
                  </Link>
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

/**
 * One cell of the headline band. Deliberately static — no hover lift — because
 * none of these figures is a link, and a card that rises under the pointer
 * promises a click that does nothing.
 */
function MetricCard({ styles, label, value, trend, trendColor }: MetricCardProps) {
  return (
    <div style={styles.metricCell}>
      <span style={styles.metricLabel}>{label}</span>
      <div style={styles.metricValue} data-numeric>
        {value}
      </div>
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
