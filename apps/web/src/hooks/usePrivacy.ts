import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

type RetentionBasis = 'TAX_RECORDS' | 'LEGAL_CLAIMS';

/** One kind of record, as `POST /api/privacy/erasure[/preview]` reports it. */
export interface ErasureItem {
  category: string;
  deleted: number;
  anonymized: number;
  retained: number;
  retentionBasis: RetentionBasis | null;
}

/** Mirrors `ErasureReportResponse` on the API. */
interface ErasureReport {
  executed: boolean;
  items: ErasureItem[];
}

/**
 * The server runs the real erasure and rolls it back, so a preview is exactly
 * what the erase will do. Nothing changes, so nothing is invalidated.
 */
export function usePreviewErasure() {
  return useMutation({
    mutationFn: async (email: string) =>
      (await api.post<ErasureReport>('/api/privacy/erasure/preview', { email })).data.items,
  });
}

/**
 * Erases one person's data from the studio (Art. 17 GDPR).
 *
 * <p>Invalidates everything cached. An erasure reaches clients, leads,
 * inquiries, bookings, galleries, contracts and the bell at once, and every
 * one of those lists is cached for a while — so without this, the person just
 * erased would still be on the next screen the photographer opened. Listing
 * the keys instead would be a second list of what erasure touches, one that
 * silently goes stale the day a module gains an eraser.
 */
export function useErasePersonalData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) =>
      (await api.post<ErasureReport>('/api/privacy/erasure', { email })).data.items,
    onSuccess: () => qc.invalidateQueries(),
  });
}
