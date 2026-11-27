/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

/** A signed-out request: no access or refresh cookie. */
function signedOut(path: string) {
  return middleware(new NextRequest(new URL(path, 'http://localhost:3000')));
}

function redirectedTo(path: string): string | null {
  const location = signedOut(path).headers.get('location');
  if (!location) return null;
  const url = new URL(location);
  return url.pathname + url.search;
}

describe('middleware auth gate', () => {
  it('sends a signed-out photographer to the photographer sign-in', () => {
    expect(redirectedTo('/bookings?status=NEW')).toBe('/login?next=%2Fbookings%3Fstatus%3DNEW');
  });

  /**
   * A Customer following a portal link used to meet the photographer's
   * password form, which they have no password for.
   */
  it('sends a signed-out Customer link to the Customer sign-in, keeping next and the studio', () => {
    const url = new URL(
      redirectedTo('/documents?id=x&subdomain=studio-lichtblick')!,
      'http://localhost:3000'
    );

    expect(url.pathname).toBe('/customer/auth/login');
    expect(url.searchParams.get('next')).toBe('/documents?id=x&subdomain=studio-lichtblick');
    expect(url.searchParams.get('subdomain')).toBe('studio-lichtblick');
  });

  it('sends a signed-out visitor on a /customer page to the Customer sign-in', () => {
    expect(redirectedTo('/customer/bookings')).toBe(
      '/customer/auth/login?next=%2Fcustomer%2Fbookings'
    );
  });

  it('lets the Customer sign-in itself through', () => {
    expect(redirectedTo('/customer/auth/login?next=%2Fdocuments')).toBeNull();
  });
});
