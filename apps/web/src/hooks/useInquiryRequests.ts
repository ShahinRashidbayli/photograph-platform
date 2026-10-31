import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { bookingsQueryKey } from '@/hooks/useBookings';

/** What a client asks for a session with — see `CreateInquiryRequest` on the API. */
export interface InquiryRequestInput {
  eventType: string;
  budgetRange: string;
  proposedDate: string;
  location: string | null;
  message: string | null;
  /** Honeypot: left empty by people, filled by bots. */
  website: string;
}

/**
 * A client asking their photographer for a session. The photographer (tenant)
 * is resolved from the client's own session on the backend — no subdomain is
 * sent. Refreshes the client's bookings list, which shows the request.
 */
export function useCreateInquiryRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InquiryRequestInput) => api.post('/api/customer/inquiry-requests', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: bookingsQueryKey(false) }),
  });
}
