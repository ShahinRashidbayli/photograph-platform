import { safeRedirectPath } from './safe-redirect';

const ORIGIN = 'https://app.fotolio.de';

describe('safeRedirectPath', () => {
  it('returns null when there is no next param', () => {
    expect(safeRedirectPath('', ORIGIN)).toBeNull();
    expect(safeRedirectPath('?foo=bar', ORIGIN)).toBeNull();
    expect(safeRedirectPath('?next=', ORIGIN)).toBeNull();
  });

  it('accepts a same-origin root-relative path', () => {
    expect(safeRedirectPath('?next=/bookings', ORIGIN)).toBe('/bookings');
  });

  it('preserves the query string and hash of the destination', () => {
    // The middleware writes `pathname + search`, so a deep link into a
    // selected booking must survive the round-trip intact.
    expect(safeRedirectPath('?next=%2Fbookings%3Fid%3Dabc123', ORIGIN)).toBe(
      '/bookings?id=abc123',
    );
    expect(safeRedirectPath('?next=%2Fleads%23panel', ORIGIN)).toBe('/leads#panel');
  });

  it('rejects protocol-relative targets that would leave the origin', () => {
    // Starts with "/" but browsers resolve it to another host — the classic
    // open-redirect payload.
    expect(safeRedirectPath('?next=%2F%2Fevil.com', ORIGIN)).toBeNull();
    expect(safeRedirectPath('?next=%2F%5Cevil.com', ORIGIN)).toBeNull();
  });

  it('rejects absolute URLs, including to look-alike hosts', () => {
    expect(safeRedirectPath('?next=https%3A%2F%2Fevil.com', ORIGIN)).toBeNull();
    expect(safeRedirectPath('?next=https%3A%2F%2Fapp.fotolio.de.evil.com', ORIGIN)).toBeNull();
  });

  it('rejects non-http schemes', () => {
    expect(safeRedirectPath('?next=javascript%3Aalert(1)', ORIGIN)).toBeNull();
    expect(safeRedirectPath('?next=data%3Atext%2Fhtml%2Chi', ORIGIN)).toBeNull();
  });

  it('rejects a bare relative path that is not rooted', () => {
    expect(safeRedirectPath('?next=bookings', ORIGIN)).toBeNull();
  });
});
