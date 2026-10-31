'use client';

import { useCallback, useEffect, useState } from 'react';
import { asyncError, type AsyncError } from '@/lib/async-error';
import { useTriageInquiry, useUpdateLeadStatus } from '@/hooks/useLeads';
import type { Booking, Lead } from '@/types/api';
import type { Inquiry } from './inquiryTypes';

export interface LeadActionsDeps {
  selectedLead: Lead | null;
  selectedInquiry: Inquiry | null;
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
  // Add/edit-note modal.
  notingLead: Lead | null;
  startNote: (_lead: Lead) => void;
  cancelNote: () => void;
  // Reject confirmation.
  rejectingLead: Lead | null;
  startReject: (_lead: Lead) => void;
  cancelReject: () => void;
  rejectBusy: boolean;
  confirmReject: () => void;
  // Inquiry triage + mark-lead-replied.
  inquiryBusyId: string | null;
  triageInquiry: (_status: 'ACCEPTED' | 'REJECTED') => void;
  markSelectedReplied: () => void;
  // A failed mutation surfaces here so the user sees it went wrong instead of
  // the click seeming to do nothing.
  actionError: AsyncError | null;
  dismissActionError: () => void;
}

/**
 * The inbox's transient UI state — which modal is open, the success and error
 * banners — and the actions that drive it. The data and its cache updates live
 * in `hooks/useLeads.ts`; this decides only what the screen shows around them.
 *
 * <p>When a mutation fails the affordances stay clickable so the user can
 * retry, but the failure is also surfaced via {@link LeadActions.actionError}
 * rather than swallowed — a click that silently does nothing is exactly the
 * confusion this inbox is trying to avoid.
 */
export function useLeadActions({ selectedLead, selectedInquiry }: LeadActionsDeps): LeadActions {
  const updateStatus = useUpdateLeadStatus();
  const triage = useTriageInquiry();
  const { mutate: mutateStatus } = updateStatus;
  const { mutate: mutateTriage } = triage;

  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [convertSuccess, setConvertSuccess] = useState<ConvertSuccess | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [notingLead, setNotingLead] = useState<Lead | null>(null);
  const [rejectingLead, setRejectingLead] = useState<Lead | null>(null);
  const [actionError, setActionError] = useState<AsyncError | null>(null);

  // Auto-dismiss the success banner after 6s. Cleanup on unmount / re-entry so
  // we never fire setState into a banner the user already closed.
  useEffect(() => {
    if (!convertSuccess) return;
    const timer = setTimeout(() => setConvertSuccess(null), 6000);
    return () => clearTimeout(timer);
  }, [convertSuccess]);

  // Same auto-dismiss for the error banner.
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

  const confirmReject = useCallback(() => {
    if (!rejectingLead) return;
    setActionError(null);
    mutateStatus(
      { id: rejectingLead.id, status: 'REJECTED' },
      {
        onSuccess: () => setRejectingLead(null),
        onError: (err) => {
          // Closed either way, with the failure in the banner above the inbox.
          setRejectingLead(null);
          setActionError(asyncError(err, 'leads.error.reject'));
        },
      }
    );
  }, [rejectingLead, mutateStatus]);

  const triageInquiry = useCallback(
    (status: 'ACCEPTED' | 'REJECTED') => {
      if (!selectedInquiry) return;
      setActionError(null);
      mutateTriage(
        { id: selectedInquiry.id, status },
        {
          onSuccess: (updated) => {
            // Accepting creates a booking on the server (status -> BOOKING_CREATED),
            // so surface it exactly like a lead conversion — the "view in bookings"
            // banner — rather than letting the row just quietly move buckets.
            if (status === 'ACCEPTED') {
              setConvertSuccess({
                bookingId: '',
                leadName: updated.customerName ?? selectedInquiry.customerName ?? '',
              });
            }
          },
          onError: (err) => setActionError(asyncError(err, 'leads.error.triage')),
        }
      );
    },
    [selectedInquiry, mutateTriage]
  );

  const markSelectedReplied = useCallback(() => {
    if (!selectedLead) return;
    setActionError(null);
    mutateStatus(
      { id: selectedLead.id, status: 'REPLIED' },
      { onError: (err) => setActionError(asyncError(err, 'leads.error.reply')) }
    );
  }, [selectedLead, mutateStatus]);

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
    notingLead,
    startNote: setNotingLead,
    cancelNote: () => setNotingLead(null),
    rejectingLead,
    startReject: setRejectingLead,
    cancelReject: () => setRejectingLead(null),
    rejectBusy: updateStatus.isPending && updateStatus.variables?.status === 'REJECTED',
    confirmReject,
    inquiryBusyId: triage.isPending ? (triage.variables?.id ?? null) : null,
    triageInquiry,
    markSelectedReplied,
    actionError,
    dismissActionError: () => setActionError(null),
  };
}
