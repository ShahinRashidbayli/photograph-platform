'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button } from '@/components/ui';
import { useSaveBooking, type BookingPayload } from '@/hooks/useBookings';
import { extractApiError } from '@/lib/helpers';
import { useTranslation } from '@/lib/i18n';
import type { Booking } from '@/types/api';
import type { getDetailStyles } from './bookingDetail.styles';

/**
 * The booking's update payload with only the note changed.
 *
 * <p>`PATCH /api/bookings/{id}` is replace-style, so every field goes back as
 * the booking has it — except `resourceIds`, which is left out: absent means
 * "keep", and this screen never loaded the resource list it would otherwise
 * have to echo.
 */
export function notePayload(booking: Booking, note: string): BookingPayload {
  return {
    clientName: booking.clientName,
    clientEmail: booking.clientEmail,
    eventDate: booking.eventDate,
    eventTime: booking.eventTime ? booking.eventTime.slice(0, 5) : null,
    eventType: booking.eventType ?? null,
    location: booking.location ?? null,
    packageId: booking.packageId ?? null,
    totalAmountCents: booking.totalAmountCents,
    depositAmountCents: booking.depositAmountCents,
    internalNotes: note.trim() || null,
    assignedUserId: booking.assignedUserId ?? null,
  };
}

/**
 * The private note, edited where it is read.
 *
 * <p>It used to be read-only here and editable only inside the full edit
 * dialog — eleven fields to open for one line about a step ladder. Mounted
 * with `key={booking.id}` by the detail, so switching bookings never carries an
 * unsaved draft over to the wrong client.
 */
export function BookingNotes({
  booking,
  s,
}: {
  booking: Booking;
  s: ReturnType<typeof getDetailStyles>;
}) {
  const { t } = useTranslation();
  const save = useSaveBooking();
  const fromServer = booking.internalNotes ?? '';
  // What the server last held, as far as this field knows. Updated on a
  // successful save rather than waiting for the cached booking to come back,
  // so "Saved" never depends on the list refetch landing first.
  const [saved, setSaved] = useState(fromServer);
  const [draft, setDraft] = useState(fromServer);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const dirty = draft.trim() !== saved.trim();

  // Changed elsewhere (the edit dialog): adopt it, unless a draft is open —
  // overwriting what someone is typing would be worse than a stale baseline.
  const savedRef = useRef(saved);
  savedRef.current = saved;
  useEffect(() => {
    setDraft((d) => (d.trim() === savedRef.current.trim() ? fromServer : d));
    setSaved(fromServer);
  }, [fromServer]);

  function submit() {
    if (!dirty || save.isPending) return;
    setError(null);
    const note = draft;
    save.mutate(
      { id: booking.id, payload: notePayload(booking, note) },
      {
        onSuccess: () => {
          setSaved(note);
          setJustSaved(true);
        },
        onError: (err) => setError(extractApiError(err, t('bookings.notes.error'))),
      }
    );
  }

  return (
    <section style={s.section}>
      <label htmlFor={`bk-note-${booking.id}`} style={s.notesLabel}>
        <span style={s.h3}>{t('bookings.notes.title')}</span>
        <span style={s.notesHint}>{t('bookings.notes.hint')}</span>
      </label>
      <textarea
        id={`bk-note-${booking.id}`}
        rows={3}
        value={draft}
        placeholder={t('bookings.notes.placeholder')}
        onChange={(e) => {
          setDraft(e.target.value);
          setJustSaved(false);
        }}
        onKeyDown={(e) => {
          // ⌘/Ctrl+Enter saves without reaching for the mouse.
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
        style={s.notesArea}
      />
      <div style={s.notesActions} aria-live="polite">
        {dirty && (
          <>
            <Button size="sm" variant="primary" busy={save.isPending} onClick={submit}>
              {save.isPending ? t('bookings.notes.saving') : t('bookings.notes.save')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={save.isPending}
              onClick={() => {
                setDraft(saved);
                setError(null);
              }}
            >
              {t('bookings.notes.discard')}
            </Button>
          </>
        )}
        {!dirty && justSaved && <span style={s.notesStatus}>{t('bookings.notes.saved')}</span>}
      </div>
      {error && (
        <Alert tone="danger" style={{ marginTop: 8 }}>
          {error}
        </Alert>
      )}
    </section>
  );
}
