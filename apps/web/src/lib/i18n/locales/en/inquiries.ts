/**
 * Inquiries route — the photographer's inbox for authenticated-customer session
 * requests (roadmap §4.5.7).
 *
 * English is the source of truth — these keys define the `Inquiries` half of
 * `TranslationKey`, and every other locale is compile-checked against it.
 */
export const inquiries = {
  // Budget labels (InquiryRequest.budget_range enum)
  'inquiries.budget.UNDER_500': '€200–500',
  'inquiries.budget.500_1000': '€500–1000',
  'inquiries.budget.1000_2000': '€1000–2000',
  'inquiries.budget.OVER_2000': '€2000+',
} as const;

export type EnInquiries = typeof inquiries;
