/**
 * Which sign-in screen a signed-out visitor belongs on, and how to send them
 * back afterwards.
 *
 * There are two sign-ins, because there are two kinds of account: photographers
 * have passwords, clients do not — they get a single-use link by email. Sending
 * everyone to `/login` therefore handed clients a password field they can never
 * fill in, which looks like an account they have lost rather than the wrong
 * door.
 *
 * Shared by `middleware.ts` (edge runtime) and the axios interceptor, so both
 * halves of "your session ended" agree. Keep it free of browser and Node APIs
 * for that reason.
 */

export const PHOTOGRAPHER_LOGIN = '/login';
export const CLIENT_LOGIN = '/customer/auth/login';

/** Paths that only a client can be on, and so identify them without a session. */
const CLIENT_PREFIXES = ['/customer/'];

/**
 * A studio subdomain as a Customer link or the Customer sign-in carries it.
 * One pattern for both, so a link this module routes to the Customer sign-in
 * is never one that page then refuses to show the studio for.
 */
export const SUBDOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

/**
 * The studio a Customer link names, if it names one.
 *
 * The portal shares `/bookings` and `/documents` with the photographer screens,
 * so the path alone cannot say who was signed out. A `subdomain` param can:
 * links written for a Customer carry it (their sign-in needs it anyway), and no
 * photographer screen reads it. Anything not shaped like a subdomain is
 * ignored rather than echoed into the sign-in URL.
 */
function customerSubdomainIn(search: string): string | null {
  const raw = new URLSearchParams(search).get('subdomain')?.trim().toLowerCase();
  return raw && SUBDOMAIN_PATTERN.test(raw) ? raw : null;
}

/** Sign-in paths, so a redirect can never point back at another sign-in. */
const LOGIN_PREFIXES = [PHOTOGRAPHER_LOGIN, CLIENT_LOGIN];

/**
 * The sign-in screen for this path.
 *
 * Only decided by the URL, because when there is no session there is no role to
 * read. `/customer/**` is unambiguous, and so is any path whose query names a
 * studio (`?subdomain=`, see `customerSubdomainIn`); everything else goes to
 * the photographer sign-in, which carries a "Client sign in" cross-link for the
 * cases the URL cannot settle.
 *
 * @param search the query string including `?`, or empty
 */
export function loginPathFor(pathname: string, search = ''): string {
  return CLIENT_PREFIXES.some((p) => pathname.startsWith(p)) || customerSubdomainIn(search)
    ? CLIENT_LOGIN
    : PHOTOGRAPHER_LOGIN;
}

/** True when this path is itself a sign-in screen. */
export function isLoginPath(pathname: string): boolean {
  return LOGIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Sign-in URL for a blocked destination, carrying that destination in `?next=`
 * so signing in returns the user to the deep link they followed — an emailed
 * booking, a bookmarked lead — instead of dumping them on a dashboard.
 *
 * A destination that is already a sign-in screen (or the root) is dropped
 * rather than preserved: keeping it would either loop or send someone who just
 * authenticated straight back to the form. `safeRedirectPath` validates the
 * value again on the way out, since by then it has been through the URL bar.
 *
 * A Customer link's studio travels as `?subdomain=` too, so the Customer sign-in
 * shows that studio instead of asking for it.
 *
 * @param pathname the path that was refused, e.g. `/bookings`
 * @param search   its query string including `?`, or empty
 */
export function loginUrlFor(pathname: string, search = ''): string {
  const login = loginPathFor(pathname, search);
  if (pathname === '/' || isLoginPath(pathname)) {
    return login;
  }
  const url = `${login}?next=${encodeURIComponent(pathname + search)}`;
  const subdomain = login === CLIENT_LOGIN ? customerSubdomainIn(search) : null;
  return subdomain ? `${url}&subdomain=${subdomain}` : url;
}

/**
 * The other sign-in screen, still carrying wherever the user was headed.
 *
 * The two forms cross-link to each other ("Client sign in" / "Photographer sign
 * in"), and following that link used to drop the `?next=` the middleware had
 * attached — so a client who arrived at the wrong door and corrected themselves
 * lost the booking link that sent them there in the first place.
 *
 * The value is passed through, not trusted: whichever page reads it back runs
 * it past `safeRedirectPath` before navigating anywhere.
 *
 * @param loginPath the sign-in screen being linked to
 * @param search    the current query string, e.g. `window.location.search`
 */
export function withPreservedNext(loginPath: string, search: string): string {
  const next = new URLSearchParams(search).get('next');
  return next ? `${loginPath}?next=${encodeURIComponent(next)}` : loginPath;
}
