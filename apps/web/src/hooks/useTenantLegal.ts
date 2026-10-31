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
