'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventInput, EventClickArg } from '@fullcalendar/core';
import type { DateClickArg } from '@fullcalendar/interaction';
import deLocale from '@fullcalendar/core/locales/de';

import { Booking } from '@/types/api';
import { todayIso } from '@/lib/helpers';
import { useTranslation } from '@/lib/i18n';
import { fontSize, radius, space } from '@/lib/design-tokens';
import {
  getBookingStatusMeta,
  getCustomerBookingStatusLabelKey,
  getPaymentStateMeta,
  toneToVisual,
  type BookingStatusKey,
} from '@/lib/booking-status';
import { getBookingsColors } from './bookings.styles';

type Colors = ReturnType<typeof getBookingsColors>;

/**
 * Status → calendar palette, resolved through the same tone system the badges
 * use ({@link toneToVisual}). It used to be a hand-written hex table, which
 * meant the calendar drifted from the rest of the product and shipped light-mode
 * values into dark mode (a cancelled booking painted a pale pink block on a
 * near-black grid).
 *
 * <p><b>Colour encodes the lifecycle and nothing else.</b> It previously also
 * carried payment: `paymentState === 'PAID'` overrode the block to the success
 * tone — the same green CONFIRMED already uses, so the legend listed two
 * entries in one colour and a confirmed-but-unpaid shoot was indistinguishable
 * from a paid one. Payment is a second, independent dimension, so it gets a
 * second channel: the € glyph rendered on the event (see {@link EventContent}).
 *
 * <p>Cancelled/declined are deliberately muted rather than red. A cancelled
 * shoot is not an emergency — it is an absence — and painting it in the alarm
 * colour makes a month full of noise. It stays findable (strikethrough, dimmed)
 * without competing with live work.
 */
function paletteFor(status: string, c: Colors) {
  if (status === 'CANCELLED' || status === 'DECLINED') {
    return { bg: c.neutralBg, border: c.neutral, text: c.textMuted };
  }
  const visual = toneToVisual(getBookingStatusMeta(status).tone, c);
  return { bg: visual.bg, border: visual.dot, text: visual.color };
}

/**
 * Normalise the API's `LocalTime` ("15:00" / "15:00:00") into the `HH:mm:ss`
 * an ISO datetime needs.
 *
 * <p>Returns null for anything else, and the caller then renders the booking as
 * an all-day block. This matters because FullCalendar drops events whose start
 * it cannot parse *without warning*: one malformed time meant a booking that
 * exists, is counted in the stats and shows in the list simply was not on the
 * calendar. A shoot silently missing from a calendar is the worst failure this
 * screen can have, so an unreadable time degrades to "this day" instead.
 */
function normaliseTime(value: string | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const [, h, m, s] = match;
  const hours = Number(h);
  if (hours > 23 || Number(m) > 59) return null;
  return `${String(hours).padStart(2, '0')}:${m}:${s ?? '00'}`;
}

/**
 * Construct a FullCalendar event from a booking, built client-side from the
 * same list the table view uses — this saves a second round-trip and keeps
 * both views in sync when status changes happen via the detail panel. (This is
 * a deliberate choice over a server-side calendar feed: the list is already
 * loaded for the table, so reusing it avoids a redundant request.)
 *
 * <p>An event with {@code event_time} renders as a timed pill; without one it
 * renders as an all-day block. The "End at start" trick is intentional —
 * FullCalendar treats single-instant events as 30-min by default, which is
 * misleading for a shoot whose actual length we don't track yet.
 */
function bookingToEvent(b: Booking, c: Colors): EventInput {
  const palette = paletteFor(b.status, c);
  const time = normaliseTime(b.eventTime);
  const titleParts = [b.clientName];
  if (b.eventType) titleParts.push(b.eventType);
  return {
    id: b.id,
    title: titleParts.join(' — '),
    start: time ? `${b.eventDate}T${time}` : b.eventDate,
    allDay: !time,
    backgroundColor: palette.bg,
    borderColor: palette.border,
    textColor: palette.text,
    extendedProps: {
      status: b.status,
      paymentState: b.paymentState,
      clientEmail: b.clientEmail,
    },
    classNames:
      b.status === 'CANCELLED' || b.status === 'DECLINED' ? ['booking-cancelled'] : [],
  };
}

