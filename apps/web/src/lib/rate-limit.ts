/**
 * Reading a 429 the way the API writes one.
 *
 * The backend answers a lockout or rate limit with `code: TOO_MANY_REQUESTS`
 * and, when it knows the wait, both a `Retry-After` header and a
 * `details.retryAfterSeconds` field (see `GlobalExceptionHandler`). A UI that
 * ignores the duration leaves the user with "too many requests" and no idea
 * whether to wait a second or an hour — so they retry immediately, fail again,
 * and read it as the product being broken.
 */

interface RateLimitedResponse {
  response?: {
    status?: number;
    headers?: Record<string, unknown>;
    data?: { code?: string; details?: { retryAfterSeconds?: unknown } };
  };
}

/** True when the API refused this call as a rate limit or a lockout. */
export function isRateLimited(err: unknown): boolean {
  const res = (err as RateLimitedResponse)?.response;
  return res?.status === 429 || res?.data?.code === 'TOO_MANY_REQUESTS';
}

/**
 * Seconds the caller must wait, or null when the API did not say.
 *
 * Prefers the structured body field over the header: the header is an HTTP
 * primitive that also permits an absolute date, while the body field is always
 * a count of seconds. The header is still read as a fallback, since the API
 * sets both and an intermediary is likelier to drop a body detail than a
 * standard header.
 */
export function retryAfterSeconds(err: unknown): number | null {
  const res = (err as RateLimitedResponse)?.response;

  const fromBody = toPositiveInt(res?.data?.details?.retryAfterSeconds);
  if (fromBody !== null) return fromBody;

  // Axios lowercases response header names, but a mock or a non-axios caller
  // may not, so accept either.
  const headers = res?.headers;
  const raw = headers?.['retry-after'] ?? headers?.['Retry-After'];
  return toPositiveInt(raw);
}

function toPositiveInt(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.ceil(n);
}

/**
 * The wait as a `{ unit, count }` pair for the caller to translate.
 *
 * Rounding is deliberately upward at both scales: a wait reported as shorter
 * than it is buys the user a second refusal, which is exactly the experience
 * this whole path exists to remove. Anything under a minute is reported in
 * seconds so a short cooldown doesn't read as "1 minute".
 */
export function retryAfterParts(seconds: number): { unit: 'second' | 'minute'; count: number } {
  if (seconds < 60) {
    return { unit: 'second', count: seconds };
  }
  return { unit: 'minute', count: Math.ceil(seconds / 60) };
}
