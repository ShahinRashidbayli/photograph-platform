'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { Booking } from '@/types/api';
import {
  getBookingStatusMeta,
  toneToVisual,
  getAllowedTransitions,
  STATUS_ACTION_LABEL,
  type BookingStatusKey,
} from '@/lib/booking-status';
import { ConfirmDialog } from '@/components/ConfirmDialog';
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

// Pull the whole booking list in pages rather than a single capped request.
// A flat `?size=50` silently dropped booking #51+, and the revenue/active
// stat cards are summed over this list — a truncated list meant wrong totals.
const PAGE_SIZE = 100;
const MAX_PAGES = 25; // safety stop: 2500 bookings before we give up looping

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

/** Read the `{ error }` message the backend returns on 4xx/5xx, or fall back. */
function extractApiError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { error?: string } } })
    ?.response?.data?.error;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

/** Parse a euro amount typed by the user into integer cents (>= 0). */
function eurosToCents(value: string): number {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

/** Keep the list ordered by event date (ascending) after a local insert. */
function insertSortedByDate(list: Booking[], booking: Booking): Booking[] {
  return [...list, booking].sort((a, b) => a.eventDate.localeCompare(b.eventDate));
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
  const meta = getBookingStatusMeta(status);
  const visual = toneToVisual(meta.tone, c);
  const label = variant === 'detail' && meta.detailLabel ? meta.detailLabel : meta.label;
  return { ...visual, label };
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

  const role = user?.role?.toUpperCase();
  const isPhotographer = role === 'PHOTOGRAPHER' || role === 'ADMIN';

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    // The customer endpoint identifies the caller from their session — no
    // clientId is sent (the backend rejects a caller-supplied one as an IDOR).
    const base = isPhotographer
      ? '/api/photographerBookings'
      : '/api/customerBookings';
    try {
      const all: Booking[] = [];
      for (let page = 0; page < MAX_PAGES; page++) {
        const res = await api.get<Booking[]>(
          `${base}?page=${page}&size=${PAGE_SIZE}`,
        );
        const chunk = Array.isArray(res.data) ? res.data : [];
        all.push(...chunk);
        if (chunk.length < PAGE_SIZE) break;
      }
      setBookings(all);
      setSelectedId((prev) =>
        prev && all.some((b) => b.id === prev) ? prev : all[0]?.id ?? null,
      );
    } catch (err) {
      setBookings([]);
      setSelectedId(null);
      setError(
        extractApiError(err, 'We could not load your bookings. Please try again.'),
      );
    } finally {
      setLoading(false);
    }
  }, [isPhotographer]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

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
      setBookings((prev) =>
        prev.map((b) => (b.id === res.data.id ? res.data : b)),
      );
    } catch (err) {
      setActionError(
        extractApiError(err, 'Could not update the booking status.'),
      );
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
    setBookings((prev) => insertSortedByDate(prev, created));
    setSelectedId(created.id);
    setShowCreate(false);
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
          Loading bookings...
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
            <h1 style={styles.pageTitle}>Bookings</h1>
          </div>
        </header>
        <div style={styles.errorPanel}>
          <div style={styles.errorPanelTitle}>Couldn&apos;t load bookings</div>
          <div style={styles.errorPanelText}>{error}</div>
          <button
            type="button"
            style={styles.primaryButton}
            onClick={loadBookings}
          >
            Try again
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
          <h1 style={styles.pageTitle}>Bookings</h1>
          <p style={styles.pageSubtitle}>
            {isPhotographer
              ? 'Manage all active bookings, payments, and client details in one place.'
              : 'Track your sessions, payments, and upcoming events.'}
          </p>
        </div>
        {isPhotographer && (
          <div style={styles.headerActions}>
            <button
              type="button"
              style={styles.invertedPrimaryButton}
              onClick={() => setShowCreate(true)}
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
        )}
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
          iconBg={colors.primaryBg}
          iconColor={colors.primaryStrong}
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
                      <span>No bookings yet. Create your first booking to get started.</span>
                      <button
                        type="button"
                        style={styles.primaryButton}
                        onClick={() => setShowCreate(true)}
                      >
                        New booking
                      </button>
                    </>
                  ) : (
                    <span>You have no bookings yet.</span>
                  )
                ) : (
                  <span>No bookings match these filters.</span>
                )}
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
            <div style={styles.emptyState}>
              {isPhotographer
                ? 'Select a booking to view details, or create a new one.'
                : 'Select a booking to view details.'}
            </div>
          )}
        </section>
      </div>

      {showCreate && (
        <CreateBookingModal
          styles={styles}
          colors={colors}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}

      <ConfirmDialog
        open={confirmCancel}
        theme={theme}
        tone="danger"
        title="Cancel this booking?"
        message={
          selected
            ? `This cancels the booking for ${selected.clientName}. This cannot be undone.`
            : 'This cannot be undone.'
        }
        confirmLabel="Cancel booking"
        cancelLabel="Keep booking"
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
  const notes = booking.internalNotes?.trim() || 'No notes added yet.';
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
                {status.label}
              </span>
            </div>
            <div style={styles.detailSubtitle}>
              {booking.eventType ?? 'Session'} · {dateLabel}
              {booking.location ? ` · ${booking.location}` : ''}
            </div>
          </div>
        </div>
        {isPhotographer && (transitions.length > 0 || isTerminal) && (
          <div style={styles.detailActions}>
            {advanceTargets.map((target, index) => (
              <button
                key={target}
                type="button"
                disabled={actionBusy}
                onClick={() => onTransition(target)}
                style={{
                  ...(index === 0 ? styles.primaryButton : styles.secondaryButton),
                  ...(actionBusy ? { opacity: 0.6, cursor: 'wait' } : {}),
                }}
              >
                {STATUS_ACTION_LABEL[target]}
              </button>
            ))}
            {canCancel && (
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => onTransition('CANCELLED')}
                style={{
                  ...styles.dangerButton,
                  ...(actionBusy ? { opacity: 0.6, cursor: 'wait' } : {}),
                }}
              >
                Cancel
              </button>
            )}
            {isTerminal && (
              <span style={{ fontSize: '0.8rem', color: colors.textMuted }}>
                This booking is closed.
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
            <InfoRow
              label="Event type"
              value={booking.eventType ?? '—'}
              styles={styles}
            />
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

        {/* Notes — internal to the photographer; the customer API never
            returns this field, so the section is photographer-only. */}
        {isPhotographer && (
          <section style={styles.section}>
            <div style={styles.sectionTitle}>Notes</div>
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
      <span style={styles.infoValue}>{value}</span>
    </div>
  );
}

type CreateModalProps = {
  styles: Record<string, React.CSSProperties>;
  colors: ReturnType<typeof getBookingsColors>;
  onClose: () => void;
  onCreated: (_booking: Booking) => void;
};

const EMPTY_FORM = {
  clientName: '',
  clientEmail: '',
  eventDate: '',
  eventTime: '',
  eventType: '',
  location: '',
  totalAmount: '',
  depositAmount: '',
  internalNotes: '',
};

function CreateBookingModal({ styles, colors, onClose, onCreated }: CreateModalProps) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Close on Escape — standard dialog affordance.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function update(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!form.clientName.trim()) errors.clientName = 'Client name is required.';
    if (!form.clientEmail.trim()) {
      errors.clientEmail = 'Client email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.clientEmail.trim())) {
      errors.clientEmail = 'Enter a valid email address.';
    }
    if (!form.eventDate) errors.eventDate = 'Event date is required.';
    const total = eurosToCents(form.totalAmount);
    const deposit = eurosToCents(form.depositAmount);
    if (form.depositAmount.trim() && deposit > total) {
      errors.depositAmount = 'Deposit cannot exceed the total.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit() {
    if (submitting) return;
    setSubmitError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = {
        clientName: form.clientName.trim(),
        clientEmail: form.clientEmail.trim(),
        eventDate: form.eventDate,
        eventTime: form.eventTime || null,
        eventType: form.eventType.trim() || null,
        location: form.location.trim() || null,
        totalAmountCents: eurosToCents(form.totalAmount),
        depositAmountCents: eurosToCents(form.depositAmount),
        internalNotes: form.internalNotes.trim() || null,
      };
      const res = await api.post<Booking>('/api/bookings', payload);
      onCreated(res.data);
    } catch (err) {
      setSubmitError(
        extractApiError(err, 'Could not create the booking. Please try again.'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  const fieldStyle = (field: keyof typeof EMPTY_FORM): React.CSSProperties => ({
    ...styles.formInput,
    ...(fieldErrors[field] ? { borderColor: colors.danger } : {}),
  });

  return (
    <div
      style={styles.modalOverlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={styles.modalCard}
        role="dialog"
        aria-modal="true"
        aria-label="Create a new booking"
      >
        <div style={styles.modalHeader}>
          <div style={{ minWidth: 0 }}>
            <div style={styles.modalTitle}>New booking</div>
            <div style={styles.modalSubtitle}>
              The booking starts as an enquiry — you can advance it afterwards.
            </div>
          </div>
          <button
            type="button"
            style={styles.modalClose}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div style={styles.modalBody}>
          {submitError && (
            <div style={styles.actionError} role="alert">
              {submitError}
            </div>
          )}

          <div style={styles.formField}>
            <label style={styles.formLabel} htmlFor="bk-clientName">
              Client name *
            </label>
            <input
              id="bk-clientName"
              type="text"
              value={form.clientName}
              onChange={(e) => update('clientName', e.target.value)}
              style={fieldStyle('clientName')}
              maxLength={200}
            />
            {fieldErrors.clientName && (
              <span style={styles.fieldError}>{fieldErrors.clientName}</span>
            )}
          </div>

          <div style={styles.formField}>
            <label style={styles.formLabel} htmlFor="bk-clientEmail">
              Client email *
            </label>
            <input
              id="bk-clientEmail"
              type="email"
              value={form.clientEmail}
              onChange={(e) => update('clientEmail', e.target.value)}
              style={fieldStyle('clientEmail')}
              maxLength={320}
            />
            {fieldErrors.clientEmail && (
              <span style={styles.fieldError}>{fieldErrors.clientEmail}</span>
            )}
          </div>

          <div className="bk-form-row" style={styles.formRow}>
            <div style={styles.formField}>
              <label style={styles.formLabel} htmlFor="bk-eventDate">
                Event date *
              </label>
              <input
                id="bk-eventDate"
                type="date"
                value={form.eventDate}
                onChange={(e) => update('eventDate', e.target.value)}
                style={fieldStyle('eventDate')}
              />
              {fieldErrors.eventDate && (
                <span style={styles.fieldError}>{fieldErrors.eventDate}</span>
              )}
            </div>
            <div style={styles.formField}>
              <label style={styles.formLabel} htmlFor="bk-eventTime">
                Event time
              </label>
              <input
                id="bk-eventTime"
                type="time"
                value={form.eventTime}
                onChange={(e) => update('eventTime', e.target.value)}
                style={styles.formInput}
              />
            </div>
          </div>

          <div className="bk-form-row" style={styles.formRow}>
            <div style={styles.formField}>
              <label style={styles.formLabel} htmlFor="bk-eventType">
                Event type
              </label>
              <input
                id="bk-eventType"
                type="text"
                value={form.eventType}
                onChange={(e) => update('eventType', e.target.value)}
                placeholder="Wedding, Portrait…"
                style={styles.formInput}
                maxLength={50}
              />
            </div>
            <div style={styles.formField}>
              <label style={styles.formLabel} htmlFor="bk-location">
                Location
              </label>
              <input
                id="bk-location"
                type="text"
                value={form.location}
                onChange={(e) => update('location', e.target.value)}
                style={styles.formInput}
                maxLength={300}
              />
            </div>
          </div>

          <div className="bk-form-row" style={styles.formRow}>
            <div style={styles.formField}>
              <label style={styles.formLabel} htmlFor="bk-total">
                Total amount (€)
              </label>
              <input
                id="bk-total"
                type="number"
                min="0"
                step="1"
                value={form.totalAmount}
                onChange={(e) => update('totalAmount', e.target.value)}
                style={styles.formInput}
              />
            </div>
            <div style={styles.formField}>
              <label style={styles.formLabel} htmlFor="bk-deposit">
                Deposit (€)
              </label>
              <input
                id="bk-deposit"
                type="number"
                min="0"
                step="1"
                value={form.depositAmount}
                onChange={(e) => update('depositAmount', e.target.value)}
                style={fieldStyle('depositAmount')}
              />
              {fieldErrors.depositAmount && (
                <span style={styles.fieldError}>{fieldErrors.depositAmount}</span>
              )}
            </div>
          </div>

          <div style={styles.formField}>
            <label style={styles.formLabel} htmlFor="bk-notes">
              Internal notes
            </label>
            <textarea
              id="bk-notes"
              value={form.internalNotes}
              onChange={(e) => update('internalNotes', e.target.value)}
              style={styles.formTextarea}
              placeholder="Only visible to you."
            />
          </div>
        </div>

        <div style={styles.modalFooter}>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            style={{
              ...styles.primaryButton,
              ...(submitting ? { opacity: 0.6, cursor: 'wait' } : {}),
            }}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Creating…' : 'Create booking'}
          </button>
        </div>
      </div>
    </div>
  );
}