/** Statuses shown in the colour key, in pipeline order. */
const LEGEND_STATUSES: BookingStatusKey[] = [
  'ENQUIRY',
  'CONFIRMED',
  'POSTPONED',
  'COMPLETED',
  'CANCELLED',
];

/** Where an event popover is anchored, in viewport coordinates. */
type PopoverAnchor = { booking: Booking; rect: DOMRect };

export function BookingsCalendarView({
  bookings,
  selectedId,
  onSelect,
  onOpenDetails,
  onDateClick,
  isPhotographer,
  styles,
  colors,
  isDark,
}: Readonly<{
  bookings: Booking[];
  selectedId: string | null;
  onSelect: (_id: string) => void;
  /** Hand off to the full detail view (switches the page back to table mode). */
  onOpenDetails: (_id: string) => void;
  // Clicking an empty day opens the create-booking modal pre-filled with that
  // date. Optional so the calendar stays usable for read-only (customer) views.
  onDateClick?: (_dateStr: string) => void;
  isPhotographer: boolean;
  styles: Record<string, React.CSSProperties>;
  colors: Colors;
  isDark: boolean;
}>) {
  const { t, lang } = useTranslation();

  // Statuses toggled off through the legend. Calendar-local and deliberately
  // not in the URL: this is a lens on the grid ("hide the cancelled noise"),
  // not the page's status filter, which lives with the list.
  const [hiddenStatuses, setHiddenStatuses] = useState<BookingStatusKey[]>([]);
  const toggleStatus = useCallback((status: BookingStatusKey) => {
    setHiddenStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    );
  }, []);

  const events = useMemo(
    () =>
      bookings
        .filter((b) => !hiddenStatuses.includes(b.status as BookingStatusKey))
        .map((b) => bookingToEvent(b, colors)),
    [bookings, colors, hiddenStatuses],
  );

  // Clicking an event opens an anchored summary instead of driving a side rail
  // — that rail cost ~30% of the width permanently, for a panel that was only
  // relevant after a click.
  const [popover, setPopover] = useState<PopoverAnchor | null>(null);
  const closePopover = useCallback(() => setPopover(null), []);

  useEffect(() => {
    if (!popover) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closePopover();
    }
    // Any scroll moves the anchor out from under the popover, so dismiss
    // rather than trying to track it.
    window.addEventListener('scroll', closePopover, true);
    window.addEventListener('resize', closePopover);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('scroll', closePopover, true);
      window.removeEventListener('resize', closePopover);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [popover, closePopover]);

  // FullCalendar styles itself via a handful of CSS custom properties; remap
  // them to our design tokens here so the calendar respects light/dark mode
  // without us shipping a separate stylesheet per theme.
  const themeVars = useMemo(() => {
    return {
      '--fc-border-color': colors.border,
      '--fc-page-bg-color': colors.surface,
      '--fc-neutral-bg-color': colors.surfaceAlt,
      '--fc-neutral-text-color': colors.text,
      '--fc-today-bg-color': isDark ? 'rgba(99, 102, 241, 0.12)' : '#EEF2FF',
      '--fc-button-bg-color': colors.surface,
      '--fc-button-border-color': colors.border,
      '--fc-button-text-color': colors.text,
      '--fc-button-hover-bg-color': colors.surfaceHover,
      '--fc-button-hover-border-color': colors.border,
      '--fc-button-active-bg-color': colors.primary,
      '--fc-button-active-border-color': colors.primary,
      '--fc-list-event-hover-bg-color': colors.surfaceHover,
    } as React.CSSProperties;
  }, [colors, isDark]);

  return (
    <section
      aria-label={t('calendar.aria')}
      style={{
        ...themeVars,
        background: colors.surface,
        borderRadius: '14px',
        border: `1px solid ${colors.border}`,
        padding: '16px',
        color: colors.text,
        minHeight: '600px',
        boxShadow: isDark
          ? '0 2px 6px rgba(0,0,0,0.4)'
          : '0 1px 3px rgba(15,23,42,0.06)',
      }}
    >
      {/* Inline scoped styles. FullCalendar's default header text + day numbers
          ignore the parent color, so we override the few selectors needed for
          legibility in both themes. */}
      {/* All FullCalendar overrides live here. Each rule has a clear reason —
          removing one should be a deliberate choice, not a cleanup pass. */}
      <style>{`
        /* Cancelled bookings: struck through and dimmed. The date stays visibly
           held (you can still find it) without reading as active capacity. */
        .booking-cancelled { opacity: 0.6; }
        .booking-cancelled .fc-event-title,
        .booking-cancelled .fc-event-time { text-decoration: line-through; }

        /* Weekends carry the money in this business — a photographer's first
           question of a month grid is "which Saturdays are still free?". They
           get a tinted column so the eye can answer that without reading. */
        .fc .fc-day-sat, .fc .fc-day-sun { background: ${colors.surfaceAlt}; }
        .fc .fc-day-sat.fc-day-today, .fc .fc-day-sun.fc-day-today {
          background: var(--fc-today-bg-color);
        }
        .fc .fc-col-header-cell.fc-day-sat .fc-col-header-cell-cushion,
        .fc .fc-col-header-cell.fc-day-sun .fc-col-header-cell-cushion {
          color: ${colors.text};
        }

        /* Toolbar */
        .fc .fc-toolbar.fc-header-toolbar {
          margin-bottom: 14px;
          gap: ${space.md};
          flex-wrap: wrap;
        }
        /* Arrows, month and Today travel together on the left: pressing an
           arrow used to change a title sitting at the other end of the screen. */
        .fc .fc-toolbar-chunk:first-child {
          display: flex;
          align-items: center;
          gap: ${space.sm};
        }
        .fc .fc-toolbar-title {
          font-size: 1.15rem !important;
          font-weight: 700;
          color: ${colors.text};
          letter-spacing: -0.01em;
          margin: 0 ${space.xs} !important;
        }
        .fc .fc-button {
          padding: 5px 12px;
          font-size: 0.82rem;
          font-weight: 600;
          border-radius: 8px;
          box-shadow: none !important;
        }
        .fc .fc-button-primary:not(:disabled).fc-button-active,
        .fc .fc-button-primary:not(:disabled):active {
          /* Match the page's segmented control: muted primary, not solid. */
          background: ${colors.primaryBg};
          border-color: ${colors.primaryBorder};
          color: ${colors.primaryText};
        }
        .fc .fc-button-primary:disabled { opacity: 0.5; }

        /* Day grid. Headers are left-aligned to sit directly above the day
           numbers — centred headers over left-aligned numbers made the eye
           track two different columns inside the same cell. */
        .fc .fc-col-header-cell { text-align: start; }
        .fc-col-header-cell-cushion {
          color: ${colors.textMuted};
          text-decoration: none;
          font-size: ${fontSize.xs};
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: ${space.sm} ${space.sm} !important;
        }
        /* Day numbers sit top-left, where every other calendar puts them —
           right-aligned numbers under centred weekday headers meant the eye
           had to hunt in two different places per cell. */
        .fc .fc-daygrid-day-top {
          flex-direction: row;
          align-items: center;
          gap: ${space.sm};
          padding-inline-start: ${space.xs};
        }
        .fc-daygrid-day-number {
          color: ${colors.text};
          text-decoration: none;
          font-size: ${fontSize.base};
          font-weight: 600;
          padding: ${space.xs} ${space.sm} !important;
        }
        .fc-day-other .fc-daygrid-day-number { color: ${colors.textMuted}; opacity: 0.55; }
        .fc-day-today .fc-daygrid-day-number {
          color: #FFFFFF;
          font-weight: 800;
          background: ${colors.primarySolid};
          border-radius: ${radius.pill};
          min-width: 22px;
          text-align: center;
          margin: ${space.xs};
          padding: 1px 6px !important;
        }

        /* Empty days are clickable (they open the create form pre-filled), but
           nothing said so. A faint + on hover is the affordance — and it is
           deliberately absent on past days, which cannot take a new booking. */
        .fc .fc-daygrid-day-frame { position: relative; }
        .fc .fc-day-past { cursor: default; }
        .fc .fc-daygrid-day:not(.fc-day-other):not(.fc-day-past):hover .fc-daygrid-day-frame::after {
          content: '+';
          position: absolute;
          top: 2px;
          inset-inline-end: 6px;
          font-size: ${fontSize.md};
          font-weight: 700;
          line-height: 1;
          color: ${colors.textMuted};
          opacity: 0.65;
          pointer-events: none;
        }

        /* Events */
        .fc-event {
          border-radius: 6px !important;
          font-size: ${fontSize.sm};
          padding: 1px 4px;
          cursor: pointer;
          border-width: 0 !important;
          border-left-width: 3px !important;
          border-left-style: solid !important;
        }
        .fc-event-title { font-weight: 600; }
        .fc-daygrid-event { margin-top: 2px !important; }
        .fc .fc-daygrid-more-link {
          font-size: ${fontSize.xs};
          font-weight: 700;
          color: ${colors.primaryText};
        }

        /* Selected event: a subtle ring matched to the design system instead
           of the harsh full-blue outline that was reading as "broken". */
        .fc-event-selected {
          box-shadow: 0 0 0 2px ${colors.surface}, 0 0 0 3px ${colors.primary};
        }

        /* Time grid (Week / Day views) */
        .fc-timegrid-slot-label-cushion,
        .fc-timegrid-axis-cushion {
          color: ${colors.textMuted};
          font-size: ${fontSize.sm};
          font-weight: 600;
        }
        .fc-timegrid-now-indicator-line { border-color: ${colors.primary}; }
        .fc-timegrid-now-indicator-arrow { border-color: ${colors.primary}; }
      `}</style>

      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          // List view intentionally removed: the page-level "Table" tab
          // already provides a sortable, filterable list of bookings with
          // full actions. Offering both was redundant and pushed users into
          // FullCalendar's list view, which doesn't match the rest of the UI.
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        // FullCalendar renders its own chrome (weekday headers, the month
        // title); handing it the matching locale translates those, while
        // buttonText keeps our own wording for the toolbar buttons.
        locale={lang === 'de' ? deLocale : undefined}
        buttonText={{
          today: t('calendar.today'),
          month: t('calendar.month'),
          week: t('calendar.week'),
          day: t('calendar.day'),
        }}
        events={events}
        // 24-hour times. FullCalendar's en default renders 15:00 as "3p",
        // which is wrong for a German-market product (and unreadable next to
        // a truncated client name); both locales get "15:00".
        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        // Highlight the currently-selected booking so the right-hand detail
        // panel and the calendar grid stay visually correlated.
        eventClassNames={(arg) =>
          arg.event.id === selectedId ? ['fc-event-selected'] : []
        }
        // Payment rides on its own channel: the block's colour is the lifecycle,
        // the € glyph is the money. One mark can't carry two dimensions.
        eventContent={(arg) => (
          <EventContent
            title={arg.event.title}
            timeText={arg.timeText}
            paymentState={arg.event.extendedProps.paymentState as string | undefined}
            colors={colors}
          />
        )}
        eventClick={(arg: EventClickArg) => {
          // Prevent FullCalendar from following an href if one ever sneaks in;
          // we always handle navigation via React state.
          arg.jsEvent.preventDefault();
          const booking = bookings.find((b) => b.id === arg.event.id);
          onSelect(arg.event.id);
          if (booking) {
            setPopover({ booking, rect: arg.el.getBoundingClientRect() });
          }
        }}
        dateClick={
          onDateClick
            ? // Week/Day views append a time to dateStr; the create form's date
              // input wants a bare YYYY-MM-DD, so keep just the date part.
              (arg: DateClickArg) => {
                closePopover();
                const date = arg.dateStr.slice(0, 10);
                // A booking is scheduled work, so it cannot start in the past.
                // Clicking a past day simply does nothing rather than opening a
                // form the backend would reject on submit.
                if (date < todayIso()) return;
                onDateClick(date);
              }
            : undefined
        }
        // Paging or switching views leaves the anchor behind.
        datesSet={closePopover}
        height="auto"
        // Per-event color is set on the EventInput; FullCalendar's defaults
        // would otherwise paint the unified blue for everything.
        eventDisplay="block"
        // Without a cap, one busy day stretches its row until the month grid
        // loses its shape; the overflow collapses into a "+N more" link.
        dayMaxEvents={3}
        moreLinkContent={(arg) => t('calendar.moreEvents', { count: arg.num })}
        nowIndicator
        // Months that fit in five rows render in five. The default pads every
        // month to a fixed six weeks, which is where the trailing row of empty
        // cells came from — a whole band of grid holding one real day.
        fixedWeekCount={false}
        firstDay={1}
      />

      {/* Colour key that does something. In calendar mode the list panel — and
          with it the search + status filter — is not on screen, so a passive
          legend was both the only explanation of the palette *and* a wasted
          row. Each entry toggles its status off the grid. */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: space.sm,
          marginTop: space.md,
          paddingTop: space.md,
          borderTop: `1px solid ${colors.divider}`,
        }}
      >
        <span
          style={{
            fontSize: fontSize.xs,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: colors.textMuted,
            marginRight: space.xs,
          }}
        >
          {t('calendar.legend')}
        </span>
        {LEGEND_STATUSES.map((status) => {
          const palette = paletteFor(status, colors);
          const active = !hiddenStatuses.includes(status);
          const count = bookings.filter((b) => b.status === status).length;
          return (
            <button
              key={status}
              type="button"
              aria-pressed={active}
              onClick={() => toggleStatus(status)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: space.xs,
                padding: `${space.xxs} ${space.sm}`,
                borderRadius: radius.pill,
                border: `1px solid ${active ? colors.border : 'transparent'}`,
                background: active ? colors.surface : 'transparent',
                fontSize: fontSize.sm,
                fontWeight: 600,
                fontFamily: 'inherit',
                color: active ? colors.text : colors.textMuted,
                opacity: active ? 1 : 0.5,
                cursor: 'pointer',
                transition: 'opacity 0.16s ease, background 0.16s ease',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: '3px',
                  background: palette.bg,
                  borderLeft: `3px solid ${palette.border}`,
                }}
              />
              {t(getBookingStatusMeta(status).labelKey)}
              {count > 0 && (
                <span style={{ color: colors.textMuted, fontWeight: 700 }}>{count}</span>
              )}
            </button>
          );
        })}
        {/* Payment is a separate dimension, so it is explained separately —
            not as another colour competing with the lifecycle ones. */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: space.xs,
            marginLeft: space.xs,
            paddingLeft: space.md,
            borderLeft: `1px solid ${colors.divider}`,
            fontSize: fontSize.sm,
            color: colors.textMuted,
            fontWeight: 600,
          }}
        >
          <span aria-hidden style={{ color: colors.success, fontWeight: 800 }}>€</span>
          {t('paymentState.PAID')}
          <span aria-hidden style={{ color: colors.warning, fontWeight: 800, marginLeft: space.sm }}>€</span>
          {t('paymentState.OPEN')}
        </span>
      </div>

      {popover && (
        <EventPopover
          booking={popover.booking}
          rect={popover.rect}
          isPhotographer={isPhotographer}
          styles={styles}
          colors={colors}
          onClose={closePopover}
          onOpenDetails={() => {
            closePopover();
            onOpenDetails(popover.booking.id);
          }}
        />
      )}
    </section>
  );
}

