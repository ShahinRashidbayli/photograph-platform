// What the revenue and reports screens share for drawing their figures; the
// figures themselves come from hooks/useAnalytics.ts.

/** Month initials for the axis, in the active locale. */
export function monthLabels(lang: string): string[] {
  const fmt = new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { month: 'short' });
  return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2024, i, 1)));
}
