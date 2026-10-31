import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

/** Mirrors `ResourceResponse` on the API: a room or a piece of kit. */
export interface StudioResource {
  id: string;
  name: string;
  kind: 'ROOM' | 'EQUIPMENT';
  notes: string | null;
  active: boolean;
}

/** One key per view — invalidating `['resources']` refreshes both. */
export function resourcesKey(includeRetired = false) {
  return ['resources', { includeRetired }] as const;
}

/**
 * The studio's rooms and kit. Active only by default: a retired resource
 * cannot be booked onto new work, which is what retiring it meant. Settings is
 * the one caller that needs `includeRetired`, since that is where one is
 * brought back.
 */
export function useResources({ includeRetired = false, enabled = true } = {}) {
  return useQuery({
    queryKey: resourcesKey(includeRetired),
    enabled,
    queryFn: async () => {
      const res = await api.get<StudioResource[]>('/api/resources', {
        params: includeRetired ? { includeRetired: true } : undefined,
      });
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

export function useCreateResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; kind: StudioResource['kind'] }) => {
      await api.post('/api/resources', input);
    },
    // Both views — the booking form's picker as well as this list.
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resources'] }),
  });
}

/** Edits a resource; retiring and bringing back are this with `active` flipped. */
export function useUpdateResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (resource: Omit<StudioResource, 'id'> & { id: string }) => {
      const { id, ...body } = resource;
      await api.put(`/api/resources/${id}`, body);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resources'] }),
  });
}
