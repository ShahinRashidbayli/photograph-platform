'use client';

import React from 'react';
import { Alert, Field, Select } from '@/components/ui';
import { useSaveBooking } from '@/hooks/useBookings';
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
  // While the save runs the select shows what was picked, not the old value.
  const value =
    save.isPending && save.variables?.payload.language
      ? save.variables.payload.language
      : (booking.language ?? 'de');

  function change(language: CustomerLanguage) {
    if (language === (booking.language ?? 'de')) return;
    setError(null);
    save.mutate(
      { id: booking.id, payload: { ...currentPayload(booking), language } },
      { onError: (err) => setError(asyncError(err, 'bookings.language.error')) }
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      <Field label={t('bookings.language.label')} hint={t('bookings.language.hint')}>
        {(props) => (
          <Select
            {...props}
            value={value}
            disabled={save.isPending}
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
      {error && (
        <Alert tone="danger" style={{ marginTop: 8 }}>
          {asyncErrorText(error, t)}
        </Alert>
      )}
    </div>
  );
}
