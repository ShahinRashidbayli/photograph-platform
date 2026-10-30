/**
 * Inquiries route — the photographer's inbox for authenticated-customer session
 * requests (roadmap §4.5.7).
 *
 * English is the source of truth — these keys define the `Inquiries` half of
 * `TranslationKey`, and every other locale is compile-checked against it.
 */
export const inquiries = {
  // Detail
  'inquiries.detail.contact': 'Contact',
  'inquiries.detail.event': 'Session type',
  'inquiries.detail.budget': 'Budget',
  'inquiries.detail.date': 'Preferred date',
  'inquiries.detail.location': 'Location',
  'inquiries.detail.message': 'Message',
  'inquiries.detail.noMessage': 'No message left.',
  'inquiries.detail.received': 'Received {date}',

  // Actions
  'inquiries.action.accept': 'Accept',
  'inquiries.action.reject': 'Decline',
  'inquiries.action.accepting': 'Accepting…',
  'inquiries.action.rejecting': 'Declining…',

  // Status labels
  'inquiries.status.PENDING': 'Pending',
  'inquiries.status.ACCEPTED': 'Accepted',
  'inquiries.status.REJECTED': 'Declined',
  'inquiries.status.BOOKING_CREATED': 'Booked',

  // Budget labels (InquiryRequest.budget_range enum)
  'inquiries.budget.UNDER_500': '€200–500',
  'inquiries.budget.500_1000': '€500–1000',
  'inquiries.budget.1000_2000': '€1000–2000',
  'inquiries.budget.OVER_2000': '€2000+',
} as const;

export type EnInquiries = typeof inquiries;
