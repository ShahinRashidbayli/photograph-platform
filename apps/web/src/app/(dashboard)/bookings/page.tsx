'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useThemeStore } from '@/store/themeStore';
import { useAuthStore, useIsPhotographer } from '@/store/authStore';
import { useBookings, bookingsQueryKey } from '@/hooks/useBookings';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import api from '@/lib/api';
import { Booking } from '@/types/api';
import { getInitials, pickAvatarColor } from '@/lib/avatar';
import { extractApiError, insertSortedByDate } from '@/lib/helpers';
import {
  getBookingStatusMeta,
  getCustomerBookingStatusLabelKey,
  getPaymentStateMeta,
  toneToVisual,
  getAllowedTransitions,
  isBillableStatus,
  STATUS_ACTION_LABEL_KEY,
  type BookingStatusKey,
} from '@/lib/booking-status';
import { useTranslation, type TranslationKey } from '@/lib/i18n';
import { fontSize, space } from '@/lib/design-tokens';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Toast } from '@/components/Toast';
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

type ToastState = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

const FILTERS: { key: FilterKey; labelKey: TranslationKey }[] = [
  { key: 'all', labelKey: 'bookings.filter.all' },
  { key: 'deposit', labelKey: 'bookings.filter.awaitingPayment' },
  { key: 'confirmed', labelKey: 'bookings.filter.confirmed' },
  { key: 'pending', labelKey: 'bookings.filter.pending' },
  { key: 'completed', labelKey: 'bookings.filter.completed' },
];

function matchesFilter(booking: Booking, filter: FilterKey) {
  if (filter === 'all') return true;
  // Payment progress is now a separate, derived field — "awaiting payment"
  // means invoiced-but-not-fully-paid, independent of lifecycle status.
  if (filter === 'deposit') {
    return booking.paymentState === 'OPEN'
      || booking.paymentState === 'PARTIALLY_PAID'
      || booking.paymentState === 'OVERDUE';
  }
  if (filter === 'confirmed') return booking.status === 'CONFIRMED';
  if (filter === 'pending') return booking.status === 'ENQUIRY';
  if (filter === 'completed') return booking.status === 'COMPLETED';
  return true;
}

function filterCount(bookings: Booking[], filter: FilterKey): number {
  return bookings.filter((b) => matchesFilter(b, filter)).length;
}

// ─── Time grouping ─────────────────────────────────────────────────────────
// A flat chronological list gives no sense of urgency: "next Tuesday" and
// "next March" look identical until you read both dates. Rows are bucketed by
// how soon they are, and past shoots sink to the bottom rather than sitting at
// the top of a work queue.
type GroupKey = 'thisWeek' | 'thisMonth' | 'later' | 'past';

const GROUP_ORDER: GroupKey[] = ['thisWeek', 'thisMonth', 'later', 'past'];

