'use client';

import { type Dispatch, type SetStateAction, useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import type { Booking, Lead } from '@/types/api';
import type { Inquiry } from './inquiryTypes';

export interface LeadActionsDeps {
  reload: () => void;
  setLeads: Dispatch<SetStateAction<Lead[]>>;
  setInquiries: Dispatch<SetStateAction<Inquiry[]>>;
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
  applyNoteSaved: (_updated: Lead) => void;
  // Reject confirmation.
  rejectingLead: Lead | null;
  startReject: (_lead: Lead) => void;
  cancelReject: () => void;
  rejectBusy: boolean;
  confirmReject: () => Promise<void>;
  // Inquiry triage + mark-lead-replied — both patch a single row in place.
  inquiryBusyId: string | null;
  triageInquiry: (_status: 'ACCEPTED' | 'REJECTED') => Promise<void>;
  markSelectedReplied: () => Promise<void>;
  // A failed mutation surfaces here so the user sees it went wrong instead of
  // the click seeming to do nothing.
  actionError: string | null;
  dismissActionError: () => void;
}

/**
 * Owns every mutation the leads inbox can perform plus the transient modal /
 * banner / busy state each one needs. Extracted from the page so those handlers
 * stop living as inline async closures inside the JSX.
 *
 * <p>Mutations that touch one row (note save, mark-replied, inquiry triage)
 * patch it in place via the inbox setters rather than re-fetching, so a
 * single-field flip doesn't flash the whole list through a loading state.
 * Convert and reject go through a full {@link LeadActionsDeps.reload} because
 * they move an item between pipeline buckets.
 *
 * <p>When a mutation fails the affordances stay clickable so the user can
 * retry, but the failure is also surfaced via {@link LeadActions.actionError}
 * rather than swallowed — a click that silently does nothing is exactly the
 * confusion this inbox is trying to avoid.
 */
export function useLeadActions(deps: LeadActionsDeps): LeadActions {
  const { reload, setLeads, setInquiries, selectedLead, selectedInquiry } = deps;

  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [convertSuccess, setConvertSuccess] = useState<ConvertSuccess | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [notingLead, setNotingLead] = useState<Lead | null>(null);
  const [rejectingLead, setRejectingLead] = useState<Lead | null>(null);
  const [rejectBusy, setRejectBusy] = useState(false);
  const [inquiryBusyId, setInquiryBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

  const applyConverted = useCallback(
    (booking: Booking) => {
      // Read the lead being converted before clearing it so the banner keeps
      // its name even as the modal unmounts.
      setConvertingLead((lead) => {
        if (lead) setConvertSuccess({ bookingId: booking.id, leadName: lead.name });
        return null;
      });
      reload();
    },
    [reload],
  );

  const applyNoteSaved = useCallback(
    (updated: Lead) => {
      // Patch in place so the detail panel reflects the new note immediately,
      // without a full reload flashing a loading state.
      setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      setNotingLead(null);
    },
    [setLeads],
  );

  const confirmReject = useCallback(async () => {
    if (!rejectingLead) return;
    setRejectBusy(true);
    setActionError(null);
    try {
      await api.patch<Lead>(`/api/leads/${rejectingLead.id}/status`, { status: 'REJECTED' });
      setRejectingLead(null);
      reload();
    } catch {
      // Dialog stays open so the user can retry.
      setActionError('Could not reject the lead. Please try again.');
    } finally {
      setRejectBusy(false);
    }
  }, [rejectingLead, reload]);

  const triageInquiry = useCallback(
    async (status: 'ACCEPTED' | 'REJECTED') => {
      if (!selectedInquiry) return;
      setInquiryBusyId(selectedInquiry.id);
      setActionError(null);
      try {
        const { data } = await api.patch<Inquiry>(
          `/api/inquiries/${selectedInquiry.id}/status`,
          { status },
        );
        setInquiries((prev) => prev.map((i) => (i.id === data.id ? data : i)));
      } catch {
        setActionError('Could not update the request. Please try again.');
      } finally {
        setInquiryBusyId(null);
      }
    },
    [selectedInquiry, setInquiries],
  );

  const markSelectedReplied = useCallback(async () => {
    if (!selectedLead) return;
    setActionError(null);
    try {
      const res = await api.patch<Lead>(`/api/leads/${selectedLead.id}/status`, { status: 'REPLIED' });
      setLeads((prev) => prev.map((l) => (l.id === res.data.id ? res.data : l)));
    } catch {
      setActionError('Could not mark as replied. Please try again.');
    }
  }, [selectedLead, setLeads]);

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
    applyNoteSaved,
    rejectingLead,
    startReject: setRejectingLead,
    cancelReject: () => setRejectingLead(null),
    rejectBusy,
    confirmReject,
    inquiryBusyId,
    triageInquiry,
    markSelectedReplied,
    actionError,
    dismissActionError: () => setActionError(null),
  };
}
