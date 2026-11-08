import type { EnInquiries } from '../en/inquiries';

/**
 * Inquiries route.
 *
 * Typed against the English namespace: a missing or misspelled key fails the
 * build here, pointing at this file rather than one giant dictionary.
 */
export const inquiries: Record<keyof EnInquiries, string> = {
  // Budget labels (InquiryRequest.budget_range enum)
  'inquiries.budget.UNDER_500': '€200–500',
  'inquiries.budget.500_1000': '€500–1000',
  'inquiries.budget.1000_2000': '€1000–2000',
  'inquiries.budget.OVER_2000': '€2000+',
};
