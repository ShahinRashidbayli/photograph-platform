import { isRateLimited, retryAfterParts, retryAfterSeconds } from './rate-limit';

const err = (
  status: number,
  data?: unknown,
  headers?: Record<string, unknown>
): { response: { status: number; data: unknown; headers?: Record<string, unknown> } } => ({
  response: { status, data, headers },
});

describe('isRateLimited', () => {
  it('recognises a 429', () => {
    expect(isRateLimited(err(429))).toBe(true);
  });

  it('recognises the code even when the status is not 429', () => {
    expect(isRateLimited(err(400, { code: 'TOO_MANY_REQUESTS' }))).toBe(true);
  });

  it('is false for other failures', () => {
    expect(isRateLimited(err(401, { code: 'UNAUTHORIZED' }))).toBe(false);
    expect(isRateLimited(new Error('network'))).toBe(false);
    expect(isRateLimited(undefined)).toBe(false);
  });
});

describe('retryAfterSeconds', () => {
  it('reads the structured body detail', () => {
    expect(retryAfterSeconds(err(429, { details: { retryAfterSeconds: 900 } }))).toBe(900);
  });

  it('falls back to the Retry-After header', () => {
    expect(retryAfterSeconds(err(429, {}, { 'retry-after': '120' }))).toBe(120);
  });

  it('accepts a capitalised header name', () => {
    expect(retryAfterSeconds(err(429, {}, { 'Retry-After': '30' }))).toBe(30);
  });

  it('prefers the body over the header when both are present', () => {
    expect(
      retryAfterSeconds(err(429, { details: { retryAfterSeconds: 60 } }, { 'retry-after': '900' }))
    ).toBe(60);
  });

  it('rounds a fractional value up rather than down', () => {
    expect(retryAfterSeconds(err(429, { details: { retryAfterSeconds: 90.2 } }))).toBe(91);
  });

  it('returns null when the API did not say', () => {
    expect(retryAfterSeconds(err(429, {}))).toBeNull();
    expect(retryAfterSeconds(err(429, { details: {} }))).toBeNull();
  });

  it('rejects values that cannot be waited out', () => {
    // A zero or negative wait would render as "try again in 0 minutes", which
    // is worse than saying nothing.
    expect(retryAfterSeconds(err(429, { details: { retryAfterSeconds: 0 } }))).toBeNull();
    expect(retryAfterSeconds(err(429, { details: { retryAfterSeconds: -5 } }))).toBeNull();
    expect(retryAfterSeconds(err(429, { details: { retryAfterSeconds: 'soon' } }))).toBeNull();
  });
});

describe('retryAfterParts', () => {
  it('reports a sub-minute wait in seconds', () => {
    expect(retryAfterParts(45)).toEqual({ unit: 'second', count: 45 });
    expect(retryAfterParts(59)).toEqual({ unit: 'second', count: 59 });
  });

  it('switches to minutes at a minute', () => {
    expect(retryAfterParts(60)).toEqual({ unit: 'minute', count: 1 });
    expect(retryAfterParts(900)).toEqual({ unit: 'minute', count: 15 });
  });

  it('rounds partial minutes up so the retry is not refused again', () => {
    expect(retryAfterParts(61)).toEqual({ unit: 'minute', count: 2 });
    expect(retryAfterParts(841)).toEqual({ unit: 'minute', count: 15 });
  });
});
