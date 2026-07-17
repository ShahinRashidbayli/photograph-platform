import type { TranslationKey } from '@/lib/i18n';
import type { LeadPipelineFilter, LeadScore } from './leadTypes';

/**
 * An authenticated-customer session request (the `inquiry_requests` table).
 * Surfaced alongside anonymous form leads in the same inbox — see the Leads
 * page — with a source badge distinguishing the two. Kept as its own type
 * rather than coerced into {@link Lead} because the enums, statuses and action
 * set (accept/decline vs convert/reject) genuinely differ.
 */
export interface Inquiry {
  id: string;
  customerName: string | null;
  customerEmail: string | null;
  eventType: string;
  budgetRange: string;
  proposedDate: string | null;
  location: string | null;
  message: string | null;
  score: LeadScore;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'BOOKING_CREATED';
  source: string;
  createdAt: string;
}

export type InquiryStatus = Inquiry['status'];

// Event/budget enums differ from leads (German vocabulary); reuse the shared
// request-session labels and the inquiry budget labels. Fall back to the raw
// value when unmapped so a new server enum still renders as itself.
export const INQUIRY_EVENT_LABEL_KEY: Record<string, TranslationKey> = {
  HOCHZEIT: 'requestSession.type.HOCHZEIT',
  PORTRAIT: 'requestSession.type.PORTRAIT',
  FAMILIE: 'requestSession.type.FAMILIE',
  EVENT: 'requestSession.type.EVENT',
  ANDERES: 'requestSession.type.ANDERES',
};

export const INQUIRY_BUDGET_LABEL_KEY: Record<string, TranslationKey> = {
  UNDER_500: 'inquiries.budget.UNDER_500',
  '500_1000': 'inquiries.budget.500_1000',
  '1000_2000': 'inquiries.budget.1000_2000',
  OVER_2000: 'inquiries.budget.OVER_2000',
};

export const INQUIRY_STATUS_LABEL_KEY: Record<InquiryStatus, TranslationKey> = {
  PENDING: 'inquiries.status.PENDING',
  ACCEPTED: 'inquiries.status.ACCEPTED',
  REJECTED: 'inquiries.status.REJECTED',
  BOOKING_CREATED: 'inquiries.status.BOOKING_CREATED',
};

/**
 * Map an inquiry's status onto the lead pipeline axis so both sources answer
 * the same Active / Booked / Rejected filter coherently.
 */
export function inquiryPipeline(status: InquiryStatus): Exclude<LeadPipelineFilter, 'All'> {
  if (status === 'BOOKING_CREATED') return 'Booked';
  if (status === 'REJECTED') return 'Rejected';
  return 'Active'; // PENDING, ACCEPTED
}

export function inquiryDisplayName(inq: Inquiry): string {
  return (inq.customerName && inq.customerName.trim())
    || (inq.customerEmail && inq.customerEmail.trim())
    || '—';
}
