import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

/** Mirrors `InquiryRequestResponse` on the API, as the client reads their own. */
export interface CustomerInquiryRequest {
  id: string;
  eventType: string;
  budgetRange: string;
  proposedDate: string | null;
  location: string | null;
  message: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'BOOKING_CREATED';
  createdAt: string;
}

export function customerInquiryRequestsKey() {
  return ['inquiry-requests', 'customer'] as const;
}

/**
 * The client's own requests. Until the photographer answers, a request exists
 * nowhere else the client can see — it only becomes a booking once accepted.
 */
export function useCustomerInquiryRequests(enabled = true) {
  return useQuery({
    queryKey: customerInquiryRequestsKey(),
    enabled,
    queryFn: async () => {
      const res = await api.get<CustomerInquiryRequest[]>('/api/customer/inquiry-requests');
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

/**
 * A client asking their photographer for a session. The photographer (tenant)
 * is resolved from the client's own session on the backend — no subdomain is
 * sent. Refreshes the client's requests, where it appears as waiting, and their
 * bookings.
 */
export function useCreateInquiryRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InquiryRequestInput) => api.post('/api/customer/inquiry-requests', input),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: customerInquiryRequestsKey() }),
        qc.invalidateQueries({ queryKey: bookingsQueryKey(false) }),
      ]),
  });
}
