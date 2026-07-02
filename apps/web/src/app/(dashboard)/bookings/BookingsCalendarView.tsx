'use client';

import React, { useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventInput, EventClickArg } from '@fullcalendar/core';

import { Booking } from '@/types/api';
import { getBookingsColors } from './bookings.styles';

type Colors = ReturnType<typeof getBookingsColors>;

/**
 * Status → calendar palette. Matches the spec's color guidance:
 * ENQUIRY=gray, CONFIRMED=blue, paid states green, CANCELLED red. The
 * three paid states (DEPOSIT_PAID / FULLY_PAID / COMPLETED) progress amber →
 * green → muted so the eye can distinguish "money in flight" from "money
 * settled" from "shoot finished" at a glance.
 */
function colorForStatus(status: string): { bg: string; border: string; text: string } {
  switch (status) {
    case 'ENQUIRY':
      return { bg: '#94A3B8', border: '#64748B', text: '#FFFFFF' };
    case 'CONFIRMED':
      return { bg: '#2563EB', border: '#1D4ED8', text: '#FFFFFF' };
    case 'DEPOSIT_PAID':
      return { bg: '#D97706', border: '#B45309', text: '#FFFFFF' };
    case 'FULLY_PAID':
      return { bg: '#16A34A', border: '#15803D', text: '#FFFFFF' };
    case 'COMPLETED':
      return { bg: '#6B7280', border: '#4B5563', text: '#FFFFFF' };
    case 'CANCELLED':
      return { bg: '#FEE2E2', border: '#DC2626', text: '#7F1D1D' };
    default:
      return { bg: '#94A3B8', border: '#64748B', text: '#FFFFFF' };
  }
}

/**
 * Construct a FullCalendar event from a booking. Mirrors the backend's
 * {@code CalendarEventResponse} shape, but built client-side from the same
 * list the table view uses — saves a second round-trip and keeps both views
 * in sync when status changes happen via the detail panel.
 *
 * <p>An event with {@code event_time} renders as a timed pill; without one it
 * renders as an all-day block. The "End at start" trick is intentional —
 * FullCalendar treats single-instant events as 30-min by default, which is
 * misleading for a shoot whose actual length we don't track yet.
 */
function bookingToEvent(b: Booking): EventInput {
  const palette = colorForStatus(b.status);
  const start = b.eventTime ? `${b.eventDate}T${b.eventTime}` : b.eventDate;
  const titleParts = [b.clientName];
  if (b.eventType) titleParts.push(b.eventType);
  return {
    id: b.id,
    title: titleParts.join(' — '),
    start,
    allDay: !b.eventTime,
    backgroundColor: palette.bg,
    borderColor: palette.border,
    textColor: palette.text,
    // CANCELLED gets a strikethrough via CSS — done in eventDidMount below
    // because FullCalendar's typed event options don't include text-decoration.
    extendedProps: {
      status: b.status,
      clientEmail: b.clientEmail,
    },
    classNames: b.status === 'CANCELLED' ? ['booking-cancelled'] : [],
  };
}

export function BookingsCalendarView({
  bookings,
  selectedId,
  onSelect,
  colors,
  isDark,
}: Readonly<{
  bookings: Booking[];
  selectedId: string | null;
  onSelect: (_id: string) => void;
  colors: Colors;
  isDark: boolean;
}>) {
  const events = useMemo(() => bookings.map(bookingToEvent), [bookings]);

  // FullCalendar styles itself via a handful of CSS custom properties; remap
  // them to our design tokens here so the calendar respects light/dark mode
  // without us shipping a separate stylesheet per theme.
  const themeVars = useMemo(() => {
    return {
      '--fc-border-color': colors.border,
      '--fc-page-bg-color': colors.surface,
      '--fc-neutral-bg-color': colors.surfaceAlt,
      '--fc-neutral-text-color': colors.text,
      '--fc-today-bg-color': isDark ? 'rgba(59, 130, 246, 0.10)' : '#EFF6FF',
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
      aria-label="Bookings calendar"
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
        /* Cancelled bookings: strikethrough so the date stays visibly held
           but the eye doesn't read it as active capacity. */
        .booking-cancelled .fc-event-title,
        .booking-cancelled .fc-event-time { text-decoration: line-through; opacity: 0.85; }

        /* Toolbar */
        .fc .fc-toolbar.fc-header-toolbar { margin-bottom: 14px; }
        .fc .fc-toolbar-title {
          font-size: 1.15rem !important;
          font-weight: 700;
          color: ${colors.text};
          letter-spacing: -0.01em;
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

        /* Day grid */
        .fc-col-header-cell-cushion {
          color: ${colors.textMuted};
          text-decoration: none;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 6px 4px !important;
        }
        .fc-daygrid-day-number {
          color: ${colors.text};
          text-decoration: none;
          font-size: 0.82rem;
          font-weight: 600;
          padding: 4px 6px !important;
        }
        .fc-day-other .fc-daygrid-day-number { color: ${colors.textMuted}; opacity: 0.55; }
        .fc-day-today .fc-daygrid-day-number {
          color: ${colors.primaryText};
          font-weight: 800;
        }

        /* Events */
        .fc-event {
          border-radius: 6px !important;
          font-size: 0.74rem;
          padding: 1px 4px;
          cursor: pointer;
          border-width: 0 !important;
          border-left-width: 3px !important;
          border-left-style: solid !important;
        }
        .fc-event-title { font-weight: 600; }
        .fc-daygrid-event { margin-top: 2px !important; }

        /* Selected event: a subtle ring matched to the design system instead
           of the harsh full-blue outline that was reading as "broken". */
        .fc-event-selected {
          box-shadow: 0 0 0 2px ${colors.surface}, 0 0 0 3px ${colors.primary};
        }

        /* Time grid (Week / Day views) */
        .fc-timegrid-slot-label-cushion,
        .fc-timegrid-axis-cushion {
          color: ${colors.textMuted};
          font-size: 0.72rem;
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
        buttonText={{
          today: 'Today',
          month: 'Month',
          week: 'Week',
          day: 'Day',
        }}
        events={events}
        // Highlight the currently-selected booking so the right-hand detail
        // panel and the calendar grid stay visually correlated.
        eventClassNames={(arg) =>
          arg.event.id === selectedId ? ['fc-event-selected'] : []
        }
        eventClick={(arg: EventClickArg) => {
          // Prevent FullCalendar from following an href if one ever sneaks in;
          // we always handle navigation via React state.
          arg.jsEvent.preventDefault();
          onSelect(arg.event.id);
        }}
        height="auto"
        // Per-event color is set on the EventInput; FullCalendar's defaults
        // would otherwise paint the unified blue for everything.
        eventDisplay="block"
        nowIndicator
        weekNumbers={false}
        firstDay={1}
      />
    </section>
  );
}
