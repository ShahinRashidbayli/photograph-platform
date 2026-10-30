import type { EnInquiries } from '../en/inquiries';

/**
 * Inquiries route.
 *
 * Typed against the English namespace: a missing or misspelled key fails the
 * build here, pointing at this file rather than one giant dictionary.
 */
export const inquiries: Record<keyof EnInquiries, string> = {
  // Detail
  'inquiries.detail.contact': 'Kontakt',
  'inquiries.detail.event': 'Session-Art',
  'inquiries.detail.budget': 'Budget',
  'inquiries.detail.date': 'Wunschtermin',
  'inquiries.detail.location': 'Ort',
  'inquiries.detail.message': 'Nachricht',
  'inquiries.detail.noMessage': 'Keine Nachricht hinterlassen.',
  'inquiries.detail.received': 'Erhalten am {date}',

  // Actions
  'inquiries.action.accept': 'Annehmen',
  'inquiries.action.reject': 'Ablehnen',
  'inquiries.action.accepting': 'Wird angenommen…',
  'inquiries.action.rejecting': 'Wird abgelehnt…',

  // Status labels
  'inquiries.status.PENDING': 'Offen',
  'inquiries.status.ACCEPTED': 'Angenommen',
  'inquiries.status.REJECTED': 'Abgelehnt',
  'inquiries.status.BOOKING_CREATED': 'Gebucht',

  // Budget labels (InquiryRequest.budget_range enum)
  'inquiries.budget.UNDER_500': '€200–500',
  'inquiries.budget.500_1000': '€500–1000',
  'inquiries.budget.1000_2000': '€1000–2000',
  'inquiries.budget.OVER_2000': '€2000+',
};
