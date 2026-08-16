/** `YYYY-MM-DD` with nothing after it — the shape the API uses for LocalDate. */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a value from the API into a `Date` in the **local** timezone.
 *
 * `new Date('2026-08-21')` is not the same as `new Date('2026-08-21T00:00')`.
 * Per the ECMAScript spec a bare date-only string is interpreted as **UTC**,
 * while a string with a time component is interpreted as local. So a shoot the
 * backend stores as the 21st becomes `2026-08-21T00:00Z`, and any viewer west
 * of Greenwich renders it as the **20th** — the client gallery, the booking
 * list, the payment schedule, all one day early. It also breaks the
 * `>= startOfToday()` comparisons that decide "upcoming": in New York, today's
 * own shoot sorts as past and drops out of the upcoming list.
 *
 * Splitting the components and feeding them to the `Date(y, m, d)` constructor
 * pins it to local midnight, which is what every caller means by a shoot date.
 * `lib/helpers.todayIso` already avoids the mirror-image of this trap on the
 * way out; this is the way in.
 *
 * Values that carry a time (`createdAt`, `expiresAt` — full timestamps with an
 * offset) are unambiguous already and pass straight through.
 */
export function parseApiDate(value: string | Date): Date {
  if (typeof value !== 'string') return value;
  const match = DATE_ONLY.exec(value.trim());
  if (!match) return new Date(value);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Local midnight today — the boundary for "upcoming" vs "past". */
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