const GROUP_LABEL_KEY: Record<GroupKey, TranslationKey> = {
  thisWeek: 'bookings.group.thisWeek',
  thisMonth: 'bookings.group.thisMonth',
  later: 'bookings.group.later',
  past: 'bookings.group.past',
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function groupFor(eventDate: string, today: Date): GroupKey {
  const date = new Date(eventDate);
  date.setHours(0, 0, 0, 0);
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return 'past';
  if (days <= 7) return 'thisWeek';
  if (days <= 31) return 'thisMonth';
  return 'later';
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

function BookingsView() {
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

  // ─── URL as the source of truth ──────────────────────────────────────────
  // View, filter, query and selection live in the query string, so a refresh
  // keeps your place, the back button steps through what you looked at, and a
  // booking can be linked to a colleague. (Matches the leads/clients pages.)
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParams = useCallback(
    (next: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value == null || value === '') params.delete(key);
        else params.set(key, value);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const viewMode: 'table' | 'calendar' =
    searchParams.get('view') === 'calendar' ? 'calendar' : 'table';
  const urlStatus = searchParams.get('status');
  const filter: FilterKey = FILTERS.some((f) => f.key === urlStatus)
    ? (urlStatus as FilterKey)
    : 'all';
  const urlQuery = searchParams.get('q') ?? '';
  const urlSelectedId = searchParams.get('id');

  const setViewMode = useCallback(
    (mode: 'table' | 'calendar') => setParams({ view: mode === 'calendar' ? 'calendar' : null }),
    [setParams],
  );
  const setFilter = useCallback(
    (key: FilterKey) => setParams({ status: key === 'all' ? null : key }),
    [setParams],
  );

  // Typing is local state, mirrored into the URL on a debounce — a history
  // entry per keystroke would make the back button useless.
  const [search, setSearch] = useState(urlQuery);
  useEffect(() => {
    if (search === urlQuery) return;
    const id = window.setTimeout(() => setParams({ q: search || null }), 300);
    return () => window.clearTimeout(id);
  }, [search, urlQuery, setParams]);

  // Selection is local for instant response (arrow-key navigation moves it
  // rapidly) and written back to the URL on a short debounce.
  const [selectedId, setSelectedId] = useState<string | null>(urlSelectedId);
  useEffect(() => {
    // Back/forward or a deep link: adopt whatever the URL now points at.
    if (urlSelectedId && urlSelectedId !== selectedId) setSelectedId(urlSelectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSelectedId]);
  useEffect(() => {
    if (!selectedId || selectedId === urlSelectedId) return;
    const id = window.setTimeout(() => setParams({ id: selectedId }), 250);
    return () => window.clearTimeout(id);
  }, [selectedId, urlSelectedId, setParams]);

  const [showCreate, setShowCreate] = useState(false);
  // The booking currently being edited (photographer). Reuses the create modal
  // in edit mode; null when no edit is open.
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  // Client-side "Request a session" modal (photographer uses showCreate instead).
  const [showRequest, setShowRequest] = useState(false);
  // Date pre-filled into the create modal when it's opened from a calendar day.
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Below this width the master-detail split stops working: both panes stack,
  // so reaching a booking's detail means scrolling past the whole list. On
  // narrow screens the two become separate pages with a back affordance.
  const isNarrow = useMediaQuery('(max-width: 900px)');
  const [mobilePane, setMobilePane] = useState<'list' | 'detail'>('list');

  // Keep the selection valid as data loads or changes: keep the current pick if
  // it still exists, otherwise fall back to the first booking. (Previously this
  // lived inside the fetch; now it reacts to the cached data.)
  useEffect(() => {
    setSelectedId((prev) =>
      prev && bookings.some((b) => b.id === prev) ? prev : bookings[0]?.id ?? null,
    );
  }, [bookings]);

  // Recomputed per mount rather than per render — the bucket boundaries only
  // move at midnight, and a fresh `new Date()` on every render would make the
  // memo below useless.
  const today = useMemo(startOfToday, []);

  const filteredBookings = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = bookings.filter((b) => {
      if (!matchesFilter(b, filter)) return false;
      if (!q) return true;
      return (
        b.clientName.toLowerCase().includes(q) ||
        (b.eventType?.toLowerCase().includes(q) ?? false) ||
        (b.location?.toLowerCase().includes(q) ?? false)
      );
    });
    // Soonest first within each bucket; past shoots read newest-first, since
    // "what did I just shoot" is the useful end of history.
    return matched.sort((a, b) => {
      const rankA = GROUP_ORDER.indexOf(groupFor(a.eventDate, today));
      const rankB = GROUP_ORDER.indexOf(groupFor(b.eventDate, today));
      if (rankA !== rankB) return rankA - rankB;
      return rankA === GROUP_ORDER.indexOf('past')
        ? b.eventDate.localeCompare(a.eventDate)
        : a.eventDate.localeCompare(b.eventDate);
    });
  }, [bookings, filter, search, today]);

  const stats = useMemo(() => {
    const active = bookings.filter(
      (b) => isBillableStatus(b.status) && b.status !== 'COMPLETED',
    );
    const revenue = active.reduce((sum, b) => sum + (b.totalAmountCents || 0), 0);
    // "Collected" and "outstanding" come straight from the backend (derived
    // server-side from real invoice/payment rows), not the quoted deposit
    // amount — otherwise a booking that's only been accepted shows its
    // deposit as already banked.
    const collected = active.reduce((sum, b) => sum + (b.amountPaidCents ?? 0), 0);
    const pending = active.reduce(
      (sum, b) =>
        sum + Math.max((b.totalAmountCents || 0) - (b.amountPaidCents ?? 0), 0),
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
          isBillableStatus(b.status) &&
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

  // ─── Keyboard navigation ────────────────────────────────────────────────
  // A booking list is something people scan dozens of times a day; requiring
  // the mouse for every step is a real cost. Tab lands on the current row,
  // then ↑/↓ move the selection (which drives the detail pane) and Home/End
  // jump to the ends.
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());

  function handleListKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    if (filteredBookings.length === 0) return;
    event.preventDefault();

    const current = filteredBookings.findIndex((b) => b.id === selected?.id);
    const last = filteredBookings.length - 1;
    let next: number;
    switch (event.key) {
      case 'ArrowDown':
        next = current < 0 ? 0 : Math.min(current + 1, last);
        break;
      case 'ArrowUp':
        next = current < 0 ? 0 : Math.max(current - 1, 0);
        break;
      case 'Home':
        next = 0;
        break;
      default:
        next = last;
    }

    const target = filteredBookings[next];
    if (!target) return;
    setSelectedId(target.id);
    itemRefs.current.get(target.id)?.focus();
  }

  /**
   * Apply a status change optimistically.
   *
   * The new state is painted immediately and reconciled with the server's
   * response; a failure rolls the cache back and surfaces the error inline.
   * This replaced an await-then-render flow that disabled the toolbar and
   * spun for the duration of the round-trip — the common case (it works) is
   * now instant, and the interruption happens only in the rare case.
   */
  async function applyTransition(
    bookingId: string,
    from: BookingStatusKey,
    target: BookingStatusKey,
  ) {
    const key = bookingsQueryKey(isPhotographer);
    setActionError(null);
    queryClient.setQueryData<Booking[]>(key, (old = []) =>
      old.map((b) => (b.id === bookingId ? { ...b, status: target } : b)),
    );

    try {
      const res = await api.patch<Booking>(`/api/bookings/${bookingId}/status`, {
        status: target,
      });
      queryClient.setQueryData<Booking[]>(key, (old = []) =>
        old.map((b) => (b.id === res.data.id ? res.data : b)),
      );
      // Undo is offered only when the reverse move is legal in the backend
      // state machine — POSTPONED ↔ CONFIRMED is the one round trip it
      // allows. Everything else is deliberately one-way (terminal states keep
      // the audit trail honest), so promising an undo there would just produce
      // a 409 on click.
      const canUndo = getAllowedTransitions(target).includes(from);
      setToast({
        message: t('bookings.toast.statusUpdated', {
          status: t(getBookingStatusMeta(target).labelKey),
        }),
        actionLabel: canUndo ? t('bookings.toast.undo') : undefined,
        onAction: canUndo
          ? () => {
              setToast(null);
              void applyTransition(bookingId, target, from);
            }
          : undefined,
      });
    } catch (err) {
      queryClient.setQueryData<Booking[]>(key, (old = []) =>
        old.map((b) => (b.id === bookingId ? { ...b, status: from } : b)),
      );
      setToast(null);
      setActionError(extractApiError(err, t('bookings.errorUpdateStatus')));
    }
  }

  function handleTransition(target: BookingStatusKey) {
    if (!selected) return;
    // Cancelling is terminal and has no legal way back, so it is the one move
    // that still asks first — an undo toast would be a promise we can't keep.
    if (target === 'CANCELLED') {
      setConfirmCancel(true);
      return;
    }
    void applyTransition(selected.id, selected.status as BookingStatusKey, target);
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

  function handleEdited(updated: Booking) {
    // Replace the edited booking in the cache in place. The event date may have
    // changed, so re-sort by removing and re-inserting rather than a straight map.
    queryClient.setQueryData<Booking[]>(bookingsQueryKey(isPhotographer), (old = []) =>
      insertSortedByDate(old.filter((b) => b.id !== updated.id), updated),
    );
    setSelectedId(updated.id);
    setEditingBooking(null);
  }

  if (loading && bookings.length === 0) {
    return <BookingsSkeleton styles={styles} colors={colors} label={t('bookings.loading')} />;
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
    <div className="bk-page" style={styles.pageWrapper}>
      <style>{`
        /* One focus ring for the whole page. Every interactive element gets a
           visible keyboard focus state — with inline styles there is no other
           way to express :focus-visible, and without it the keyboard paths
           below (arrow-key list navigation, the overflow menu) are unusable. */
        .bk-page :is(button, a, input, select, textarea):focus-visible {
          outline: 2px solid ${colors.primary};
          outline-offset: 2px;
        }
        @media (max-width: 1100px) {
          .bk-container { grid-template-columns: 1fr !important; }
          .bk-list-panel, .bk-detail-panel { max-height: none !important; }
        }
        /* The metrics strip stacks below its 3-up width; the hairline that
           divides the segments has to flip from vertical to horizontal. */
        @media (max-width: 720px) {
          .bk-stat-strip { grid-template-columns: 1fr !important; }
          .bk-stat-item + .bk-stat-item {
            border-left: none !important;
            border-top: 1px solid ${colors.border} !important;
          }
        }
        @media (max-width: 600px) {
          .bk-info-grid { grid-template-columns: 1fr !important; }
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

      {/* Metrics strip — the photographer sees business metrics (revenue,
          awaiting payment); the client sees their own session/payment view
          framed in personal terms (never "revenue"). Kept to a slim band so
          the list + detail work area starts near the top of the page. */}
      <StatStrip
        styles={styles}
        colors={colors}
        items={
          isPhotographer
            ? [
                {
                  label: t('bookings.stat.active'),
                  value: String(stats.active),
                  trend: t('bookings.stat.activeTrend', {
                    confirmed: stats.confirmed,
                    progress: Math.max(stats.active - stats.confirmed, 0),
                  }),
                },
                {
                  label: t('bookings.stat.revenue'),
                  value: format.eur(stats.revenue),
                  trend: t('bookings.stat.revenueTrend', {
                    amount: format.eur(stats.collected),
                  }),
                  trendColor: colors.successText,
                },
                {
                  label: t('bookings.stat.awaiting'),
                  value: format.eur(stats.pending),
                  trend:
                    stats.openBalance === 0
                      ? t('bookings.stat.allBalancesSettled')
                      : tPlural('bookings.stat.openBalance', stats.openBalance),
                  trendColor:
                    stats.openBalance === 0 ? colors.successText : colors.warningText,
                },
              ]
            : [
                {
                  label: t('bookings.stat.nextSession'),
                  value: nextSession ? format.dayMonth(nextSession.eventDate) : '—',
                  trend: nextSession
                    ? [
                        nextSession.eventType ?? t('bookings.sessionFallback'),
                        daysUntilNext == null
                          ? null
                          : tPlural('bookings.stat.inDays', daysUntilNext),
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : t('bookings.stat.noneScheduled'),
                },
                {
                  label: t('bookings.stat.paidSoFar'),
                  value: format.eur(stats.collected),
                  trend: t('bookings.stat.ofTotal', { amount: format.eur(stats.revenue) }),
                  bar:
                    stats.revenue > 0
                      ? Math.round((stats.collected / stats.revenue) * 100)
                      : 0,
                  barColor: colors.success,
                },
                {
                  label: t('bookings.stat.outstanding'),
                  value: format.eur(stats.pending),
                  trend:
                    stats.pending === 0
                      ? t('bookings.stat.allSettled')
                      : t('bookings.stat.dueBefore'),
                  trendColor:
                    stats.pending === 0 ? colors.successText : colors.warningText,
                },
              ]
        }
      />

      {/* Calendar mode is a single full-width pane: the detail rail used to sit
          beside it, permanently eating ~30% of the width to show a panel built
          for a wide column (which needed a pile of "squeeze it" CSS overrides).
          Clicking an event now opens an anchored summary popover instead, and
          "Open details" hands off to the table view. */}
      <div
        className="bk-container"
        style={{
          ...styles.container,
          ...(viewMode === 'calendar' ? { gridTemplateColumns: 'minmax(0, 1fr)' } : {}),
        }}
      >
        {viewMode === 'calendar' ? (
          <BookingsCalendarView
            bookings={bookings}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
            onOpenDetails={(id) => {
              setSelectedId(id);
              setParams({ view: null, id });
              setMobilePane('detail');
            }}
            onDateClick={
              isPhotographer
                ? (dateStr) => {
                    setCreateDate(dateStr);
                    setShowCreate(true);
                  }
                : undefined
            }
            isPhotographer={isPhotographer}
            styles={styles}
            colors={colors}
            isDark={theme === 'dark'}
          />
        ) : (
        <section
          className="bk-list-panel"
          style={{
            ...styles.listPanel,
            // Mobile: one pane at a time, so the detail isn't a scroll away.
            ...(isNarrow && mobilePane === 'detail' ? { display: 'none' } : {}),
          }}
        >
          {/* Search and the status filter share a single row — the filter is a
              dropdown rather than a wrapping row of count chips, so the panel
              spends one band on controls instead of two. */}
          <div style={styles.listHeader}>
            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
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
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterKey)}
              aria-label={t('bookings.filter.aria')}
              style={styles.filterSelect}
            >
              {FILTERS.map((f) => {
                const count = filterCount(bookings, f.key);
                // Empty buckets are hidden, but never the active one — its
                // count can drop to zero while it's still selected.
                if (count === 0 && f.key !== 'all' && filter !== f.key) return null;
                return (
                  <option key={f.key} value={f.key}>
                    {`${t(f.labelKey)} (${count})`}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Arrow keys move the selection through the list; the handler sits on
              the scroll container so a keypress on any focused row reaches it. */}
          <div
            style={styles.listScroll}
            onKeyDown={handleListKeyDown}
          >
            {filteredBookings.length === 0 ? (
              <div
                style={{
                  padding: `${space.xxxl} ${space.xxl}`,
                  textAlign: 'center',
                  color: colors.textMuted,
                  fontSize: fontSize.md,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: space.md,
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
              filteredBookings.map((booking, index) => {
                const group = groupFor(booking.eventDate, today);
                const previousGroup =
                  index > 0 ? groupFor(filteredBookings[index - 1].eventDate, today) : null;
                return (
                  <React.Fragment key={booking.id}>
                    {group !== previousGroup && (
                      <div style={styles.listGroupHeader}>{t(GROUP_LABEL_KEY[group])}</div>
                    )}
                <BookingListItem
                  booking={booking}
                  isActive={selected?.id === booking.id}
                  onSelect={() => {
                    setSelectedId(booking.id);
                    if (isNarrow) setMobilePane('detail');
                  }}
                  // Roving tabindex: Tab reaches the list once and lands on the
                  // current selection, then arrows move within it.
                  tabIndex={selected?.id === booking.id ? 0 : -1}
                  registerRef={(el) => {
                    if (el) itemRefs.current.set(booking.id, el);
                    else itemRefs.current.delete(booking.id);
                  }}
                  isPhotographer={isPhotographer}
                  styles={styles}
                  colors={colors}
                />
                  </React.Fragment>
                );
              })
            )}
          </div>
        </section>
        )}

        {/* Detail panel — hidden on mobile until a booking is picked, where it
            behaves as the second page of a list → detail flow. */}
        {viewMode === 'table' && (
        <section
          className="bk-detail-panel"
          style={{
            ...styles.detailPanel,
            ...(isNarrow && mobilePane === 'list' ? { display: 'none' } : {}),
          }}
        >
          {isNarrow && (
            <div style={{ padding: `${space.md} ${space.lg} 0` }}>
              <button
                type="button"
                style={styles.backButton}
                onClick={() => setMobilePane('list')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m15 18-6-6 6-6" />
                </svg>
                {t('bookings.backToList')}
              </button>
            </div>
          )}
          {selected ? (
            isPhotographer ? (
              <BookingDetail
                booking={selected}
                styles={styles}
                colors={colors}
                isPhotographer={isPhotographer}
                actionError={actionError}
                onTransition={handleTransition}
                onEdit={() => setEditingBooking(selected)}
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
        )}
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

      {editingBooking && (
        <CreateBookingModal
          styles={styles}
          colors={colors}
          booking={editingBooking}
          onClose={() => setEditingBooking(null)}
          onCreated={handleEdited}
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
        onConfirm={() => {
          setConfirmCancel(false);
          if (selected) {
            void applyTransition(
              selected.id,
              selected.status as BookingStatusKey,
              'CANCELLED',
            );
          }
        }}
        onCancel={() => setConfirmCancel(false)}
      />

      {toast && (
        <Toast
          theme={theme}
          message={toast.message}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}

/**
 * Reading the view/filter/selection out of the URL requires `useSearchParams`,
 * which needs a Suspense boundary in the app router. The fallback is the same
 * skeleton the data-loading state uses, so the two are indistinguishable.
 */
export default function BookingsPage() {
  const { theme } = useThemeStore();
  const { t } = useTranslation();
  const styles = useMemo(() => getBookingsStyles(theme), [theme]);
  const colors = useMemo(() => getBookingsColors(theme), [theme]);

  return (
    <React.Suspense
      fallback={
        <BookingsSkeleton styles={styles} colors={colors} label={t('bookings.loading')} />
      }
    >
      <BookingsView />
    </React.Suspense>
  );
}

type StatItem = {
  label: string;
  value: string;
  trend?: string;
  trendColor?: string;
  /** 0–100 — renders a hairline progress bar under the segment */
  bar?: number;
  barColor?: string;
};

type StatStripProps = {
  styles: Record<string, React.CSSProperties>;
  colors: ReturnType<typeof getBookingsColors>;
  items: StatItem[];
};

/**
 * The page's three headline numbers as one slim band. This replaced a row of
 * tall icon cards: the icons carried no information the label didn't already
 * give, and the cards pushed the actual work area (list + detail) a third of
 * a screen down.
 */
function StatStrip({ styles, colors, items }: StatStripProps) {
  return (
    <div className="bk-stat-strip" style={styles.statStrip}>
      {items.map((item, index) => (
        <div
          key={item.label}
          className="bk-stat-item"
          style={{
            ...styles.statStripItem,
            ...(index > 0 ? { borderLeft: `1px solid ${colors.border}` } : {}),
          }}
        >
          <span style={styles.statStripLabel}>{item.label}</span>
          <div style={styles.statStripValueRow}>
            <span style={styles.statStripValue}>{item.value}</span>
            {item.trend && (
              <span
                style={{
                  ...styles.statStripTrend,
                  color: item.trendColor ?? styles.statStripTrend?.color,
                }}
              >
                {item.trend}
              </span>
            )}
          </div>
          {typeof item.bar === 'number' && (
            <div
              style={{
                marginTop: '5px',
                height: 4,
                borderRadius: 999,
                background: colors.isDark ? 'rgba(148,163,184,0.15)' : '#E5E7EB',
                overflow: 'hidden',
              }}
              role="progressbar"
              aria-valuenow={Math.round(item.bar)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.max(0, Math.min(100, item.bar))}%`,
                  borderRadius: 999,
                  background: item.barColor ?? colors.primary,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

type MenuItem = {
  key: string;
  label: string;
  onSelect: () => void;
  danger?: boolean;
};

/**
 * Small "…" overflow menu. Destructive and rarely-used actions live in here
 * rather than as a fourth button on the detail toolbar — closes on outside
 * click, Escape, or selection.
 */
function ActionMenu({
  items,
  label,
  styles,
  colors,
}: Readonly<{
  items: MenuItem[];
  label: string;
  styles: Record<string, React.CSSProperties>;
  colors: ReturnType<typeof getBookingsColors>;
}>) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    // Focus goes back where it came from — otherwise closing the menu drops
    // the keyboard user at the top of the document.
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    // Opening with the keyboard should land on the first item.
    itemRefs.current[0]?.focus();

    function onPointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  function onMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const focusable = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
    const index = focusable.indexOf(document.activeElement as HTMLButtonElement);
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        close(true);
        break;
      case 'ArrowDown':
        event.preventDefault();
        focusable[(index + 1) % focusable.length]?.focus();
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusable[(index - 1 + focusable.length) % focusable.length]?.focus();
        break;
      case 'Tab':
        // A menu is modal-ish: tabbing out closes it rather than leaving an
        // orphaned popup floating over the page.
        setOpen(false);
        break;
      default:
        break;
    }
  }

  if (items.length === 0) return null;

  return (
    <div ref={wrapperRef} style={styles.menuWrapper}>
      <button
        type="button"
        ref={triggerRef}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        style={{
          ...styles.menuTrigger,
          ...(open ? { background: colors.surfaceHover, color: colors.text } : {}),
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" />
        </svg>
      </button>
      {open && (
        <div role="menu" style={styles.menuPanel} onKeyDown={onMenuKeyDown}>
          {items.map((item, index) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              onClick={() => {
                close(true);
                item.onSelect();
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = item.danger
                  ? colors.dangerBg
                  : colors.surfaceHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
              style={{
                ...styles.menuItem,
                ...(item.danger ? styles.menuItemDanger : {}),
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Loading state that mirrors the real layout — strip, list rows, detail panel —
 * rather than the word "Loading". Nothing shifts when the data arrives, and the
 * page's shape is readable while it does.
 */
function BookingsSkeleton({
  styles,
  colors,
  label,
}: Readonly<{
  styles: Record<string, React.CSSProperties>;
  colors: ReturnType<typeof getBookingsColors>;
  label: string;
}>) {
  const block = (w: string | number, h: number, extra: React.CSSProperties = {}) => (
    <div
      className="bk-shimmer"
      style={{ ...styles.skeletonBlock, width: w, height: h, ...extra }}
    />
  );

  return (
    <div style={styles.pageWrapper} aria-busy="true" aria-label={label}>
      <style>{`
        .bk-shimmer {
          background-image: linear-gradient(
            90deg,
            transparent 0%,
            ${colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.65)'} 50%,
            transparent 100%
          );
          background-size: 200% 100%;
          background-repeat: no-repeat;
          animation: bk-shimmer 1.3s ease-in-out infinite;
        }
        @keyframes bk-shimmer {
          from { background-position: 180% 0; }
          to   { background-position: -60% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .bk-shimmer { animation: none; }
        }
      `}</style>

      <header style={styles.pageHeader}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
          {block(190, 26)}
          {block(320, 14)}
        </div>
        {block(140, 36)}
      </header>

      <div className="bk-stat-strip" style={styles.statStrip}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bk-stat-item"
            style={{
              ...styles.statStripItem,
              ...(i > 0 ? { borderLeft: `1px solid ${colors.border}` } : {}),
            }}
          >
            {block(90, 10)}
            {block(120, 18, { marginTop: space.sm })}
          </div>
        ))}
      </div>

      <div className="bk-container" style={styles.container}>
        <section className="bk-list-panel" style={styles.listPanel}>
          <div style={styles.listHeader}>{block('100%', 36)}</div>
          <div style={styles.listScroll}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  ...styles.listItem,
                  cursor: 'default',
                  opacity: 1 - i * 0.13,
                }}
              >
                {block(52, 52)}
                <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
                  {block('70%', 12)}
                  {block('45%', 10)}
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="bk-detail-panel" style={styles.detailPanel}>
          <div style={styles.detailHeader}>
            <div style={styles.detailHeaderLeft}>
              {block(48, 48)}
              <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
                {block(170, 16)}
                {block(110, 12)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: space.sm }}>
              {block(130, 34)}
              {block(90, 34)}
            </div>
          </div>
          <div style={styles.detailBody}>
            {block('35%', 10)}
            <div className="bk-info-grid" style={styles.infoGrid}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={styles.infoRow}>
                  {block('50%', 10)}
                  {block('80%', 14, { marginTop: space.xs })}
                </div>
              ))}
            </div>
            {block('100%', 8, { marginTop: space.lg })}
          </div>
        </section>
      </div>
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
  /** Roving tabindex — 0 on the selected row, -1 on the rest. */
  tabIndex: number;
  registerRef: (_el: HTMLButtonElement | null) => void;
};

function BookingListItem({
  booking,
  isActive,
  onSelect,
  isPhotographer,
  styles,
  colors,
  tabIndex,
  registerRef,
}: ListItemProps) {
  const { t, format } = useTranslation();
  const date = new Date(booking.eventDate);
  const month = format.monthAbbrUpper(date);
  const day = date.getDate();
  const status = getStatusVisual(booking.status, colors, 'list');
  // The photographer's list is client-first (whose booking is it); the client's
  // own list is session-first (what/where), since every row is theirs.
  const remaining = Math.max(
    booking.totalAmountCents - (booking.amountPaidCents ?? 0),
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
      ref={registerRef}
      tabIndex={tabIndex}
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
  actionError: string | null;
  onTransition: (_target: BookingStatusKey) => void;
  onEdit: () => void;
};

function BookingDetail({
  booking,
  styles,
  colors,
  isPhotographer,
  actionError,
  onTransition,
  onEdit,
}: DetailProps) {
  const { t, format } = useTranslation();
  // The full date lives in the details grid below, not in a header subtitle
  // that repeated what the grid already lists.
  const dateLabel = [
    format.dayMonthYearLong(booking.eventDate),
    booking.eventTime,
  ]
    .filter(Boolean)
    .join(' · ');
  const status = getStatusVisual(booking.status, colors, 'detail');
  const total = booking.totalAmountCents;
  // Paid comes straight from the backend (derived server-side from real
  // invoice/payment rows). Before anything is invoiced this is 0, so the
  // progress bar never shows a configured deposit as money already banked.
  const paid = booking.amountPaidCents ?? 0;
  const remaining = Math.max(total - paid, 0);
  const paymentStateMeta = getPaymentStateMeta(booking.paymentState);
  const paymentStateVisual = toneToVisual(paymentStateMeta.tone, colors);
  const percent = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const notes = booking.internalNotes?.trim();
  const palette = pickAvatarColor(booking.id, colors.isDark);

  const progressColor =
    percent === 0 ? colors.warning : percent >= 100 ? colors.success : colors.primary;

  // Photographer-only: lifecycle actions, mirrored from the backend state
  // machine. Customers get a read-only view (the API would 403 the PATCH
  // anyway — this just keeps the UI honest).
  //
  // Payment progress is no longer part of the lifecycle state machine at all
  // — it's derived server-side from real invoice/payment rows (paymentState,
  // above) and driven by Stripe webhooks / manual payment recording through
  // the invoice API, not by transitioning the booking's status. So every
  // allowed transition here is a true management action: accept the enquiry,
  // mark the shoot completed, cancel.
  const transitions = isPhotographer ? getAllowedTransitions(booking.status) : [];
  // One filled action leads (confirm / mark completed); any further lifecycle
  // move is a neutral secondary, and cancelling — destructive and rare — is
  // reached through the "…" menu instead of a fourth competing button.
  const [primaryTarget, ...secondaryTargets] = transitions.filter(
    (target) => target !== 'CANCELLED',
  );
  const canCancel = transitions.includes('CANCELLED');
  const isTerminal = isPhotographer && transitions.length === 0;

  return (
    <>
      {/* Header carries identity only — name + status. Event type, date and
          location used to be repeated here and again in the grid below. */}
      <div style={styles.detailHeader}>
        <div style={styles.detailTopRow}>
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
            </div>
          </div>
          {isPhotographer && canCancel && (
            <ActionMenu
              label={t('bookings.detail.moreActions')}
              styles={styles}
              colors={colors}
              items={[
                {
                  key: 'CANCELLED',
                  label: t('bookings.cancel.confirm'),
                  danger: true,
                  onSelect: () => onTransition('CANCELLED'),
                },
              ]}
            />
          )}
        </div>
        {isPhotographer && (
          <div style={styles.detailActions}>
            {/* No disabled/spinner state: transitions apply optimistically, so
                the button's own label changes the moment it is pressed. */}
            {primaryTarget && (
              <button
                type="button"
                onClick={() => onTransition(primaryTarget)}
                style={styles.primaryButton}
              >
                {t(STATUS_ACTION_LABEL_KEY[primaryTarget])}
              </button>
            )}
            {secondaryTargets.map((target) => (
              <button
                key={target}
                type="button"
                onClick={() => onTransition(target)}
                style={styles.secondaryButton}
              >
                {t(STATUS_ACTION_LABEL_KEY[target])}
              </button>
            ))}
            <button
              type="button"
              onClick={onEdit}
              style={{
                ...styles.secondaryButton,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              {t('bookings.detail.edit')}
            </button>
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

        {/* Booking details — the single place session facts are listed. */}
        <section style={styles.section}>
          <div style={styles.sectionTitle}>{t('bookings.detail.details')}</div>
          <div className="bk-info-grid" style={styles.infoGrid}>
            <InfoRow
              label={t('bookings.detail.date')}
              value={dateLabel}
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
            <InfoRow
              label={t('bookings.detail.email')}
              value={booking.clientEmail}
              styles={styles}
            />
          </div>
        </section>

        {/* Payment — a divider and whitespace instead of a tinted card: the
            lifecycle status badge is already in the header, so only the
            payment state (a different fact) is shown here. */}
        <section style={{ ...styles.section, ...styles.sectionDivided }}>
          <div style={styles.sectionTitle}>{t('bookings.detail.payment')}</div>
          <div className="bk-payment-top" style={styles.paymentTopRow}>
            <div style={{ minWidth: 0 }}>
              <div style={styles.paymentLabel}>{t('bookings.detail.total')}</div>
              <div style={styles.paymentValue}>{format.eur(total)}</div>
            </div>
            <span
              style={{
                ...styles.badge,
                background: paymentStateVisual.bg,
                color: paymentStateVisual.color,
              }}
            >
              <span style={{ ...styles.badgeDot, background: paymentStateVisual.dot }} />
              {t(paymentStateMeta.labelKey)}
            </span>
          </div>

          {/* A cancelled booking owes nothing — a "0% paid, €X remaining"
              bar reads as an open balance, so show only the total + payment
              state above and drop the progress meter entirely. */}
          {booking.status !== 'CANCELLED' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                <span>{t('bookings.detail.amountPaid', { amount: format.eur(paid) })}</span>
                <span>{t('bookings.detail.amountRemaining', { amount: format.eur(remaining) })}</span>
              </div>
            </div>
          )}
        </section>

        {/* Notes — internal to the photographer; the customer API never
            returns this field, so the section is photographer-only. */}
        {isPhotographer && (
          <section style={{ ...styles.section, ...styles.sectionDivided }}>
            <div style={styles.sectionTitle}>{t('bookings.detail.notes')}</div>
            <div style={notes ? styles.notesText : styles.notesEmpty}>
              {notes || t('bookings.detail.noNotes')}
            </div>
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

