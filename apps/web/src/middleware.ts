import { NextRequest, NextResponse } from 'next/server';

// Routes accessible without an access_token cookie. Keep this list narrow:
// every entry here bypasses the auth gate, so anything sensitive must NOT
// match these prefixes.
//   /login, /register   — auth flows
//   /p/...              — public photographer portfolio (SSR)
//   /r/...              — public booking-request form
const PUBLIC_PATHS = ['/login', '/register', '/p/', '/r/', '/customer/'];

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
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
