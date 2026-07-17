'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useQueryClient } from '@tanstack/react-query';
import { useThemeStore } from '@/store/themeStore';
import { useAuthStore, useIsPhotographer } from '@/store/authStore';
import { useBookings, bookingsQueryKey } from '@/hooks/useBookings';
import api from '@/lib/api';
import { Booking } from '@/types/api';
import { getInitials, pickAvatarColor } from '@/lib/avatar';
import { extractApiError, insertSortedByDate } from '@/lib/helpers';
import {
  getBookingStatusMeta,
  getCustomerBookingStatusLabelKey,
  toneToVisual,
  getAllowedTransitions,
  STATUS_ACTION_LABEL_KEY,
  type BookingStatusKey,
} from '@/lib/booking-status';
import { useTranslation, type TranslationKey } from '@/lib/i18n';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  getBookingsColors,
  getBookingsStyles,
} from './bookings.styles';
import { CustomerBookingDetail } from './CustomerBookingDetail';

// The calendar bundles FullCalendar (~100KB+) and is photographer-only, shown
// only in "calendar" view — load it on demand so it's never in the bookings
// route's initial JS (customers never load it at all).
const BookingsCalendarView = dynamic(
  () => import('./BookingsCalendarView').then((m) => m.BookingsCalendarView),
  {
    ssr: false,
    loading: () => (
      <div style={{ padding: '48px 20px', textAlign: 'center', fontSize: '0.9rem', opacity: 0.6 }}>
        <CalendarLoading />
      </div>
    ),
  },
);

// Modals mount only on user action (New booking / Request a session), so defer
// their code until first opened rather than shipping it in the route bundle.
const CreateBookingModal = dynamic(
  () => import('./CreateBookingModal').then((m) => m.CreateBookingModal),
  { ssr: false },
);
const RequestSessionModal = dynamic(
  () => import('./RequestSessionModal').then((m) => m.RequestSessionModal),
  { ssr: false },
);

// The dynamic import's `loading` slot is plain JSX, not a component body, so
// the translated string is rendered through this tiny component instead.
function CalendarLoading() {
  const { t } = useTranslation();
  return <>{t('bookings.loadingCalendar')}</>;
}

type FilterKey = 'all' | 'deposit' | 'confirmed' | 'pending' | 'completed';

const FILTERS: { key: FilterKey; labelKey: TranslationKey }[] = [
  { key: 'all', labelKey: 'bookings.filter.all' },
  { key: 'deposit', labelKey: 'bookings.filter.deposit' },
  { key: 'confirmed', labelKey: 'bookings.filter.confirmed' },
  { key: 'pending', labelKey: 'bookings.filter.pending' },
  { key: 'completed', labelKey: 'bookings.filter.completed' },
];

function matchesFilter(booking: Booking, filter: FilterKey) {
  if (filter === 'all') return true;
  if (filter === 'deposit') return booking.status === 'DEPOSIT_PAID';
  if (filter === 'confirmed') return booking.status === 'CONFIRMED';
  if (filter === 'pending') return booking.status === 'ENQUIRY';
  if (filter === 'completed') return booking.status === 'COMPLETED';
  return true;
}

function filterCount(bookings: Booking[], filter: FilterKey): number {
  return bookings.filter((b) => matchesFilter(b, filter)).length;
}

type StatusVisual = {
  bg: string;
  color: string;
  dot: string;
  labelKey: TranslationKey;
};

function getStatusVisual(
  status: string,
  c: ReturnType<typeof getBookingsColors>,
  variant: 'list' | 'detail' = 'list',
): StatusVisual {
  const meta = getBookingStatusMeta(status);
  const visual = toneToVisual(meta.tone, c);
  const labelKey =
    variant === 'detail' && meta.detailLabelKey ? meta.detailLabelKey : meta.labelKey;
  return { ...visual, labelKey };
}

