import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Package } from '@/types/api';

/** One key per view — invalidating `['packages']` refreshes both. */
export function packagesKey(activeOnly = false) {
  return ['packages', { activeOnly }] as const;
}

/**
 * The studio's packages. `activeOnly` is what a booking can be priced from;
 * Settings lists them all, since that is where one is reactivated.
 */
export function usePackages({ activeOnly = false, enabled = true } = {}) {
  return useQuery({
    queryKey: packagesKey(activeOnly),
    enabled,
    queryFn: async () => {
      const res = await api.get<Package[]>('/api/packages', {
        params: activeOnly ? { activeOnly: true } : undefined,
      });
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

/** What a package is created or edited with — see `PackageRequest` on the API. */
export interface PackagePayload {
  name: string;
  priceCents: number;
  durationHours: number | null;
  includedPhotos: number | null;
  active: boolean;
  sortOrder: number;
}

/**
 * Creates a package, or edits one when `id` is given. Refetches rather than
 * patching the cache: the list is ordered by `sortOrder`, which the save may
 * have changed, and the server is the one that knows the resulting order.
 * Resolves only once the list has been re-read, so a caller closing its form
 * on success never shows the old row for a frame.
 */
export function useSavePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; payload: PackagePayload }) =>
      (input.id
        ? await api.put<Package>(`/api/packages/${input.id}`, input.payload)
        : await api.post<Package>('/api/packages', input.payload)
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages'] }),
  });
}

export function useDeletePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/packages/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages'] }),
  });
}
