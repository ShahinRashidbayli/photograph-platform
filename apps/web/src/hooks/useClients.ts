import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Client } from '@/types/api';

/**
 * The client directory.
 *
 * <p>A client has no create or delete of its own: it exists because it has a
 * booking, and its totals (bookings, spend, last shoot) are derived from them
 * server-side. So anything that writes a booking marks this list stale too —
 * see `useBookings` and `useLeads`. The notes are the one field written here.
 */

export function clientsKey() {
  return ['clients'] as const;
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

export function useUpdateClientNotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; notes: string }) =>
      (await api.patch<Client>(`/api/clients/${input.id}/notes`, { notes: input.notes })).data,
    onSuccess: (updated) =>
      qc.setQueryData<Client[]>(clientsKey(), (list) =>
        list?.map((c) => (c.id === updated.id ? updated : c))
      ),
  });
}