/**
 * An event's own row: time, title, and the payment glyph.
 *
 * The glyph is the second encoding channel. Colour says where the *shoot* is
 * (enquiry → confirmed → completed); € says where the *money* is. Green € for
 * settled, amber for outstanding, and nothing at all before an invoice exists
 * — so an unbilled booking doesn't imply a debt.
 */
function EventContent({
  title,
  timeText,
  paymentState,
  colors,
}: Readonly<{
  title: string;
  timeText: string;
  paymentState: string | undefined;
  colors: Colors;
}>) {
  const money =
    paymentState === 'PAID'
      ? colors.success
      : paymentState === 'OVERDUE'
        ? colors.danger
        : paymentState === 'OPEN' || paymentState === 'PARTIALLY_PAID'
          ? colors.warning
          : null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      {timeText && (
        <span style={{ flexShrink: 0, opacity: 0.85, fontWeight: 700 }}>{timeText}</span>
      )}
      <span
        className="fc-event-title"
        style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {title}
      </span>
      {money && (
        <span
          aria-hidden
          style={{ marginLeft: 'auto', flexShrink: 0, color: money, fontWeight: 800 }}
        >
          €
        </span>
      )}
    </div>
  );
}

const POPOVER_WIDTH = 320;
/** Enough for the tallest content the popover renders; used to decide flip. */
const POPOVER_ESTIMATED_HEIGHT = 260;

