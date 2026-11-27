import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

/** Mirrors `EnquiryAcknowledgementSetting` on the API; read and written in the same shape. */
export interface EnquiryAcknowledgementSetting {
  enabled: boolean;
}

export function enquiryAcknowledgementKey() {
  return ['settings', 'enquiry-acknowledgement'] as const;
}

/**
 * Whether a Customer who sends the public request form gets the automatic
 * "Enquiry received" Customer message. On by default on the server.
 */
export function useEnquiryAcknowledgement() {
  return useQuery({
    queryKey: enquiryAcknowledgementKey(),
    queryFn: async () =>
      (await api.get<EnquiryAcknowledgementSetting>('/api/settings/enquiry-acknowledgement')).data,
  });
}

/** Switches it on or off. Owner only on the server; a team member gets a 403. */
export function useSaveEnquiryAcknowledgement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) =>
      (
        await api.put<EnquiryAcknowledgementSetting>('/api/settings/enquiry-acknowledgement', {
          enabled,
        })
      ).data,
    onSuccess: (saved) => qc.setQueryData(enquiryAcknowledgementKey(), saved),
  });
}
