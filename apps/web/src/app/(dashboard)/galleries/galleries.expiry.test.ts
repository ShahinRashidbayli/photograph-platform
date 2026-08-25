import { daysUntil, expiryKind, galleryGroup } from './galleries.expiry';

/**
 * Boundary tests for the retention countdown. Every one of these decides
 * something the photographer acts on: which tab the gallery shows under, which
 * group it is sorted into, and whether Reactivate is offered while it can still
 * bring the photos back.
 */

const DAY_MS = 1000 * 60 * 60 * 24;
const NOW = Date.parse('2026-08-24T12:00:00Z');
const at = (days: number) => new Date(NOW + days * DAY_MS).toISOString();

beforeAll(() => jest.useFakeTimers({ now: NOW }));
afterAll(() => jest.useRealTimers());

describe('daysUntil', () => {
  it('is null when nothing expires', () => {
    expect(daysUntil(null)).toBeNull();
  });

  it.each([
    ['an hour from now', 1 / 24, 1],
    ['four days out', 4, 4],
    ['fifty-two days out', 52, 52],
  ])('counts %s up', (_label, offset, expected) => {
    expect(daysUntil(at(offset))).toBe(expected);
  });

  /**
   * The regression. `Math.ceil` maps everything in the last 24 hours onto
   * `-0`, and `-0 < 0` is false — so a gallery that expired this morning was
   * classed as still-live, grouped under "Expiring soon", counted as Active
   * and left out of the Expired tab.
   */
  it.each([
    ['half an hour ago', -0.5 / 24],
    ['twelve hours ago', -0.5],
    ['a minute short of a day ago', -(1 - 1 / 1440)],
  ])('reports %s as already past, never -0', (_label, offset) => {
    const days = daysUntil(at(offset));

    expect(days).toBe(-1);
    expect(Object.is(days, -0)).toBe(false);
    expect(days! < 0).toBe(true);
  });

  /** Clamping the last day must not push the older ones out by one. */
  it.each([
    ['nine days ago', -9, -9],
    ['thirty days ago', -30, -30],
  ])('still counts %s exactly', (_label, offset, expected) => {
    expect(daysUntil(at(offset))).toBe(expected);
  });
});

describe('expiryKind', () => {
  it.each([
    [null, 'none'],
    [-1, 'expired'],
    [-30, 'expired'],
    [0, 'warning'],
    [6, 'warning'],
    [7, 'ok'],
    [52, 'ok'],
  ] as const)('classifies %s as %s', (days, expected) => {
    expect(expiryKind(days)).toBe(expected);
  });
});

describe('galleryGroup', () => {
  it.each([
    ['expired within the last day', -0.5, 'expired'],
    ['expired nine days ago', -9, 'expired'],
    ['four days left', 4, 'soon'],
    ['fifty-two days left', 52, 'active'],
  ] as const)('files a gallery %s (%s days) under %s', (_label, offset, expected) => {
    expect(galleryGroup(at(offset))).toBe(expected);
  });

  it('treats a gallery with no expiry as active', () => {
    expect(galleryGroup(null)).toBe('active');
  });
});
