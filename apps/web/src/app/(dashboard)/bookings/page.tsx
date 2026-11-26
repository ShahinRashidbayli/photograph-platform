'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { startOfToday } from '@/lib/date';
import { useThemeStore } from '@/store/themeStore';
import { useAuthStore, useIsPhotographer } from '@/store/authStore';
import { useBookings, useUpdateBookingStatus } from '@/hooks/useBookings';
import { useTenantContracts } from '@/hooks/useContracts';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useGalleries } from '@/hooks/useGalleries';
import { usePackages } from '@/hooks/usePackages';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Booking } from '@/types/api';
import { extractApiError } from '@/lib/helpers';
import {
  getAllowedTransitions,
  getBookingStatusMeta,
  type BookingStatusKey,
} from '@/lib/booking-status';
import { useTranslation } from '@/lib/i18n';
import { fontSize, space } from '@/lib/design-tokens';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui';
import { Toast } from '@/components/Toast';
import { getBookingsColors, getBookingsStyles } from './bookings.styles';
import {
  FILTERS,
  GROUP_LABEL_KEY,
  GROUP_ORDER,
  filterCount,
  groupFor,
  matchesFilter,
  parseFilter,
  type FilterKey,
} from './bookings.filters';
import {
  attentionFor,
  indexContracts,
  indexGalleries,
  isPast,
  isUpcoming,
  type BookingContext,
} from './bookings.insights';
import { BookingsOverview } from './BookingsOverview';
import { CustomerPortal } from './CustomerPortal';
import { BookingDetail } from './BookingDetail';
import { BookingListItem } from './BookingListItem';
import { BookingsSkeleton } from './BookingsSkeleton';

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
  }
);

// Modals mount only on user action, so defer
// their code until first opened rather than shipping it in the route bundle.
const CreateBookingModal = dynamic(
  () => import('./CreateBookingModal').then((m) => m.CreateBookingModal),
  { ssr: false }
);

// The dynamic import's `loading` slot is plain JSX, not a component body, so
// the translated string is rendered through this tiny component instead.
function CalendarLoading() {
  const { t } = useTranslation();
  return <>{t('bookings.loadingCalendar')}</>;
}

type ToastState = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

