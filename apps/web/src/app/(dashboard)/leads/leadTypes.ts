import type React from 'react';
import { getLeadsColors } from './leads.styles';

// Lead lifecycle + scoring vocabulary shared across the leads route. Kept in
// one place so the list, detail panel, filters, and modals all agree on the
// exact string unions the backend emits.
export type LeadScore = 'HIGH' | 'MED' | 'LOW';
export type LeadStatus = 'NEW' | 'REPLIED' | 'BOOKED' | 'REJECTED';
export type LeadScoreFilter = 'All' | 'High' | 'Medium' | 'Low';
// Pipeline tabs are the primary axis: "what stage are these leads at?".
// Active = NEW + REPLIED — i.e. anything the photographer still needs to act
// on. Splitting Booked / Rejected out lets the photographer review them
// without those terminal states cluttering the daily inbox.
export type LeadPipelineFilter = 'Active' | 'Booked' | 'Rejected' | 'All';

// The design-token bundle every leads component receives as its `c` prop, and
// the inline-style map derived from leads.styles. Defined here so components,
// modals, and helpers share one definition instead of redeclaring it.
export type ColorTokens = ReturnType<typeof getLeadsColors>;
export type Styles = Record<string, React.CSSProperties>;

export const STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: 'New',
  REPLIED: 'Replied',
  BOOKED: 'Booked',
  REJECTED: 'Rejected',
};

export const EVENT_LABELS: Record<string, string> = {
  WEDDING: 'Wedding',
  ENGAGEMENT: 'Engagement',
  PORTRAIT: 'Portrait',
  FAMILY: 'Family',
  NEWBORN: 'Newborn',
  CORPORATE: 'Corporate',
};

export const BUDGET_LABELS: Record<string, string> = {
  UNDER_200: 'under €200',
  '200_500': '€200–499',
  '500_1000': '€500+',
  OVER_1000: '€1,000+',
};

export const SCORE_LABEL: Record<LeadScore, string> = {
  HIGH: 'High priority',
  MED: 'Medium priority',
  LOW: 'Low priority',
};

export const SCORE_SHORT: Record<LeadScore, string> = {
  HIGH: 'High',
  MED: 'Med',
  LOW: 'Low',
};
