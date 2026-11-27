import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

/** Mirrors `ContractResponse` on the API. */
export interface Contract {
  id: string;
  bookingId: string;
  status: 'DRAFT' | 'SENT' | 'SIGNED' | 'CANCELLED';
  title: string;
  body: string;
  recipientName: string;
  recipientEmail: string;
  issuerName: string | null;
  issuerAddress: string | null;
  issuerEmail: string | null;
  signerName: string | null;
  signedAt: string | null;
  sentAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  editable: boolean;
  intact: boolean;
}

/**
 * Contracts for both audiences.
 *
 * <p>The two sides read different endpoints for the reason the invoice hooks
 * do: the photographer asks by booking id, while a customer has no booking id
 * to ask with — that surface is closed to CUSTOMER tokens — and instead gets
 * the contracts addressed to their own email from `/api/customer/contracts`.
 * The customer endpoint also never returns drafts, so nothing here has to
 * remember to filter them out.
 */

export function bookingContractsKey(bookingId: string) {
  return ['contracts', 'booking', bookingId] as const;
}

export function customerContractsKey() {
  return ['contracts', 'customer'] as const;
}

export function tenantContractsKey() {
  return ['contracts', 'tenant'] as const;
}

/**
 * Every contract in the studio, newest first.
 *
 * <p>The question this answers — "which of these is still unsigned?" — had no
 * screen at all: contracts were reachable only from the booking they belong to,
 * so a photographer with twenty bookings had to open twenty of them to find the
 * one they were waiting on.
 */
export function useTenantContracts(enabled = true) {
  return useQuery({
    queryKey: tenantContractsKey(),
    enabled,
    queryFn: async () => {
      const res = await api.get<Contract[]>('/api/contracts');
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

/** Photographer view: the contracts drafted against one booking. */
export function useBookingContracts(bookingId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: bookingContractsKey(bookingId ?? ''),
    enabled: Boolean(bookingId) && enabled,
    queryFn: async () => {
      const res = await api.get<Contract[]>(`/api/bookings/${bookingId}/contracts`);
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

/** Client view: every contract addressed to the signed-in customer. */
export function useCustomerContracts(enabled = true) {
  return useQuery({
    queryKey: customerContractsKey(),
    enabled,
    queryFn: async () => {
      const res = await api.get<Contract[]>('/api/customer/contracts');
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

export function useCreateContract(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title?: string; body?: string }) =>
      (await api.post<Contract>(`/api/bookings/${bookingId}/contracts`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: bookingContractsKey(bookingId) }),
  });
}

export function useUpdateContract(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; title: string; body: string }) =>
      (
        await api.put<Contract>(`/api/contracts/${input.id}`, {
          title: input.title,
          body: input.body,
        })
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: bookingContractsKey(bookingId) }),
  });
}

/**
 * Mirrors `SendContractRequest` on the API: the body of both `…/send` and
 * `…/resend`. `note` is the photographer's optional Personal note to the
 * Customer, at most 1000 characters; it is never stored on the contract.
 */
export interface SendContractRequest {
  note: string | null;
}

/** "An Kunden senden": freezes the draft and emails the Customer a link to sign it. */
export function useSendContract(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string } & SendContractRequest) =>
      (
        await api.post<Contract>(`/api/contracts/${input.id}/send`, {
          note: input.note,
        } satisfies SendContractRequest)
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: bookingContractsKey(bookingId) }),
  });
}

/**
 * "Erneut senden": emails a SENT contract to the Customer again — for the one
 * whose first email went missing. The contract itself does not change, but
 * the list is still refreshed rather than patched: the server decides what the
 * row says, and the photographer should see what it now holds.
 */
export function useResendContract(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string } & SendContractRequest) =>
      (
        await api.post<Contract>(`/api/contracts/${input.id}/resend`, {
          note: input.note,
        } satisfies SendContractRequest)
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: bookingContractsKey(bookingId) }),
  });
}

export function useCancelContract(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.post<Contract>(`/api/contracts/${id}/cancel`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: bookingContractsKey(bookingId) }),
  });
}

/**
 * The customer's signature.
 *
 * <p>`agreed` is sent rather than assumed. The server rejects a request without
 * it, which is the point — consent has to be something the signer did, not a
 * default this client filled in on their behalf.
 */
export function useSignContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; typedName: string }) =>
      (
        await api.post<Contract>(`/api/customer/contracts/${input.id}/sign`, {
          typedName: input.typedName,
          agreed: true,
        })
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: customerContractsKey() }),
  });
}

/**
 * Downloads a contract PDF through the API client, so the request carries the
 * session the same way every other call does.
 *
 * <p>A plain `<a href>` to the endpoint would be simpler and wrong: it leaves
 * the axios instance, so it misses the auth header and the refresh-on-401
 * retry, and a expired-token download would render a JSON error into a file
 * named like a contract.
 */
export async function downloadContractPdf(url: string, filename: string) {
  const res = await api.get<Blob>(url, { responseType: 'blob' });
  const href = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}
