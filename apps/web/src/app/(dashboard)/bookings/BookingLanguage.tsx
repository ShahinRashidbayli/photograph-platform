'use client';

import React from 'react';
import { useIsMutating } from '@tanstack/react-query';
import { Alert, Field, Select } from '@/components/ui';
import { saveBookingKey, useSaveBooking } from '@/hooks/useBookings';
import { asyncError, asyncErrorText, type AsyncError } from '@/lib/async-error';
import { useTranslation, type TranslationKey } from '@/lib/i18n';
import type { Booking, CustomerLanguage } from '@/types/api';
import { currentPayload } from './BookingNotes';

/**
 * Each language named in itself, as a language picker does: a photographer
 * working in English still looks for "Deutsch".
 */
const LANGUAGES: ReadonlyArray<{ value: CustomerLanguage; labelKey: TranslationKey }> = [
  { value: 'de', labelKey: 'bookings.language.de' },
  { value: 'en', labelKey: 'bookings.language.en' },
];

/**
 * The language the studio's Customer messages for this booking are written in.
 *
 * <p>A booking from the request forms carries the language the Customer wrote
 * in; one typed in by hand starts at German. This is where the photographer
 * corrects it — saved on change, since there is nothing else to fill in.
 */
export function BookingLanguage({ booking }: { booking: Booking }) {
  const { t } = useTranslation();
  const save = useSaveBooking();
  const [error, setError] = React.useState<AsyncError | null>(null);
  const current = booking.language ?? 'de';
  // The update is replace-style, so this save echoes the note as `booking`
  // holds it. While the note's own save is still running that is the old
  // note, and a language change then would put it back — so wait for any save
  // of this booking, not just this one.
  const savingThisBooking =
    useIsMutating({
      mutationKey: saveBookingKey(),
      predicate: (m) => (m.state.variables as { id?: string } | undefined)?.id === booking.id,
    }) > 0;
  // While the save runs the select shows what was picked, not the old value.
  const value =
    save.isPending && save.variables?.payload.language ? save.variables.payload.language : current;

  function change(language: CustomerLanguage) {
    if (language === current) return;
    setError(null);
    save.mutate(
      { id: booking.id, payload: { ...currentPayload(booking), language } },
      { onError: (err) => setError(asyncError(err, 'bookings.language.error')) }
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      {error && (
        <Alert tone="danger" style={{ marginBottom: 8 }}>
          {asyncErrorText(error, t)}
        </Alert>
      )}
      <Field label={t('bookings.language.label')} hint={t('bookings.language.hint')}>
        {(props) => (
          <Select
            {...props}
            value={value}
            disabled={savingThisBooking}
            onChange={(e) => change(e.target.value as CustomerLanguage)}
            style={{ maxWidth: 200 }}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {t(l.labelKey)}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </div>
  );
}
