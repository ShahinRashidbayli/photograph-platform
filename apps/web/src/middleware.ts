import { NextRequest, NextResponse } from 'next/server';

// Routes accessible without an access_token cookie. Keep this list narrow:
// every entry here bypasses the auth gate, so anything sensitive must NOT
// match these prefixes.
//   /login, /register, /forgot-password,
//   /reset-password     — auth flows. Password recovery is by definition done
//                         by someone who cannot sign in, so the reset link from
//                         the email must open without a token cookie.
//   /verify-email       — same reasoning: the confirmation link is clicked from
//                         an inbox, very often on a phone or a browser where
//                         the user has never signed in. Gating it sent those
//                         clicks to /login and the address was never confirmed,
//                         which in turn kept every @RequiresVerifiedEmail
//                         endpoint locked. The token in the URL is the
//                         credential, and the BE endpoint it posts to
//                         (/api/auth/verify-email) is permitAll for the same
//                         reason.
//   /p/...              — public photographer portfolio (SSR)
//   /r/...              — public booking-request form
//   /g/...              — client gallery viewer, addressed by access token. The
//                         token is the credential; recipients have no account.
//   /impressum, /datenschutz, /agb        — legal pages (must be reachable
//                                            without login; §5 DDG / DSGVO)
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/p/',
  '/r/',
  '/g/',
  // Only the customer's *sign-in* flow, not the whole customer area. This used
  // to be '/customer/', which opened every page beneath it: the dashboard
  // rendered for a signed-out visitor and then failed every API call behind it,
  // which reads as a broken app rather than as "please sign in". The API was
  // never at risk — it gates these itself — but the gate here exists so nobody
  // sees a shell they have no data for.
  '/customer/auth/',
  '/impressum',
  '/datenschutz',
  '/agb',
];

// Apex host without protocol. In dev defaults to `localhost:3000`; in prod set
// APEX_HOST to e.g. `fotoplatform.de`. Subdomains of this apex (anna.<APEX>)
// rewrite to /p/{subdomain} so each photographer gets a clean public URL
// without each route having to know the apex.
const APEX_HOST = process.env.APEX_HOST ?? 'localhost:3000';

// Hosts that must always be treated as the apex itself, never as a subdomain.
// `www` is the canonical apex alias; preview deploys keep their full host.
const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'admin', 'app']);
const SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

function extractSubdomain(host: string): string | null {
  // Strip port for comparison; the apex env var may or may not include one.
  const hostNoPort = host.replace(/:\d+$/, '');
  const apexNoPort = APEX_HOST.replace(/:\d+$/, '');

  if (hostNoPort === apexNoPort) return null;
  if (!hostNoPort.endsWith('.' + apexNoPort)) return null;

  const candidate = hostNoPort.slice(0, hostNoPort.length - apexNoPort.length - 1);
  if (!candidate) return null;
  if (RESERVED_SUBDOMAINS.has(candidate.toLowerCase())) return null;
  if (!SUBDOMAIN_RE.test(candidate)) return null;
  // Multi-level subdomains (e.g. foo.bar.localhost) are not photographers.
  if (candidate.includes('.')) return null;

  return candidate.toLowerCase();
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get('host') ?? '';
  const subdomain = extractSubdomain(host);

  // 1) Subdomain rewrite. Only rewrite the root path so that other routes on
  //    the subdomain (`/login`, `/register`, etc.) still work without needing
  //    each one to be aware of the subdomain layer. Hash fragments live on
  //    the client, so `#contact` keeps working through the rewrite.
  if (subdomain && pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = `/p/${subdomain}`;
    return NextResponse.rewrite(url);
  }

  // 2) Auth gate (unchanged).
  const token = request.cookies.get('access_token')?.value;
  const origin = request.nextUrl.origin;

  // The apex root is the public marketing landing page — reachable without a
  // token. Matched exactly (not via PUBLIC_PATHS prefixes) so only `/` opens up,
  // never every route beneath it.
  if (pathname === '/') {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!token) {
    const loginUrl = new URL('/login', origin);
    // Preserve the original destination so post-login can return to it.
    if (pathname !== '/' && !pathname.startsWith('/login')) {
      loginUrl.searchParams.set('next', pathname + search);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // The trailing `.*\.[\w]+$` alternative skips any request for a file with an
  // extension (e.g. /brand/auth-visual.jpg, *.svg) so static assets in /public
  // aren't caught by the auth gate and redirected to /login.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)'],
};
