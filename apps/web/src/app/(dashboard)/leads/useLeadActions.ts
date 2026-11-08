'use client';

import { useCallback, useEffect, useState } from 'react';
import { asyncError, type AsyncError } from '@/lib/async-error';
import type { TranslationKey } from '@/lib/i18n';
import { useTriageInquiry } from '@/hooks/useLeads';
import type { Booking, Lead } from '@/types/api';
import type { Inquiry } from './inquiryTypes';

export interface ConvertSuccess {
  bookingId: string;
  leadName: string;
}

export interface LeadActions {
  // Convert-to-booking modal + post-success banner.
  convertingLead: Lead | null;
  startConvert: (_lead: Lead) => void;
  cancelConvert: () => void;
  applyConverted: (_booking: Booking) => void;
  convertSuccess: ConvertSuccess | null;
  dismissConvertSuccess: () => void;
  // Add-lead modal (off-platform enquiries).
  addOpen: boolean;
  openAdd: () => void;
  closeAdd: () => void;
  // Accepting a client's request (creates the booking).
  acceptInquiry: (_inquiry: Inquiry) => void;
  // A failed mutation surfaces here so the user sees it went wrong instead of
  // the click seeming to do nothing.
  actionError: AsyncError | null;
  reportError: (_err: unknown, _key: TranslationKey) => void;
  dismissActionError: () => void;
}

/**
 * The inbox's transient UI state — which modal is open, the success and error
 * banners — and the actions that drive it. The data and its cache updates live
 * in `hooks/useLeads.ts`; replying and declining (with their undo window) in
 * `useDeferredStatus`.
 */
export function useLeadActions(): LeadActions {
  const { mutate: mutateTriage } = useTriageInquiry();

  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [convertSuccess, setConvertSuccess] = useState<ConvertSuccess | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [actionError, setActionError] = useState<AsyncError | null>(null);

  // Auto-dismiss the success banner after 6s. Cleanup on unmount / re-entry so
  // we never fire setState into a banner the user already closed.
  useEffect(() => {
    if (!convertSuccess) return;
    const timer = setTimeout(() => setConvertSuccess(null), 6000);
    return () => clearTimeout(timer);
  }, [convertSuccess]);

  useEffect(() => {
    if (!actionError) return;
    const timer = setTimeout(() => setActionError(null), 6000);
    return () => clearTimeout(timer);
  }, [actionError]);

  const applyConverted = useCallback((booking: Booking) => {
    // Read the lead being converted before clearing it so the banner keeps
    // its name even as the modal unmounts.
    setConvertingLead((lead) => {
      if (lead) setConvertSuccess({ bookingId: booking.id, leadName: lead.name });
      return null;
    });
  }, []);

  const acceptInquiry = useCallback(
    (inquiry: Inquiry) => {
      setActionError(null);
      mutateTriage(
        { id: inquiry.id, status: 'ACCEPTED' },
        {
          // Accepting creates a booking on the server, so it is announced
          // exactly like a lead conversion — the "view in bookings" banner.
          onSuccess: (updated) =>
            setConvertSuccess({
              bookingId: '',
              leadName: updated.customerName ?? inquiry.customerName ?? '',
            }),
          onError: (err) => setActionError(asyncError(err, 'leads.error.triage')),
        }
      );
    },
    [mutateTriage]
  );

  const reportError = useCallback(
    (err: unknown, key: TranslationKey) => setActionError(asyncError(err, key)),
    []
  );

  return {
    convertingLead,
    startConvert: setConvertingLead,
    cancelConvert: () => setConvertingLead(null),
    applyConverted,
    convertSuccess,
    dismissConvertSuccess: () => setConvertSuccess(null),
    addOpen,
    openAdd: () => setAddOpen(true),
    closeAdd: () => setAddOpen(false),
    acceptInquiry,
    actionError,
    reportError,
    dismissActionError: () => setActionError(null),
  };
}