const ICONS = {
  search: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
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

  const { t, tPlural } = useTranslation();

  const updateStatus = useUpdateBookingStatus();
  // Data now comes from React Query: cached, deduped, and shared across mounts.
  // Navigating back within the stale window is instant (no refetch).
  const { data: bookings = [], isLoading: loading, error: queryError, refetch } = useBookings(true);
  const error = queryError ? extractApiError(queryError, t('bookings.errorLoad')) : null;

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
    [router, pathname, searchParams]
  );

  const viewMode: 'table' | 'calendar' =
    searchParams.get('view') === 'calendar' ? 'calendar' : 'table';
  // Old `?status=deposit` style links still land on the matching question.
  const filter: FilterKey = parseFilter(searchParams.get('status'));
  const urlQuery = searchParams.get('q') ?? '';
  const urlSelectedId = searchParams.get('id');

  const setViewMode = useCallback(
    (mode: 'table' | 'calendar') => setParams({ view: mode === 'calendar' ? 'calendar' : null }),
    [setParams]
  );
  const setFilter = useCallback(
    (key: FilterKey) => setParams({ status: key === 'all' ? null : key }),
    [setParams]
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
  // Date pre-filled into the create modal when it's opened from a calendar day.
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Below this width the master-detail split stops working: both panes stack,
  // so reaching a booking's detail means scrolling past the whole list. On
  // narrow screens the two become separate pages with a back affordance.
  // Up to tablet width the list and the detail are two screens: stacked, the
  // detail of any booking sat under the whole list. (It used to switch at
  // 900px, which left 900–1100px stacked.)
  const isNarrow = useMediaQuery('(max-width: 1100px)');
  // Phone only: the detail's actions move to a bar under the thumb and the
  // progress line turns vertical — a tablet has the width for neither change.
  const isPhone = useMediaQuery('(max-width: 640px)');
  // A link to one booking (`?id=`, from an email or the dashboard) opens on its
  // detail. Starting on the list made that link look broken on a phone (#104).
  const [mobilePane, setMobilePane] = useState<'list' | 'detail'>(
    urlSelectedId ? 'detail' : 'list'
  );

  // Keep the selection valid as data loads or changes: keep the current pick if
  // it still exists, otherwise fall back to the first booking. (Previously this
  // lived inside the fetch; now it reacts to the cached data.)
  useEffect(() => {
    // Not while the list is still empty: on a fresh load the first pass sees
    // no bookings yet, and "keep it if it exists" then threw away the `?id=`
    // a deep link (or the "Next shoot" tile) had just put in the URL.
    if (bookings.length === 0) return;
    setSelectedId((prev) =>
      prev && bookings.some((b) => b.id === prev) ? prev : (bookings[0]?.id ?? null)
    );
  }, [bookings]);

  // Recomputed per mount rather than per render — the bucket boundaries only
  // move at midnight, and a fresh `new Date()` on every render would make the
  // memo below useless.
  const today = useMemo(startOfToday, []);

  // ─── The documents that hang off each booking ───────────────────────────
  // One request each for the whole studio rather than one per row: what a row
  // needs from them (is the contract signed, is there a gallery) is small, and
  // the detail's progress line reads the same answer. Contracts are asked for
  // only on plans that have them — a 402 here would open the upgrade dialog
  // on a page that never mentioned contracts.
  const { has } = useEntitlements();
  const contractsEnabled = has('CONTRACTS');
  const { data: contracts } = useTenantContracts(contractsEnabled);
  const { data: galleries } = useGalleries();
  const { data: packages } = usePackages();
  const contractIndex = useMemo(() => indexContracts(contracts ?? []), [contracts]);
  const galleryIndex = useMemo(() => indexGalleries(galleries ?? []), [galleries]);
  const ctxFor = useCallback(
    (b: Booking): BookingContext => ({
      today,
      contract: contractIndex.get(b.id) ?? null,
      gallery: galleryIndex.get(b.id) ?? null,
      contractsEnabled,
    }),
    [today, contractIndex, galleryIndex, contractsEnabled]
  );

  const filteredBookings = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = bookings.filter((b) => {
      if (!matchesFilter(b, filter, ctxFor(b))) return false;
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
  }, [bookings, filter, search, today, ctxFor]);

  const upcomingCount = useMemo(
    () => bookings.filter((b) => isUpcoming(b, today)).length,
    [bookings, today]
  );

  const selected = useMemo(
    () => bookings.find((b) => b.id === selectedId) ?? filteredBookings[0] ?? bookings[0] ?? null,
    [bookings, filteredBookings, selectedId]
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
   * Apply a status change — optimistically, see {@link useUpdateBookingStatus}.
   * This replaced an await-then-render flow that disabled the toolbar and
   * spun for the duration of the round-trip — the common case (it works) is
   * now instant, and the interruption happens only in the rare case.
   */
  function applyTransition(bookingId: string, from: BookingStatusKey, target: BookingStatusKey) {
    setActionError(null);
    updateStatus.mutate(
      { id: bookingId, from, to: target },
      {
        onSuccess: () => {
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
                  applyTransition(bookingId, target, from);
                }
              : undefined,
          });
        },
        onError: (err) => {
          setToast(null);
          setActionError(extractApiError(err, t('bookings.errorUpdateStatus')));
        },
      }
    );
  }

  function handleTransition(target: BookingStatusKey) {
    if (!selected) return;
    // Cancelling is terminal and has no legal way back, so it is the one move
    // that still asks first — an undo toast would be a promise we can't keep.
    if (target === 'CANCELLED') {
      setConfirmCancel(true);
      return;
    }
    applyTransition(selected.id, selected.status as BookingStatusKey, target);
  }

  // The cache already has the booking — useSaveBooking files it in at its date.
  function handleCreated(created: Booking) {
    setSelectedId(created.id);
    setShowCreate(false);
    setCreateDate(null);
  }

  function handleEdited(updated: Booking) {
    setSelectedId(updated.id);
    setEditingBooking(null);
  }

  if (loading && bookings.length === 0) {
    return (
      <BookingsSkeleton
        styles={styles}
        colors={colors}
        label={t('bookings.loading')}
        photographer
      />
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
          <button type="button" style={styles.primaryButton} onClick={() => refetch()}>
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
        /* Hover lives here, not in onMouseEnter handlers: the selected row
           (aria-current) keeps its own fill. */
        @media (hover: hover) {
          .bk-row:not([aria-current]):hover { background: var(--bk-row-hover); }
          .bk-tile:not(:disabled):hover { background: var(--bk-tile-hover) !important; }
          .bk-chip[aria-pressed='false']:hover { border-color: ${colors.borderActive} !important; }
        }
        @media (max-width: 1100px) {
          .bk-container { grid-template-columns: 1fr !important; }
          .bk-list-panel, .bk-detail-panel { max-height: none !important; }
        }
        @media (max-width: 900px) {
          .bk-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 720px) {
          .bk-split, .bk-docs { grid-template-columns: minmax(0, 1fr) !important; }
          .bk-split-side { border-left: 0 !important; padding-left: 0 !important; }
          .bk-docs-first { border-right: 0 !important; border-bottom: 1px solid ${colors.borderSoft}; }
        }
        @media (max-width: 600px) {
          /* Phone: a fact's label sits above its value, and an invoice row
             breaks into number/amount over status/actions. */
          .bk-fact { grid-template-columns: minmax(0, 1fr) !important; gap: 2px !important; }
          .bk-inv-row { grid-template-columns: minmax(0, 1fr) auto !important; row-gap: 8px !important; }
          .bk-info-grid { grid-template-columns: 1fr !important; }
          .bk-form-row { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Page header */}
      <header style={styles.pageHeader}>
        <div
          style={{
            minWidth: 0,
            display: 'flex',
            alignItems: 'baseline',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <h1 style={styles.pageTitle}>{t('bookings.title')}</h1>
          <p style={{ ...styles.pageSubtitle, margin: 0 }}>
            {tPlural('bookings.upcomingCount', upcomingCount)}
          </p>
        </div>
        <div style={{ ...styles.headerActions, alignItems: 'center' }}>
          {/* Master-pane view switcher. Calendar mode swaps the searchable
                list on the left for the FullCalendar grid. */}
          <div
            role="tablist"
            aria-label={t('bookings.view.aria')}
            style={{
              display: 'inline-flex',
              padding: '3px',
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
                    minHeight: 30,
                    padding: '0 14px',
                    borderRadius: '7px',
                    border: 'none',
                    background: active ? colors.surfaceActive : 'transparent',
                    color: active ? colors.text : colors.textMuted,
                    fontSize: '0.8125rem',
                    fontWeight: active ? 500 : 400,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  {mode === 'table' ? t('bookings.view.table') : t('bookings.view.calendar')}
                </button>
              );
            })}
          </div>
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              {t('bookings.newBooking')}
            </span>
          </Button>
        </div>
      </header>

      {/* The overview is four tiles, three of which filter the list. */}
      {/* On a phone with a booking open, the tiles would push the booking a
          screen down; they come back with the list. */}
      {!(isNarrow && mobilePane === 'detail') && (
        <BookingsOverview
          bookings={bookings}
          ctxFor={ctxFor}
          today={today}
          filter={filter}
          colors={colors}
          onFilter={(key) => {
            setFilter(key);
            if (viewMode === 'calendar') setViewMode('table');
          }}
          onSelect={(id) => {
            setSelectedId(id);
            setParams({ view: null, status: null, id });
            if (isNarrow) setMobilePane('detail');
          }}
        />
      )}

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
            onDateClick={(dateStr) => {
              setCreateDate(dateStr);
              setShowCreate(true);
            }}
            isPhotographer
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
            {/* Search, then the filters as chips with their counts — the
                dropdown they replaced hid the counts until opened. */}
            <div style={{ ...styles.listHeader, flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ position: 'relative', minWidth: 0 }}>
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
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('bookings.search.placeholder')}
                  aria-label={t('bookings.search.title')}
                  style={{
                    ...styles.searchBox,
                    paddingLeft: 34,
                  }}
                />
              </div>
              <div
                role="group"
                aria-label={t('bookings.filter.aria')}
                style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}
              >
                {FILTERS.map((f) => {
                  const count = filterCount(bookings, f.key, ctxFor);
                  const active = filter === f.key;
                  // Empty buckets are hidden, but never the active one — its
                  // count can drop to zero while it's still selected.
                  if (count === 0 && f.key !== 'all' && !active) return null;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setFilter(f.key)}
                      className="bk-chip"
                      style={{
                        minHeight: 30,
                        padding: '0 10px 0 12px',
                        borderRadius: 999,
                        fontSize: '0.8125rem',
                        fontFamily: 'inherit',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 7,
                        cursor: 'pointer',
                        background: active ? colors.primarySolid : colors.surface,
                        color: active ? colors.onPrimary : colors.text,
                        border: `1px solid ${active ? colors.primarySolid : colors.border}`,
                      }}
                    >
                      {t(f.labelKey)}
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontVariantNumeric: 'tabular-nums',
                          opacity: active ? 0.75 : 1,
                          color: active ? colors.onPrimary : colors.textSubtle,
                        }}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Arrow keys move the selection through the list; the handler sits on
              the scroll container so a keypress on any focused row reaches it. */}
            <div style={styles.listScroll} onKeyDown={handleListKeyDown}>
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
                        isPhotographer
                        styles={styles}
                        colors={colors}
                        attention={attentionFor(booking, ctxFor(booking))}
                        isPast={isPast(booking, today)}
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
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                  {t('bookings.backToList')}
                </button>
              </div>
            )}
            {selected ? (
              <BookingDetail
                key={selected.id}
                booking={selected}
                ctx={ctxFor(selected)}
                packageName={packages?.find((p) => p.id === selected.packageId)?.name ?? null}
                clientBookingCount={
                  bookings.filter(
                    (b) => b.clientEmail.toLowerCase() === selected.clientEmail.toLowerCase()
                  ).length
                }
                subdomain={user?.tenant?.subdomain ?? null}
                styles={styles}
                colors={colors}
                theme={theme}
                isNarrow={isPhone}
                actionError={actionError}
                onTransition={handleTransition}
                onEdit={() => setEditingBooking(selected)}
              />
            ) : (
              <div style={styles.emptyState}>{t('bookings.empty.selectPhotographer')}</div>
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
            applyTransition(selected.id, selected.status as BookingStatusKey, 'CANCELLED');
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
 * One route, two audiences: the studio's bookings workspace, or the client's
 * portal (`CustomerPortal`). Both read the URL with `useSearchParams`, which
 * needs a Suspense boundary in the app router. The studio's fallback is the
 * skeleton its data-loading state uses, so the two are indistinguishable.
 */
export default function BookingsPage() {
  const { theme } = useThemeStore();
  const { t } = useTranslation();
  const styles = useMemo(() => getBookingsStyles(theme), [theme]);
  const colors = useMemo(() => getBookingsColors(theme), [theme]);
  const isPhotographer = useIsPhotographer();

  return (
    <React.Suspense
      fallback={
        isPhotographer ? (
          <BookingsSkeleton
            styles={styles}
            colors={colors}
            label={t('bookings.loading')}
            photographer
          />
        ) : null
      }
    >
      {isPhotographer ? <BookingsView /> : <CustomerPortal />}
    </React.Suspense>
  );
}
