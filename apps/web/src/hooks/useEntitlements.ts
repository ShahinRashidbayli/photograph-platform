'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useIsPhotographer } from '@/store/authStore';

/** Mirrors `EntitlementsResponse` on the API. */
export interface Entitlements {
  plan: string;
  capabilities: string[];
  galleryRetentionDays: number;
  seats: number;
  commissionBps: number;
  writable: boolean;
  lockReason: string | null;
  trialEndsAt: string | null;
  subscriptionStatus: string;
}

export const entitlementsKey = ['entitlements'] as const;

/**
 * What this tenant's plan includes, as the API itself sees it.
 *
 * <p>`GET /api/entitlements` serves the same object the server gates on, so a
 * screen that reads this cannot disagree with what is actually enforced. That
 * is the whole point: hiding a control the API would refuse is honest, while
 * showing one it will refuse is a bug the customer discovers by clicking.
 *
 * <p>Cached through React Query rather than fetched per component. Three places
 * ask now — the sidebar, the team section and the lock banner — and a plan does
 * not change while somebody is looking at a page, so one request serves all of
 * them.
 *
 * <p>Not asked for clients: they share the tenant but are not the party being
 * billed, and every capability here describes the photographer's plan.
 */
export function useEntitlements() {
  const isPhotographer = useIsPhotographer();

  const { data, isLoading } = useQuery({
    queryKey: entitlementsKey,
    queryFn: async () => (await api.get<Entitlements>('/api/entitlements')).data,
    enabled: isPhotographer,
    staleTime: 5 * 60_000,
    // A plan gate that cannot load must not hide the app: callers treat
    // `undefined` as "not known yet" and render nothing rather than a locked
    // state they cannot verify.
    retry: false,
  });

  return {
    entitlements: data,
    isLoading,
    /** Whether the plan grants a capability. False until the answer is known. */
    has: (capability: string) => data?.capabilities?.includes(capability) ?? false,
    seats: data?.seats ?? 1,
  };
}
