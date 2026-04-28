import { NextRequest, NextResponse } from 'next/server';

// Routes accessible without an access_token cookie. Keep this list narrow:
// every entry here bypasses the auth gate, so anything sensitive must NOT
// match these prefixes.
//   /login, /register   — auth flows
//   /p/...              — public photographer portfolio (SSR)
//   /r/...              — public booking-request form
const PUBLIC_PATHS = ['/login', '/register', '/p/', '/r/'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('access_token')?.value;

  const origin = request.nextUrl.origin;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL('/login', origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
