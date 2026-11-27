import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Booking, Client, Invoice } from '@/types/api';
import type { Contract } from '@/hooks/useContracts';
import type { Gallery } from '@/hooks/useGalleries';

/**
 * The client directory.
 *
 * <p>A client has no create or delete of its own: it exists because it has a
 * booking, and its totals (bookings, spend, last shoot) are derived from them
 * server-side. So anything that writes a booking marks this list stale too —
 * see `useBookings` and `useLeads`. The notes are the one field written here.
 *
 * <p>A client's detail sits under the same key prefix, so marking the list
 * stale marks every detail stale with it.
 */

/** Mirrors `ClientDetailResponse` on the API: one client and what hangs off their bookings. */
export interface ClientDetail {
  client: Client;
  /** Every status, Not happening included, latest shoot first. */
  bookings: Booking[];
  galleries: Gallery[];
  invoices: Invoice[];
  contracts: Contract[];
}

export function clientsKey() {
  return ['clients'] as const;
}

export function clientKey(id: string) {
  return ['clients', 'detail', id] as const;
}

export function useClients() {
  return useQuery({
    queryKey: clientsKey(),
    queryFn: async () => {
      const res = await api.get<Client[]>('/api/clients');
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

export function useClient(id: string | null | undefined) {
  return useQuery({
    queryKey: clientKey(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data } = await api.get<ClientDetail>(`/api/clients/${id}`);
      return {
        client: data.client,
        bookings: Array.isArray(data.bookings) ? data.bookings : [],
        galleries: Array.isArray(data.galleries) ? data.galleries : [],
        invoices: Array.isArray(data.invoices) ? data.invoices : [],
        contracts: Array.isArray(data.contracts) ? data.contracts : [],
      };
    },
  });
}

export function useUpdateClientNotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; notes: string }) =>
      (await api.patch<Client>(`/api/clients/${input.id}/notes`, { notes: input.notes })).data,
    onSuccess: (updated) => {
      qc.setQueryData<Client[]>(clientsKey(), (list) =>
        list?.map((c) => (c.id === updated.id ? updated : c))
      );
      qc.setQueryData<ClientDetail>(clientKey(updated.id), (detail) =>
        detail ? { ...detail, client: updated } : detail
      );
    },
  });
}
