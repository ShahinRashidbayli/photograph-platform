'use client';

import { useCallback, useEffect, useState } from 'react';
import { asyncError, type AsyncError } from '@/lib/async-error';
import type { TranslationKey } from '@/lib/i18n';
import { useTriageInquiry } from '@/hooks/useLeads';
import type { Booking, Lead } from '@/types/api';
import type { Inquiry } from './inquiryTypes';

/** A request decision being made in the Personal note dialog. */
export interface Decision {
  inquiry: Inquiry;
  status: 'ACCEPTED' | 'REJECTED';
}

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
  // Deciding a client's request: accepting creates the booking, and either
  // way the server emails the Customer, with the optional Personal note.
  deciding: Decision | null;
  startDecision: (_inquiry: Inquiry, _status: Decision['status']) => void;
  cancelDecision: () => void;
  decide: (_note: string | null) => void;
  /** The decision request is running — from the mutation, never local state. */
  decisionPending: boolean;
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
  const triage = useTriageInquiry();
  const { mutate: mutateTriage } = triage;

  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [convertSuccess, setConvertSuccess] = useState<ConvertSuccess | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deciding, setDeciding] = useState<Decision | null>(null);
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

  const decide = useCallback(
    (note: string | null) => {
      if (!deciding) return;
      const { inquiry, status } = deciding;
      setActionError(null);
      mutateTriage(
        { id: inquiry.id, status, note },
        {
          // Accepting creates a booking on the server, so it is announced
          // exactly like a lead conversion — the "view in bookings" banner.
          onSuccess: (updated) => {
            if (status === 'ACCEPTED') {
              setConvertSuccess({
                bookingId: '',
                leadName: updated.customerName ?? inquiry.customerName ?? '',
              });
            }
          },
          onError: (err) => setActionError(asyncError(err, 'leads.error.triage')),
          // Closed on failure too: the error shows above the inbox, not in a
          // dialog that would invite a second click and a second email.
          onSettled: () => setDeciding(null),
        }
      );
    },
    [deciding, mutateTriage]
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
    deciding,
    startDecision: (inquiry, status) => setDeciding({ inquiry, status }),
    cancelDecision: () => setDeciding(null),
    decide,
    decisionPending: triage.isPending,
    actionError,
    reportError,
    dismissActionError: () => setActionError(null),
  };
}
