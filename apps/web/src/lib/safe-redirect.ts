/**
 * Validates a caller-supplied post-login redirect target.
 *
 * The middleware attaches the blocked destination as `?next=` so login can
 * return the user to where they were headed. That value arrives from the query
 * string, so it is attacker-controllable: following it blindly would make the
 * login page an open redirect, handing a phishing clone a user who has just
 * authenticated and is primed to trust whatever loads next.
 *
 * Only same-origin, absolute-from-root paths are accepted. Everything else —
 * a full URL, a protocol-relative `//host`, a `javascript:` scheme, a
 * backslash trick some browsers normalise to `//` — resolves to a different
 * origin (or fails to parse) and is rejected in favour of the caller's default.
 *
 * @param search the raw query string, e.g. `window.location.search`
 * @param origin the current origin to compare against
 * @returns a safe path (`/…`) to redirect to, or `null` to use the default
 */
export function safeRedirectPath(search: string, origin: string): string | null {
  const raw = new URLSearchParams(search).get('next');
  if (!raw) return null;

  // Must look like a root-relative path. `//evil.com` is protocol-relative and
  // would leave the origin despite starting with a slash.
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  // `/\evil.com` is normalised to `//evil.com` by several browsers.
  if (raw.startsWith('/\\')) return null;

  try {
    const resolved = new URL(raw, origin);
    if (resolved.origin !== origin) return null;
    return resolved.pathname + resolved.search + resolved.hash;
  } catch {
    return null;
  }
}
