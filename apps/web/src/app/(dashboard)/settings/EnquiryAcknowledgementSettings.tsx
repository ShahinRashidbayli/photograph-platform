'use client';

import React, { useState } from 'react';
import { asyncError, asyncErrorText, type AsyncError } from '@/lib/async-error';
import { useTranslation } from '@/lib/i18n';
import {
  useEnquiryAcknowledgement,
  useSaveEnquiryAcknowledgement,
} from '@/hooks/useEnquiryAcknowledgement';
import { Alert, Toggle } from '@/components/ui';

/**
 * The switch for the automatic "Enquiry received" Customer message.
 *
 * <p>On by default: a Customer should know their enquiry arrived and with whom.
 * A photographer who answers every enquiry personally turns it off, so their
 * Customers only ever get their own words. Leads typed in by hand never get it
 * either way — that is the server's rule, not this switch's.
 */
export function EnquiryAcknowledgementSettings() {
  const { t } = useTranslation();
  const q = useEnquiryAcknowledgement();
  const save = useSaveEnquiryAcknowledgement();
  const [actionError, setActionError] = useState<AsyncError | null>(null);
  // While the save runs the switch shows where it is going, not where it was.
  const enabled = save.isPending ? save.variables : (q.data?.enabled ?? true);
  const error =
    actionError ?? (q.isError ? asyncError(q.error, 'settings.enquiryAck.loadError') : null);

  function change(next: boolean) {
    setActionError(null);
    save.mutate(next, {
      onError: (err) => setActionError(asyncError(err, 'settings.enquiryAck.saveError')),
    });
  }

  return (
    <>
      {error && <Alert tone="danger">{asyncErrorText(error, t)}</Alert>}
      {/* Not drawn until the server has answered: a switch at its default would
          tell the photographer "On" about a studio that may have turned it off. */}
      {q.data && (
        <Toggle
          checked={enabled}
          onChange={change}
          disabled={save.isPending}
          label={t('settings.enquiryAck.label')}
          description={enabled ? t('settings.enquiryAck.on') : t('settings.enquiryAck.off')}
        />
      )}
    </>
  );
}