/**
 * Summary card anchored to a clicked event: identity, when/where, money, and a
 * single way through to the full record. Deliberately a *summary* and not the
 * detail panel in miniature — duplicating the detail's actions here would mean
 * two places to keep the state machine correct.
 */
function EventPopover({
  booking,
  rect,
  isPhotographer,
  styles,
  colors,
  onClose,
  onOpenDetails,
}: Readonly<{
  booking: Booking;
  rect: DOMRect;
  isPhotographer: boolean;
  styles: Record<string, React.CSSProperties>;
  colors: Colors;
  onClose: () => void;
  onOpenDetails: () => void;
}>) {
  const { t, format } = useTranslation();
  const ref = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) onClose();
    }
    // Deferred: the click that opened the popover is still propagating.
    const id = window.setTimeout(
      () => document.addEventListener('mousedown', onPointerDown),
      0,
    );
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [onClose]);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  // Clamp into the viewport, and flip above the event when there isn't room
  // below it — a popover that opens off-screen is worse than no popover.
  const flipUp = rect.bottom + POPOVER_ESTIMATED_HEIGHT > window.innerHeight;
  const left = Math.min(
    Math.max(8, rect.left),
    Math.max(8, window.innerWidth - POPOVER_WIDTH - 8),
  );

  const statusMeta = getBookingStatusMeta(booking.status);
  const statusVisual = toneToVisual(statusMeta.tone, colors);
  const paymentMeta = getPaymentStateMeta(booking.paymentState);
  const paymentVisual = toneToVisual(paymentMeta.tone, colors);
  const statusLabel = isPhotographer
    ? t(statusMeta.labelKey)
    : t(getCustomerBookingStatusLabelKey(booking.status));

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={booking.clientName}
      tabIndex={-1}
      style={{
        position: 'fixed',
        left,
        ...(flipUp
          ? { bottom: Math.max(8, window.innerHeight - rect.top + 8) }
          : { top: rect.bottom + 8 }),
        width: POPOVER_WIDTH,
        maxWidth: 'calc(100vw - 16px)',
        zIndex: 60,
        padding: space.lg,
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.card,
        boxShadow: colors.elevatedShadow,
        display: 'flex',
        flexDirection: 'column',
        gap: space.md,
        outline: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: space.sm }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: fontSize.lg,
              fontWeight: 800,
              color: colors.text,
              letterSpacing: '-0.015em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {isPhotographer
              ? booking.clientName
              : booking.eventType ?? t('bookings.sessionFallback')}
          </div>
          <div style={{ marginTop: space.xs }}>
            <span
              style={{ ...styles.badge, background: statusVisual.bg, color: statusVisual.color }}
            >
              <span style={{ ...styles.badgeDot, background: statusVisual.dot }} />
              {statusLabel}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          style={{
            width: 28,
            height: 28,
            flexShrink: 0,
            borderRadius: radius.control,
            border: `1px solid ${colors.border}`,
            background: colors.surface,
            color: colors.textMuted,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: space.xs }}>
        <PopoverRow
          colors={colors}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          }
          text={[format.dayMonthYearLong(booking.eventDate), booking.eventTime]
            .filter(Boolean)
            .join(' · ')}
        />
        {booking.location && (
          <PopoverRow
            colors={colors}
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" /><circle cx="12" cy="10" r="3" />
              </svg>
            }
            text={booking.location}
          />
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space.sm,
          paddingTop: space.md,
          borderTop: `1px solid ${colors.divider}`,
        }}
      >
        <span style={{ fontSize: fontSize.lg, fontWeight: 800, color: colors.text }}>
          {format.eur(booking.totalAmountCents)}
        </span>
        <span style={{ ...styles.badge, background: paymentVisual.bg, color: paymentVisual.color }}>
          <span style={{ ...styles.badgeDot, background: paymentVisual.dot }} />
          {t(paymentMeta.labelKey)}
        </span>
      </div>

      <button type="button" onClick={onOpenDetails} style={{ ...styles.primaryButton, width: '100%' }}>
        {t('calendar.openDetails')}
      </button>
    </div>
  );
}

function PopoverRow({
  icon,
  text,
  colors,
}: Readonly<{ icon: React.ReactNode; text: string; colors: Colors }>) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: space.sm,
        fontSize: fontSize.base,
        color: colors.textMuted,
        minWidth: 0,
      }}
    >
      <span style={{ display: 'inline-flex', flexShrink: 0, color: colors.textMuted }}>{icon}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {text}
      </span>
    </div>
  );
}
