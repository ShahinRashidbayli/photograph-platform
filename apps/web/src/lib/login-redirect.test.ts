import {
  CLIENT_LOGIN,
  PHOTOGRAPHER_LOGIN,
  isLoginPath,
  loginPathFor,
  loginUrlFor,
  nextAfterSignIn,
  withPreservedNext,
} from './login-redirect';
import { safeRedirectPath } from './safe-redirect';

describe('loginPathFor', () => {
  /**
   * Clients have no password. Sending them to the photographer form gave them
   * a field they cannot fill in, which reads as a lost account rather than the
   * wrong door.
   */
  it('sends a client to the passwordless sign-in', () => {
    expect(loginPathFor('/customer/bookings')).toBe(CLIENT_LOGIN);
    expect(loginPathFor('/customer/')).toBe(CLIENT_LOGIN);
  });

  it('sends everyone else to the photographer sign-in', () => {
    expect(loginPathFor('/dashboard')).toBe(PHOTOGRAPHER_LOGIN);
    expect(loginPathFor('/bookings')).toBe(PHOTOGRAPHER_LOGIN);
    expect(loginPathFor('/')).toBe(PHOTOGRAPHER_LOGIN);
  });

  /**
   * The portal shares `/bookings` and `/documents` with the photographer, so
   * the path cannot tell them apart. A link written for a Customer names the
   * studio, and that is what marks it.
   */
  it('sends a link that names a studio to the Customer sign-in', () => {
    expect(loginPathFor('/documents', '?id=x&subdomain=studio-lichtblick')).toBe(CLIENT_LOGIN);
    expect(loginPathFor('/documents', '?id=x')).toBe(PHOTOGRAPHER_LOGIN);
  });

  it('ignores a subdomain param that is not shaped like one', () => {
    expect(loginPathFor('/bookings', '?subdomain=')).toBe(PHOTOGRAPHER_LOGIN);
    expect(loginPathFor('/bookings', '?subdomain=a%2Fb')).toBe(PHOTOGRAPHER_LOGIN);
  });

  /** A path that merely contains the word must not be mistaken for the area. */
  it('matches the path segment, not the substring', () => {
    expect(loginPathFor('/leads/customer-notes')).toBe(PHOTOGRAPHER_LOGIN);
  });
});

describe('isLoginPath', () => {
  it('recognises both sign-in screens', () => {
    expect(isLoginPath('/login')).toBe(true);
    expect(isLoginPath('/customer/auth/login')).toBe(true);
  });

  it('does not treat a path that starts with the same letters as a sign-in', () => {
    expect(isLoginPath('/logins-report')).toBe(false);
    expect(isLoginPath('/dashboard')).toBe(false);
  });
});

describe('loginUrlFor', () => {
  it('carries the blocked destination so signing in returns to it', () => {
    expect(loginUrlFor('/bookings')).toBe('/login?next=%2Fbookings');
  });

  it('keeps the query string of the destination', () => {
    expect(loginUrlFor('/leads', '?status=NEW')).toBe('/login?next=%2Fleads%3Fstatus%3DNEW');
  });

  it('uses the client sign-in for a client destination', () => {
    expect(loginUrlFor('/customer/bookings')).toBe(
      '/customer/auth/login?next=%2Fcustomer%2Fbookings'
    );
  });

  it('carries the destination and the studio to the Customer sign-in', () => {
    expect(loginUrlFor('/documents', '?id=x&subdomain=studio-lichtblick')).toBe(
      '/customer/auth/login?next=%2Fdocuments%3Fid%3Dx%26subdomain%3Dstudio-lichtblick' +
        '&subdomain=studio-lichtblick'
    );
  });

  /** The sign-in page reads both back; the pairing has to hold end to end. */
  it('produces a Customer destination the sign-in will follow', () => {
    const url = loginUrlFor('/documents', '?id=x&subdomain=studio-lichtblick');
    const search = url.slice(url.indexOf('?'));

    expect(new URLSearchParams(search).get('subdomain')).toBe('studio-lichtblick');
    expect(safeRedirectPath(search, 'https://app.fotolio.de')).toBe(
      '/documents?id=x&subdomain=studio-lichtblick'
    );
  });

  /** Preserving a sign-in as the destination would either loop or bounce. */
  it('drops a destination that is itself a sign-in', () => {
    expect(loginUrlFor('/login')).toBe('/login');
    expect(loginUrlFor('/customer/auth/login')).toBe(CLIENT_LOGIN);
  });

  it('drops the root, which is public anyway', () => {
    expect(loginUrlFor('/')).toBe('/login');
  });

  /**
   * The two halves have to fit: whatever this encodes, `safeRedirectPath` —
   * which the login page uses to read it back — has to accept.
   */
  it('produces a destination the login page will actually follow', () => {
    const url = loginUrlFor('/bookings', '?status=NEW');
    const search = url.slice(url.indexOf('?'));

    expect(safeRedirectPath(search, 'https://app.fotolio.de')).toBe('/bookings?status=NEW');
  });

  it('cannot be talked into an off-site destination', () => {
    // The path comes from the request, but assert the pairing holds regardless.
    const url = loginUrlFor('//evil.example', '');
    const search = url.slice(url.indexOf('?'));

    expect(safeRedirectPath(search, 'https://app.fotolio.de')).toBeNull();
  });
});

describe('withPreservedNext', () => {
  /**
   * A client who lands on the photographer form and corrects themselves used to
   * lose the booking link that sent them there.
   */
  it('carries the destination across to the other sign-in', () => {
    expect(withPreservedNext(CLIENT_LOGIN, '?next=%2Fbookings')).toBe(
      '/customer/auth/login?next=%2Fbookings'
    );
  });

  it('links plainly when there is nothing to carry', () => {
    expect(withPreservedNext(PHOTOGRAPHER_LOGIN, '')).toBe('/login');
    expect(withPreservedNext(PHOTOGRAPHER_LOGIN, '?plan=pro')).toBe('/login');
  });

  it('re-encodes rather than pasting the raw value through', () => {
    expect(withPreservedNext(PHOTOGRAPHER_LOGIN, '?next=%2Fleads%3Fstatus%3DNEW')).toBe(
      '/login?next=%2Fleads%3Fstatus%3DNEW'
    );
  });

  /** Passed through, but the receiving page is still the one that validates it. */
  it('leaves an unsafe destination for safeRedirectPath to reject', () => {
    const url = withPreservedNext(PHOTOGRAPHER_LOGIN, '?next=https%3A%2F%2Fevil.example');
    const search = url.slice(url.indexOf('?'));

    expect(safeRedirectPath(search, 'https://app.fotolio.de')).toBeNull();
  });
});

describe('nextAfterSignIn', () => {
  const origin = 'https://app.fotolio.de';

  it('follows a same-origin destination', () => {
    expect(nextAfterSignIn('?next=%2Fdocuments%3Fid%3Dx', origin)).toBe('/documents?id=x');
  });

  /** A hand-written `next` pointing at a sign-in sent the user straight back to a form. */
  it.each([
    ['/login'],
    ['/login?next=%2Fbookings'],
    ['/customer/auth/login'],
    ['/customer/auth/login/'],
  ])('refuses the sign-in %s', (target) => {
    expect(nextAfterSignIn(`?next=${encodeURIComponent(target)}`, origin)).toBeNull();
  });

  it('still refuses what safeRedirectPath refuses', () => {
    expect(nextAfterSignIn(`?next=${encodeURIComponent('//evil.example')}`, origin)).toBeNull();
  });
});
