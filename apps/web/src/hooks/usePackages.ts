import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Package } from '@/types/api';

/** One key per view — invalidating `['packages']` refreshes both. */
export function packagesKey(activeOnly = false) {
  return ['packages', { activeOnly }] as const;
}

/**
 * The studio's packages. `activeOnly` is what a booking can be priced from;
 * Settings lists them all, since that is where one is reactivated.
 *
 * <p>`staleTime: 0` for the reason given on `useTeam`.
 */
export function usePackages({ activeOnly = false, enabled = true } = {}) {
  return useQuery({
    queryKey: packagesKey(activeOnly),
    enabled,
    staleTime: 0,
    queryFn: async () => {
      const res = await api.get<Package[]>('/api/packages', {
        params: activeOnly ? { activeOnly: true } : undefined,
      });
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}
