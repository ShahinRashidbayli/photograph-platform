import type { TranslationKey, useTranslation } from '@/lib/i18n';

/**
 * When a gallery goes offline, and how the rail talks about it.
 *
 * <p>Extracted from the page for the same reason `bookings.filters` was: while
 * this lived inside a 1,700-line component it could not be reached from a test,
 * and the boundary conditions are exactly where it went wrong — the rounding
 * below decides which tab a gallery appears under, whether it is counted as
 * active, and whether the photographer is offered the one button that can still
 * bring the photos back.
 */

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Whole days until a date — negative once it has passed — or null when there's
 * no expiry set.
 *
 * <p>`Math.ceil` is the right rounding either side of the boundary (half an
 * hour left is "1 day left"; nine days past is "9 days ago"), but it maps the
 * whole of the last 24 hours onto **`-0`** — and `-0 < 0` is false. A gallery
 * that expired this morning was therefore classed as `warning`: filed under
 * "Expiring soon", counted as Active, left out of the Expired tab, and never
 * offered the Reactivate button that was the whole point of noticing it. Once
 * the deadline is behind us the answer is at least one day past, so clamp it.
 */
export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const remaining = new Date(dateStr).getTime() - Date.now();
  const days = Math.ceil(remaining / DAY_MS);
  return remaining < 0 ? Math.min(days, -1) : days;
}

export type ExpiryKind = 'none' | 'expired' | 'warning' | 'ok';

/**
 * How close a gallery is to going offline.
 *
 * <p>Returns the classification and the raw day count rather than a sentence:
 * the wording is locale-dependent (German needs its own plural forms), and a
 * pure helper outside the component tree has no access to the active language.
 * Callers render it with {@link expiryText}.
 */
export function expiryKind(days: number | null): ExpiryKind {
  if (days === null) return 'none';
  if (days < 0) return 'expired';
  if (days < 7) return 'warning';
  return 'ok';
}

export function expiryText(
  days: number | null,
  t: ReturnType<typeof useTranslation>['t'],
  tPlural: ReturnType<typeof useTranslation>['tPlural']
): string {
  const kind = expiryKind(days);
  if (kind === 'none') return t('galleries.expiry.none');
  if (kind === 'expired') return t('galleries.expiry.expired');
  return tPlural('galleries.expiry.daysLeft', days ?? 0);
}

/**
 * The three buckets the list is grouped into, in the order they are shown.
 * "Expiring soon" is lifted out of Active and put first because it is the only
 * group with a deadline attached: a gallery with four days left needs the
 * photographer's attention today, and sorted in among thirty active galleries
 * it did not get it.
 */
export type GalleryGroup = 'soon' | 'active' | 'expired';

export const GROUP_ORDER: readonly GalleryGroup[] = ['soon', 'active', 'expired'] as const;

export const GROUP_LABEL_KEY: Record<GalleryGroup, TranslationKey> = {
  soon: 'galleries.group.soon',
  active: 'galleries.group.active',
  expired: 'galleries.group.expired',
};

/** Takes the expiry rather than the gallery so the rule stays independent of
 *  the response shape the page happens to hold. */
export function galleryGroup(expiresAt: string | null): GalleryGroup {
  const kind = expiryKind(daysUntil(expiresAt));
  if (kind === 'expired') return 'expired';
  if (kind === 'warning') return 'soon';
  return 'active';
}
