import { parseApiDate } from '@/lib/date';
import type { TranslationKey } from '@/lib/i18n';
import type { ColorTokens, LeadScore } from './leadTypes';

/**
 * Days from now until the event, or null when the enquiry named no date.
 *
 * `leads.event_date` is nullable — "what does this cost?" is a perfectly
 * ordinary enquiry — but this took a plain `string` and went straight to
 * `.getTime()`, so the first dateless lead in the inbox took the whole page
 * down with a TypeError. Null is a real answer here, not a missing one, and
 * saying so lets the callers show "no date yet" instead of inventing urgency
 * for an event nobody has scheduled.
 */
export function daysUntilEvent(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const event = parseApiDate(iso);
  const time = event.getTime();
  // An unparseable date is the same kind of "we don't know" as a missing one.
  if (Number.isNaN(time)) return null;
  const diff = time - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getScoreVisual(score: LeadScore, c: ColorTokens) {
  if (score === 'HIGH') {
    return { bg: c.successBg, color: c.successText, dot: c.success, border: c.successBorder };
  }
  if (score === 'MED') {
    return { bg: c.warningBg, color: c.warningText, dot: c.warning, border: c.warningBorder };
  }
  return { bg: c.dangerBg, color: c.dangerText, dot: c.danger, border: c.dangerBorder };
}

/**
 * Visual treatment for a lead's lifecycle status badge.
 *
 * <p>BOOKED gets the success palette so a converted lead is unmistakable at a
 * glance. REJECTED gets danger so dead leads recede. REPLIED gets the primary
 * blue — meaningful progress, but still active. NEW is intentionally absent:
 * it's the default state, and badging it would clutter every fresh row in the
 * inbox.
 */
export function statusBadgeVisual(status: string, c: ColorTokens) {
  switch (status) {
    case 'BOOKED':
      return { bg: c.successBg, color: c.successText, border: c.successBorder };
    case 'REJECTED':
      return { bg: c.dangerBg, color: c.dangerText, border: c.dangerBorder };
    case 'REPLIED':
      return { bg: c.primaryBg, color: c.primaryText, border: c.primaryBorder };
    default:
      // Fallback — covers unknown statuses without crashing if the backend
      // ever introduces a new lifecycle value before the FE knows about it.
      return { bg: c.surfaceAlt, color: c.textMuted, border: c.border };
  }
}

/**
 * Urgency chip palette + label key. Returns a key rather than text because this
 * module is hook-free and shared by the list and detail panels — the caller
 * resolves it through `t()` with the day count.
 */
export function getUrgencyVisual(
  daysUntil: number | null,
  c: ColorTokens
): { bg: string; color: string; dot: string; labelKey: TranslationKey } {
  // No date is not "past" — the neutral chip is the same, but the label has to
  // say why, or a dateless enquiry reads as an event that already happened.
  if (daysUntil === null) {
    return {
      bg: c.neutralBg,
      color: c.neutralText,
      dot: c.neutral,
      labelKey: 'leadUrgency.noDate',
    };
  }
  if (daysUntil <= 0) {
    return { bg: c.neutralBg, color: c.neutralText, dot: c.neutral, labelKey: 'leadUrgency.past' };
  }
  if (daysUntil < 30) {
    return { bg: c.dangerBg, color: c.dangerText, dot: c.danger, labelKey: 'leadUrgency.daysAway' };
  }
  if (daysUntil < 60) {
    return {
      bg: c.warningBg,
      color: c.warningText,
      dot: c.warning,
      labelKey: 'leadUrgency.daysAway',
    };
  }
  return {
    bg: c.primaryBg,
    color: c.primaryStrong,
    dot: c.primary,
    labelKey: 'leadUrgency.daysAway',
  };
}