const ICONS = {
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

  const isPhotographer = useIsPhotographer();
  const { t, tPlural, format } = useTranslation();

  const queryClient = useQueryClient();
  // Data now comes from React Query: cached, deduped, and shared across mounts.
  // Navigating back within the stale window is instant (no refetch).
  const {
    data: bookings = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useBookings(isPhotographer);
  const error = queryError
    ? extractApiError(queryError, t('bookings.errorLoad'))
    : null;

  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  // Client-side "Request a session" modal (photographer uses showCreate instead).
  const [showRequest, setShowRequest] = useState(false);
  // Date pre-filled into the create modal when it's opened from a calendar day.
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  // Master-pane view mode. The detail panel (status actions, cancel, deposit)
  // stays put on the right in either mode — only the left pane swaps between
  // the searchable list and the FullCalendar grid.
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');

  // Keep the selection valid as data loads or changes: keep the current pick if
  // it still exists, otherwise fall back to the first booking. (Previously this
  // lived inside the fetch; now it reacts to the cached data.)
  useEffect(() => {
    setSelectedId((prev) =>
      prev && bookings.some((b) => b.id === prev) ? prev : bookings[0]?.id ?? null,
    );
  }, [bookings]);

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
    const collected = active.reduce(
      (sum, b) => sum + (b.depositAmountCents || 0),
      0,
    );
    const pending = active.reduce(
      (sum, b) =>
        sum + Math.max((b.totalAmountCents || 0) - (b.depositAmountCents || 0), 0),
      0,
    );
    const confirmed = active.filter((b) => b.status === 'CONFIRMED').length;
    const openBalance = active.filter(
      (b) => (b.totalAmountCents || 0) - (b.depositAmountCents || 0) > 0,
    ).length;
    return {
      active: active.length,
      revenue,
      collected,
      pending,
      confirmed,
      openBalance,
    };
  }, [bookings]);

  // The client's next upcoming (non-cancelled, non-completed) session, used for
  // the "Next session" summary card and the header subtitle countdown.
  const nextSession = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return bookings
      .filter(
        (b) =>
          b.status !== 'CANCELLED' &&
          b.status !== 'COMPLETED' &&
          new Date(b.eventDate) >= today,
      )
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())[0] ?? null;
  }, [bookings]);

  const daysUntilNext = useMemo(() => {
    if (!nextSession) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = new Date(nextSession.eventDate).getTime() - today.getTime();
    return Math.max(0, Math.round(diff / 86_400_000));
  }, [nextSession]);

  // "3 active sessions · next in 5 days" — assembled from parts so each
  // fragment stays a whole translatable sentence rather than a glued-on suffix.
  const clientSubtitle = useMemo(() => {
    const sessions = tPlural('bookings.clientSessions', stats.active);
    if (daysUntilNext == null) return sessions;
    return `${sessions} · ${tPlural('bookings.clientNext', daysUntilNext)}`;
  }, [stats.active, daysUntilNext, tPlural]);

  // Photographer identity for the client's detail footer. Derived from the
  // tenant subdomain until the customer booking API returns the real name.
  const photographerLabel = useMemo(() => {
    const sub = user?.tenant?.subdomain;
    if (!sub) return t('customerBooking.yourPhotographer');
    return sub
      .split(/[-_]/)
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ');
  }, [user?.tenant?.subdomain, t]);

  const selected = useMemo(
    () =>
      bookings.find((b) => b.id === selectedId) ??
      filteredBookings[0] ??
      bookings[0] ??
      null,
    [bookings, filteredBookings, selectedId],
  );

  // Clear any stale action error when the user switches bookings.
  useEffect(() => {
    setActionError(null);
  }, [selectedId]);

  async function performTransition(target: BookingStatusKey) {
    if (!selected) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await api.patch<Booking>(
        `/api/bookings/${selected.id}/status`,
        { status: target },
      );
      queryClient.setQueryData<Booking[]>(bookingsQueryKey(isPhotographer), (old = []) =>
        old.map((b) => (b.id === res.data.id ? res.data : b)),
      );
    } catch (err) {
      setActionError(extractApiError(err, t('bookings.errorUpdateStatus')));
    } finally {
      setActionBusy(false);
    }
  }

  function handleTransition(target: BookingStatusKey) {
    if (!selected || actionBusy) return;
    // Cancelling is destructive — confirm through a styled dialog first.
    if (target === 'CANCELLED') {
      setConfirmCancel(true);
      return;
    }
    performTransition(target);
  }

  function handleCreated(created: Booking) {
    // Write straight into the cache so the new booking appears instantly without
    // a refetch (React Query keeps every subscriber in sync).
    queryClient.setQueryData<Booking[]>(bookingsQueryKey(isPhotographer), (old = []) =>
      insertSortedByDate(old, created),
    );
    setSelectedId(created.id);
    setShowCreate(false);
    setCreateDate(null);
  }

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
          {t('bookings.loading')}
        </div>
      </div>
    );
  }

  // A failed (or forbidden) fetch must not masquerade as an empty calendar.
  if (error && bookings.length === 0) {
    return (
      <div style={styles.pageWrapper}>
        <header style={styles.pageHeader}>
          <div style={{ minWidth: 0 }}>
            <h1 style={styles.pageTitle}>{t('bookings.title')}</h1>
          </div>
        </header>
        <div style={styles.errorPanel}>
          <div style={styles.errorPanelTitle}>{t('bookings.errorTitle')}</div>
          <div style={styles.errorPanelText}>{error}</div>
          <button
            type="button"
            style={styles.primaryButton}
            onClick={() => refetch()}
          >
            {t('bookings.tryAgain')}
          </button>
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
        /* Calendar mode: detail panel becomes a narrow side rail
           (≈320–380px). The 2-column info grid would force long values like
           emails to wrap mid-domain ("thomas.mueller@exa" / "mple.com"); a
           single column lets each value use the rail's full width. */
        .bk-calendar-mode .bk-info-grid { grid-template-columns: 1fr !important; }
        .bk-calendar-mode .bk-payment-top { grid-template-columns: 1fr !important; }
        .bk-calendar-mode .bk-detail-panel .bk-info-value {
          overflow-wrap: anywhere;
        }
        @media (max-width: 600px) {
          .bk-summary { grid-template-columns: 1fr !important; }
          .bk-info-grid { grid-template-columns: 1fr !important; }
          .bk-payment-top { grid-template-columns: 1fr !important; }
          .bk-form-row { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Page header */}
      <header style={styles.pageHeader}>
        <div style={{ minWidth: 0 }}>
          <h1 style={styles.pageTitle}>
            {isPhotographer ? t('bookings.title') : t('bookings.titleClient')}
          </h1>
          <p style={styles.pageSubtitle}>
            {isPhotographer ? t('bookings.subtitle') : clientSubtitle}
          </p>
        </div>
        {!isPhotographer && (
          <div style={styles.headerActions}>
            <button
              type="button"
              style={styles.primaryButton}
              onClick={() => setShowRequest(true)}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              {t('bookings.requestSession')}
            </button>
          </div>
        )}
        {isPhotographer && (
          <div style={styles.headerActions}>
            {/* Master-pane view switcher. Calendar mode swaps the searchable
                list on the left for the FullCalendar grid; the detail panel
                on the right is unaffected, so status actions stay reachable
                in either mode. */}
            <div
              role="tablist"
              aria-label={t('bookings.view.aria')}
              style={{
                display: 'inline-flex',
                padding: '2px',
                borderRadius: '10px',
                border: `1px solid ${colors.border}`,
                background: colors.surface,
                gap: '2px',
              }}
            >
              {(['table', 'calendar'] as const).map((mode) => {
                const active = viewMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setViewMode(mode)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      // Use the muted primary background instead of the solid
                      // primary fill — the segmented control sits next to the
                      // dark "New booking" CTA, and a second saturated blue
                      // pulls the eye away from the actual action.
                      background: active ? colors.primaryBg : 'transparent',
                      color: active ? colors.primaryText : colors.textMuted,
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {mode === 'table' ? t('bookings.view.table') : t('bookings.view.calendar')}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              style={styles.primaryButton}
              onClick={() => setShowCreate(true)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {t('bookings.newBooking')}
            </button>
          </div>
        )}
      </header>

      {/* Summary cards — the photographer sees business metrics (revenue,
          awaiting payment); the client sees their own session/payment view
          framed in personal terms (never "revenue"). */}
      <div className="bk-summary" style={styles.summaryRow}>
        {isPhotographer ? (
          <>
            <StatCard
              styles={styles}
              colors={colors}
              label={t('bookings.stat.active')}
              value={String(stats.active)}
              trend={t('bookings.stat.activeTrend', {
                confirmed: stats.confirmed,
                progress: Math.max(stats.active - stats.confirmed, 0),
              })}
              trendColor={colors.textMuted}
            />
            <StatCard
              styles={styles}
              colors={colors}
              label={t('bookings.stat.revenue')}
              value={format.eur(stats.revenue)}
              trend={t('bookings.stat.revenueTrend', { amount: format.eur(stats.collected) })}
              trendColor={colors.successText}
            />
            <StatCard
              styles={styles}
              colors={colors}
              label={t('bookings.stat.awaiting')}
              value={format.eur(stats.pending)}
              trend={
                stats.openBalance === 0
                  ? t('bookings.stat.allBalancesSettled')
                  : tPlural('bookings.stat.openBalance', stats.openBalance)
              }
              trendColor={stats.openBalance === 0 ? colors.successText : colors.warningText}
            />
          </>
        ) : (
          <>
            <StatCard
              styles={styles}
              colors={colors}
              label={t('bookings.stat.nextSession')}
              value={nextSession ? format.dayMonth(nextSession.eventDate) : '—'}
              trend={
                nextSession
                  ? [
                      nextSession.eventType ?? t('bookings.sessionFallback'),
                      daysUntilNext == null
                        ? null
                        : tPlural('bookings.stat.inDays', daysUntilNext),
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : t('bookings.stat.noneScheduled')
              }
              trendColor={colors.textMuted}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              }
            />
            <StatCard
              styles={styles}
              colors={colors}
              label={t('bookings.stat.paidSoFar')}
              value={format.eur(stats.collected)}
              trend={t('bookings.stat.ofTotal', { amount: format.eur(stats.revenue) })}
              trendColor={colors.textMuted}
              bar={stats.revenue > 0 ? Math.round((stats.collected / stats.revenue) * 100) : 0}
              barColor={colors.success}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M14.6 9.4c-.7-.7-1.6-1.1-2.6-1.1-2 0-3.6 1.65-3.6 3.7s1.6 3.7 3.6 3.7c1 0 1.9-.4 2.6-1.1" />
                  <path d="M7.6 11h5M7.6 13h4.4" />
                </svg>
              }
            />
            <StatCard
              styles={styles}
              colors={colors}
              label={t('bookings.stat.outstanding')}
              value={format.eur(stats.pending)}
              trend={stats.pending === 0 ? t('bookings.stat.allSettled') : t('bookings.stat.dueBefore')}
              trendColor={stats.pending === 0 ? colors.successText : colors.warningText}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
              }
            />
          </>
        )}
      </div>

      {/* Master + detail. In calendar mode we flip the column ratio so the
          calendar gets the lion's share of the width — the table-mode pinning
          (a narrow 320–380px list) leaves the calendar so cramped that event
          titles truncate mid-word. The detail panel stays as a side rail on
          the right; status actions remain reachable. */}
      <div
        className={`bk-container${viewMode === 'calendar' ? ' bk-calendar-mode' : ''}`}
        style={{
          ...styles.container,
          ...(viewMode === 'calendar'
            ? { gridTemplateColumns: 'minmax(0, 2.2fr) minmax(320px, 1fr)' }
            : {}),
        }}
      >
        {/* List panel */}
        {viewMode === 'calendar' ? (
          <BookingsCalendarView
            bookings={bookings}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
            onDateClick={
              isPhotographer
                ? (dateStr) => {
                    setCreateDate(dateStr);
                    setShowCreate(true);
                  }
                : undefined
            }
            colors={colors}
            isDark={theme === 'dark'}
          />
        ) : (
        <section className="bk-list-panel" style={styles.listPanel}>
          <div style={styles.listHeader}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
              <div>
                <div style={styles.listTitle}>{t('bookings.search.title')}</div>
              </div>
              <button
                type="button"
                style={{
                  ...styles.secondaryButton,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  fontSize: '0.8rem',
                  flexShrink: 0,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" />
                </svg>
                {t('bookings.search.filterButton')}
              </button>
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
                placeholder={t('bookings.search.placeholder')}
                aria-label={t('bookings.search.title')}
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
              const count = filterCount(bookings, f.key);
              if (count === 0 && f.key !== 'all') return null;
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
                  {t(f.labelKey)}
                  {count > 0 && (
                    <span
                      style={{
                        marginLeft: '6px',
                        padding: '1px 6px',
                        borderRadius: '999px',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        background: active
                          ? 'rgba(255,255,255,0.25)'
                          : colors.neutralBg,
                        color: active ? '#fff' : colors.neutralText,
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div style={styles.listScroll}>
            {filteredBookings.length === 0 ? (
              <div
                style={{
                  padding: '32px 24px',
                  textAlign: 'center',
                  color: colors.textMuted,
                  fontSize: '0.875rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                {bookings.length === 0 ? (
                  isPhotographer ? (
                    <>
                      <span>{t('bookings.empty.photographer')}</span>
                      <button
                        type="button"
                        style={styles.primaryButton}
                        onClick={() => setShowCreate(true)}
                      >
                        {t('bookings.newBooking')}
                      </button>
                    </>
                  ) : (
                    <>
                      <span>{t('bookings.empty.client')}</span>
                      <button
                        type="button"
                        style={styles.primaryButton}
                        onClick={() => setShowRequest(true)}
                      >
                        {t('bookings.requestSession')}
                      </button>
                    </>
                  )
                ) : (
                  <span>{t('bookings.empty.filters')}</span>
                )}
              </div>
            ) : (
              filteredBookings.map((booking) => (
                <BookingListItem
                  key={booking.id}
                  booking={booking}
                  isActive={selected?.id === booking.id}
                  onSelect={() => setSelectedId(booking.id)}
                  isPhotographer={isPhotographer}
                  styles={styles}
                  colors={colors}
                />
              ))
            )}
          </div>
        </section>
        )}

        {/* Detail panel */}
        <section className="bk-detail-panel" style={styles.detailPanel}>
          {selected ? (
            isPhotographer ? (
              <BookingDetail
                booking={selected}
                styles={styles}
                colors={colors}
                isPhotographer={isPhotographer}
                actionBusy={actionBusy}
                actionError={actionError}
                onTransition={handleTransition}
              />
            ) : (
              <CustomerBookingDetail
                booking={selected}
                styles={styles}
                colors={colors}
                photographerLabel={photographerLabel}
              />
            )
          ) : (
            <div style={styles.emptyState}>
              {isPhotographer
                ? t('bookings.empty.selectPhotographer')
                : t('bookings.empty.selectClient')}
            </div>
          )}
        </section>
      </div>

      {showCreate && (
        <CreateBookingModal
          styles={styles}
          colors={colors}
          initialDate={createDate ?? undefined}
          onClose={() => {
            setShowCreate(false);
            setCreateDate(null);
          }}
          onCreated={handleCreated}
        />
      )}

      {showRequest && (
        <RequestSessionModal
          styles={styles}
          colors={colors}
          onClose={() => setShowRequest(false)}
          onSubmitted={() => refetch()}
        />
      )}

      <ConfirmDialog
        open={confirmCancel}
        theme={theme}
        tone="danger"
        title={t('bookings.cancel.title')}
        message={
          selected
            ? t('bookings.cancel.message', { name: selected.clientName })
            : t('bookings.cancel.messageFallback')
        }
        confirmLabel={t('bookings.cancel.confirm')}
        cancelLabel={t('bookings.cancel.keep')}
        busy={actionBusy}
        onConfirm={() => {
          setConfirmCancel(false);
          performTransition('CANCELLED');
        }}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  );
}

type StatCardProps = {
  styles: Record<string, React.CSSProperties>;
  colors: ReturnType<typeof getBookingsColors>;
  label: string;
  value: string;
  trend?: string;
  trendColor?: string;
  icon?: React.ReactNode;
  /** 0–100 — renders a circular progress ring instead of the icon when set */
  progress?: number;
  /** 0–100 — renders a thin horizontal progress bar across the card bottom */
  bar?: number;
  barColor?: string;
};

function StatCard({ styles, colors, label, value, trend, trendColor, icon, progress, bar, barColor }: StatCardProps) {
  const showRing = typeof progress === 'number';
  const r = 14;
  const circ = 2 * Math.PI * r;
  const filled = showRing ? circ * (1 - Math.min(progress, 100) / 100) : 0;

  return (
    <div style={styles.statCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <span style={styles.statLabel}>{label}</span>
          <div style={styles.statValue}>{value}</div>
          {trend && (
            <div style={{ ...styles.statTrend, color: trendColor ?? styles.statTrend?.color }}>
              {trend}
            </div>
          )}
        </div>
        {showRing ? (
          <svg width="40" height="40" viewBox="0 0 36 36" style={{ flexShrink: 0 }}>
            <circle cx="18" cy="18" r={r} fill="none" stroke={colors.isDark ? 'rgba(148,163,184,0.15)' : '#E5E7EB'} strokeWidth="3.5" />
            <circle
              cx="18" cy="18" r={r}
              fill="none"
              stroke={colors.primary}
              strokeWidth="3.5"
              strokeDasharray={circ}
              strokeDashoffset={filled}
              strokeLinecap="round"
              transform="rotate(-90 18 18)"
            />
            <text x="18" y="22" textAnchor="middle" fontSize="8" fontWeight="700" fill={colors.primaryText}>
              {Math.round(progress)}%
            </text>
          </svg>
        ) : icon ? (
          <span style={{
            width: 34,
            height: 34,
            borderRadius: '10px',
            background: colors.primaryBg,
            color: colors.primaryText,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            {icon}
          </span>
        ) : null}
      </div>
      {typeof bar === 'number' && (
        <div
          style={{
            marginTop: '12px',
            height: 6,
            borderRadius: 999,
            background: colors.isDark ? 'rgba(148,163,184,0.15)' : '#E5E7EB',
            overflow: 'hidden',
          }}
          role="progressbar"
          aria-valuenow={Math.round(bar)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.max(0, Math.min(100, bar))}%`,
              borderRadius: 999,
              background: barColor ?? colors.primary,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      )}
    </div>
  );
}

type ListItemProps = {
  booking: Booking;
  isActive: boolean;
  onSelect: () => void;
  isPhotographer: boolean;
  styles: Record<string, React.CSSProperties>;
  colors: ReturnType<typeof getBookingsColors>;
};

function BookingListItem({
  booking,
  isActive,
  onSelect,
  isPhotographer,
  styles,
  colors,
}: ListItemProps) {
  const { t, format } = useTranslation();
  const date = new Date(booking.eventDate);
  const month = format.monthAbbrUpper(date);
  const day = date.getDate();
  const status = getStatusVisual(booking.status, colors, 'list');
  // The photographer's list is client-first (whose booking is it); the client's
  // own list is session-first (what/where), since every row is theirs.
  const remaining = Math.max(
    booking.totalAmountCents - (booking.depositAmountCents || 0),
    0,
  );
  const title = isPhotographer
    ? booking.clientName
    : booking.eventType ?? t('bookings.sessionFallback');
  const deadlineDate = !isPhotographer && remaining > 0
    ? format.dayMonth(booking.eventDate)
    : null;
  const metaText = isPhotographer
    ? [
        booking.eventType ?? t('bookings.sessionFallback'),
        booking.status === 'ENQUIRY' ? t('bookings.awaitingDeposit') : booking.location,
      ]
        .filter(Boolean)
        .join(' · ')
    : [
        booking.location,
        remaining > 0 && deadlineDate
          ? t('bookings.balanceDue', { amount: format.eur(remaining), date: deadlineDate })
          : null,
      ]
        .filter(Boolean)
        .join(' · ');
  const statusLabel = isPhotographer
    ? t(status.labelKey)
    : t(getCustomerBookingStatusLabelKey(booking.status));

  return (
    <button
      type="button"
      onClick={onSelect}
      // Hover is a pure CSS-style toggle done via direct DOM mutation, not React
      // state — keeping it out of state means hovering a row no longer re-renders
      // the whole page (and every other row) on each mouse-enter/leave.
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = colors.surfaceHover; }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
      style={{
        ...styles.listItem,
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
          <span style={styles.listItemName}>{title}</span>
          <span style={styles.listItemAmount}>
            {format.eur(booking.totalAmountCents)}
          </span>
        </div>
        <div style={styles.listItemBottomRow}>
          <span style={styles.listItemMeta}>{metaText}</span>
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
            {statusLabel}
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
  isPhotographer: boolean;
  actionBusy: boolean;
  actionError: string | null;
  onTransition: (_target: BookingStatusKey) => void;
};

function BookingDetail({
  booking,
  styles,
  colors,
  isPhotographer,
  actionBusy,
  actionError,
  onTransition,
}: DetailProps) {
  const { t, format } = useTranslation();
  const date = new Date(booking.eventDate);
  const dateLabel = format.monthDay(date);
  const status = getStatusVisual(booking.status, colors, 'detail');
  const total = booking.totalAmountCents;
  const deposit = booking.depositAmountCents || 0;
  const remaining = Math.max(total - deposit, 0);
  const percent = total > 0 ? Math.min(100, Math.round((deposit / total) * 100)) : 0;
  const notes = booking.internalNotes?.trim() || t('bookings.detail.noNotes');
  const palette = pickAvatarColor(booking.id, colors.isDark);

  const progressColor =
    percent === 0 ? colors.warning : percent >= 100 ? colors.success : colors.primary;
  const progressTextColor =
    percent === 0
      ? colors.warningText
      : percent >= 100
        ? colors.successText
        : colors.primaryStrong;

  // Photographer-only: lifecycle actions, mirrored from the backend state
  // machine. Customers get a read-only view (the API would 403 the PATCH
  // anyway — this just keeps the UI honest).
  const transitions = isPhotographer ? getAllowedTransitions(booking.status) : [];
  const advanceTargets = transitions.filter((t) => t !== 'CANCELLED');
  const canCancel = transitions.includes('CANCELLED');
  const isTerminal = isPhotographer && transitions.length === 0;

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
                {t(status.labelKey)}
              </span>
            </div>
            <div style={styles.detailSubtitle}>
              {booking.eventType ?? t('bookings.sessionFallback')} · {dateLabel}
              {booking.location ? ` · ${booking.location}` : ''}
            </div>
          </div>
        </div>
        {isPhotographer && (transitions.length > 0 || isTerminal) && (
          <div style={styles.detailActions}>
            {advanceTargets.length > 0 && (
              <div style={styles.detailAdvanceRow}>
                {advanceTargets.map((target, index) => (
                  <button
                    key={target}
                    type="button"
                    disabled={actionBusy}
                    onClick={() => onTransition(target)}
                    style={{
                      ...(index === 0 ? styles.primaryButton : styles.secondaryButton),
                      flex: '1 1 140px',
                      ...(actionBusy ? { opacity: 0.6, cursor: 'wait' } : {}),
                    }}
                  >
                    {t(STATUS_ACTION_LABEL_KEY[target])}
                  </button>
                ))}
              </div>
            )}
            {canCancel && (
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => onTransition('CANCELLED')}
                style={{
                  ...styles.detailCancelButton,
                  ...(actionBusy ? { opacity: 0.6, cursor: 'wait' } : {}),
                }}
                onMouseEnter={(e) => {
                  if (!actionBusy) e.currentTarget.style.background = colors.dangerBg;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {t('bookings.cancel.confirm')}
              </button>
            )}
            {isTerminal && (
              <span style={{ fontSize: '0.8rem', color: colors.textMuted }}>
                {t('bookings.detail.closed')}
              </span>
            )}
          </div>
        )}
      </div>

      <div style={styles.detailBody}>
        {actionError && (
          <div style={styles.actionError} role="alert">
            {actionError}
          </div>
        )}

        {/* Client info */}
        <section style={styles.section}>
          <div style={styles.sectionTitle}>{t('bookings.detail.clientInfo')}</div>
          <div className="bk-info-grid" style={styles.infoGrid}>
            <InfoRow
              label={t('bookings.detail.name')}
              value={booking.clientName}
              styles={styles}
            />
            <InfoRow
              label={t('bookings.detail.email')}
              value={booking.clientEmail}
              styles={styles}
            />
            <InfoRow
              label={t('bookings.detail.eventType')}
              value={booking.eventType ?? '—'}
              styles={styles}
            />
            <InfoRow
              label={t('bookings.detail.location')}
              value={booking.location ?? '—'}
              styles={styles}
            />
          </div>
        </section>

        {/* Payment */}
        <section style={styles.section}>
          <div style={styles.sectionTitle}>{t('bookings.detail.payment')}</div>
          <div style={styles.sectionCard}>
            <div className="bk-payment-top" style={styles.paymentTopRow}>
              <div>
                <div style={styles.paymentLabel}>{t('bookings.detail.total')}</div>
                <div style={styles.paymentValue}>{format.eur(total)}</div>
              </div>
              <div>
                <div style={styles.paymentLabel}>{t('bookings.detail.status')}</div>
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
                  {t(status.labelKey)}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={styles.progressMeta}>
                <span style={styles.paymentLabel}>{t('bookings.detail.depositPaid')}</span>
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
                <span>{t('bookings.detail.amountPaid', { amount: format.eur(deposit) })}</span>
                <span>{t('bookings.detail.amountRemaining', { amount: format.eur(remaining) })}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Notes — internal to the photographer; the customer API never
            returns this field, so the section is photographer-only. */}
        {isPhotographer && (
          <section style={styles.section}>
            <div style={styles.sectionTitle}>{t('bookings.detail.notes')}</div>
            <div style={styles.notesBox}>{notes}</div>
          </section>
        )}
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
      <span className="bk-info-value" style={styles.infoValue}>{value}</span>
    </div>
  );
}

