export function formatEUR(cents: number | null | undefined): string {
  const v = cents ?? 0;
  return `€${(v / 100).toLocaleString('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function extractApiError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { error?: string } } })
    ?.response?.data?.error;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

export function eurosToCents(value: string): number {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function insertSortedByDate<T extends { eventDate: string }>(
  list: T[],
  item: T,
): T[] {
  return [...list, item].sort((a, b) => a.eventDate.localeCompare(b.eventDate));
}
