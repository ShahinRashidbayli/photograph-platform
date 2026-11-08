import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

/** Mirrors `TenantLegalResponse` on the API: what the studio's Impressum renders. */
export interface TenantLegal {
  subdomain: string;
  legalName: string | null;
  legalStreet: string | null;
  legalPostalCode: string | null;
  legalCity: string | null;
  legalCountry: string | null;
  legalEmail: string | null;
  legalPhone: string | null;
  legalVatId: string | null;
  legalRegister: string | null;
  legalResponsible: string | null;
  privacyContactEmail: string | null;
  complete: boolean;
}

export type TenantLegalInput = Omit<TenantLegal, 'subdomain' | 'complete'>;

export function tenantLegalKey() {
  return ['tenant', 'legal'] as const;
}

export function useTenantLegal() {
  return useQuery({
    queryKey: tenantLegalKey(),
    queryFn: async () => (await api.get<TenantLegal>('/api/tenant/legal')).data,
  });
}

export function useSaveTenantLegal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TenantLegalInput) =>
      (await api.put<TenantLegal>('/api/tenant/legal', input)).data,
    onSuccess: (saved) => qc.setQueryData(tenantLegalKey(), saved),
  });
}

export function publicTenantLegalKey(subdomain: string) {
  return ['tenant', 'legal', 'public', subdomain] as const;
}

/**
 * The studio's published contact details — the Impressum the studio already
 * shows the world — which is what the client portal can honestly offer as
 * "how to reach your photographer". Fields the studio has not filled are null.
 */
export function usePublicTenantLegal(subdomain: string | null | undefined) {
  return useQuery({
    queryKey: publicTenantLegalKey(subdomain ?? ''),
    enabled: Boolean(subdomain),
    queryFn: async () =>
      (await api.get<TenantLegal>(`/api/public/legal/${encodeURIComponent(subdomain ?? '')}`)).data,
  });
}
