'use client';

import { useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import { retryAfterParts, retryAfterSeconds } from '@/lib/rate-limit';

/**
 * Localised "3 minutes" / "45 Sekunden" for a number of seconds.
 *
 * Only the duration, deliberately: every surface that reports a wait wants its
 * own sentence around it ("try again in …", "you can request another link in
 * …"), and baking the sentence in here would force them all to share one
 * phrasing or bypass the helper.
 */
export function useWaitText(): (_seconds: number) => string {
  const { tPlural } = useTranslation();

  return useCallback(
    (seconds: number) => {
      const { unit, count } = retryAfterParts(Math.max(1, Math.ceil(seconds)));
      return tPlural(unit === 'minute' ? 'auth.retryMinutes' : 'auth.retrySeconds', count);
    },
    [tPlural]
  );
}

/**
 * The same, read straight off a 429 — or null when the API did not say how long.
 *
 * @see rate-limit.ts for where the seconds come from
 */
export function useRetryWait(): (_err: unknown) => string | null {
  const waitText = useWaitText();

  return useCallback(
    (err: unknown) => {
      const seconds = retryAfterSeconds(err);
      return seconds === null ? null : waitText(seconds);
    },
    [waitText]
  );
}
