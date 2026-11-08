import type React from 'react';
import type { TranslationKey } from '@/lib/i18n';
import { getLeadsColors } from './leads.styles';

// Lead lifecycle + scoring vocabulary shared across the leads route. Kept in
// one place so the list, detail panel, filters, and modals all agree on the
// exact string unions the backend emits.
export type LeadScore = 'HIGH' | 'MED' | 'LOW';

// The design-token bundle every leads component receives as its `c` prop, and
// the inline-style map derived from leads.styles. Defined here so components,
// modals, and helpers share one definition instead of redeclaring it.
export type ColorTokens = ReturnType<typeof getLeadsColors>;
export type Styles = Record<string, React.CSSProperties>;

// Display vocabulary lives in the i18n dictionaries; these maps say which key
// each backend enum value resolves to, so every leads surface renders the
// active language from one definition.
export const EVENT_LABEL_KEYS: Record<string, TranslationKey> = {
  WEDDING: 'leadEvent.WEDDING',
  ENGAGEMENT: 'leadEvent.ENGAGEMENT',
  PORTRAIT: 'leadEvent.PORTRAIT',
  FAMILY: 'leadEvent.FAMILY',
  NEWBORN: 'leadEvent.NEWBORN',
  CORPORATE: 'leadEvent.CORPORATE',
};

export const BUDGET_LABEL_KEYS: Record<string, TranslationKey> = {
  UNDER_200: 'leadBudget.UNDER_200',
  '200_500': 'leadBudget.200_500',
  '500_1000': 'leadBudget.500_1000',
  OVER_1000: 'leadBudget.OVER_1000',
};

export const SCORE_LABEL_KEY: Record<LeadScore, TranslationKey> = {
  HIGH: 'leadScoreLabel.HIGH',
  MED: 'leadScoreLabel.MED',
  LOW: 'leadScoreLabel.LOW',
};

/**
 * Resolve a mapped label key, falling back to the raw backend value when the
 * map has no entry — mirrors the previous `LABELS[x] ?? x` behaviour, so a new
 * enum value from the server renders as itself instead of a blank cell.
 */
export function translateOr(
  t: (_key: TranslationKey) => string,
  key: TranslationKey | undefined,
  fallback: string
): string {
  return key ? t(key) : fallback;
}
