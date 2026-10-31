import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { fetchAllPages } from '@/lib/paging';
import { attentionKey } from '@/hooks/useAttention';
import { clientsKey } from '@/hooks/useClients';
import type { Booking, Lead, LeadActivity } from '@/types/api';
import type { Inquiry } from '@/app/(dashboard)/leads/inquiryTypes';

/**
 * The enquiry inbox: anonymous-form leads and authenticated customer
 * inquiries, which the Leads screen shows as one list and the dashboard
 * counts.
 *
 * <p>Both lists are read page by page. `/api/leads` defaults to 20 rows when
 * no size is given and neither screen has a pager, so a single request
 * silently stopped at the 20 most recent — every older lead was unreachable on
 * the inbox and missing from the dashboard's numbers.
 *
 * <p>Converting a lead or accepting an inquiry creates a booking server-side,
 * so those two mutations also mark every bookings view stale: the success
 * banner offers "View in bookings →", and that screen must not open on a list
 * without the booking just made.
 *
 * <p>Every mutation here also refreshes the bell ({@link attentionKey}): it
 * counts NEW leads and PENDING inquiries, so each of these can change it.
 */

export function leadsKey() {
  return ['leads'] as const;
}

export function leadActivityKey(leadId: string) {
  return ['leads', leadId, 'activity'] as const;
}

export function inquiriesKey() {
  return ['inquiries'] as const;
}

export function useLeads(enabled = true) {
  return useQuery({
    queryKey: leadsKey(),
    enabled,
    queryFn: () => fetchAllPages<Lead>('/api/leads'),
  });
}

/**
 * Best-effort: a failure here must not blank the leads beside it, so it reads
 * as "no inquiries" rather than as an error.
 */
export function useInquiries(enabled = true) {
  return useQuery({
    queryKey: inquiriesKey(),
    enabled,
    queryFn: async () => {
      try {
        return await fetchAllPages<Inquiry>('/api/inquiries');
      } catch {
        return [];
      }
    },
  });
}

/**
 * One lead's history. Best-effort like the inquiries: the detail panel must
 * not fail over its timeline, so a failure reads as "no activity yet".
 */
export function useLeadActivity(leadId: string | null | undefined) {
  return useQuery({
    queryKey: leadActivityKey(leadId ?? ''),
    enabled: Boolean(leadId),
    queryFn: async () => {
      try {
        const res = await api.get<LeadActivity[]>(`/api/leads/${leadId}/activity`);
        return Array.isArray(res.data) ? res.data : [];
      } catch {
        return [];
      }
    },
  });
}

export interface NewLead {
  name: string;
  email: string;
  phone: string | null;
  eventDate: string;
  eventType: Lead['eventType'];
  budgetRange: Lead['budgetRange'];
  message: string;
}

/** What a lead is converted with — see `ConvertLeadRequest` on the API. */
export interface ConvertLeadPayload {
  eventTime: string | null;
  location: string | null;
  packageId: string | null;
  totalAmountCents: number | null;
  depositAmountCents: number | null;
  internalNotes: string | null;
}

/** Writes one lead back into the cached inbox, and refreshes its timeline. */
function useApplyLead() {
  const qc = useQueryClient();
  return (updated: Lead) => {
    qc.setQueryData<Lead[]>(leadsKey(), (list) =>
      list?.map((l) => (l.id === updated.id ? updated : l))
    );
    return Promise.all([
      // Status and note changes are recorded as activity on the server.
      qc.invalidateQueries({ queryKey: leadActivityKey(updated.id) }),
      qc.invalidateQueries({ queryKey: attentionKey() }),
    ]);
  };
}

/** Both audiences' booking lists, and the clients derived from them, since a conversion adds to them. */
function invalidateBookings(qc: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['bookings'] }),
    qc.invalidateQueries({ queryKey: clientsKey() }),
  ]);
}

/** An enquiry that arrived off-platform — a phone call, an email, a fair. */
export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lead: NewLead) => (await api.post<Lead>('/api/leads', lead)).data,
    // Refetched rather than prepended: the server scores the lead, and the
    // inbox sorts and buckets by that score.
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: leadsKey(), exact: true }),
        qc.invalidateQueries({ queryKey: attentionKey() }),
      ]),
  });
}

export function useUpdateLeadNotes() {
  const applyLead = useApplyLead();
  return useMutation({
    mutationFn: async (input: { id: string; notes: string | null }) =>
      (await api.patch<Lead>(`/api/leads/${input.id}/notes`, { notes: input.notes })).data,
    onSuccess: applyLead,
  });
}

/** Marking replied, or rejecting. Converting has its own hook — it makes a booking. */
export function useUpdateLeadStatus() {
  const applyLead = useApplyLead();
  return useMutation({
    mutationFn: async (input: { id: string; status: 'REPLIED' | 'REJECTED' }) =>
      (await api.patch<Lead>(`/api/leads/${input.id}/status`, { status: input.status })).data,
    onSuccess: applyLead,
  });
}

/**
 * Turns a lead into a booking. A 409 means it was already converted — the
 * API's idempotency contract — and its message says so, which is why callers
 * show the server's text when there is one.
 */
export function useConvertLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; payload: ConvertLeadPayload }) =>
      (await api.post<Booking>(`/api/leads/${input.id}/convert`, input.payload)).data,
    onSuccess: (_booking, input) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: leadsKey(), exact: true }),
        qc.invalidateQueries({ queryKey: leadActivityKey(input.id) }),
        qc.invalidateQueries({ queryKey: attentionKey() }),
        invalidateBookings(qc),
      ]),
  });
}

/** Accepting creates a booking server-side (status → BOOKING_CREATED). */
export function useTriageInquiry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: 'ACCEPTED' | 'REJECTED' }) =>
      (await api.patch<Inquiry>(`/api/inquiries/${input.id}/status`, { status: input.status }))
        .data,
    onSuccess: (updated, input) => {
      qc.setQueryData<Inquiry[]>(inquiriesKey(), (list) =>
        list?.map((i) => (i.id === updated.id ? updated : i))
      );
      return Promise.all([
        qc.invalidateQueries({ queryKey: attentionKey() }),
        input.status === 'ACCEPTED' ? invalidateBookings(qc) : undefined,
      ]);
    },
  });
}
