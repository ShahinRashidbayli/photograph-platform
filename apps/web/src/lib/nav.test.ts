import fs from 'node:fs';
import path from 'node:path';
import { CLIENT_NAV, PHOTOGRAPHER_NAV, type NavGroup } from '@/lib/nav';

const DASHBOARD_ROUTES = path.join(process.cwd(), 'src/app/(dashboard)');
const pageFor = (href: string) => path.join(DASHBOARD_ROUTES, href, 'page.tsx');

const rows = (nav: NavGroup[]) => nav.flatMap((group) => group.items);
const everyRow = [...rows(PHOTOGRAPHER_NAV), ...rows(CLIENT_NAV)];

/**
 * The sidebar is a list of places you can go.
 *
 * <p>Two ways a row breaks that promise, and the file it is declared in cannot
 * tell you about either: the page was never built, or it was renamed and the
 * row now points into nothing. Both render identically — a normal-looking row
 * that 404s on click — which is why this reads the route tree rather than
 * trusting the model.
 */
describe('every sidebar row leads somewhere', () => {
  it.each(everyRow.map((item) => [item.href]))('%s is a real route', (href) => {
    expect({ href, exists: fs.existsSync(pageFor(href)) }).toEqual({ href, exists: true });
  });

  /**
   * A `soon` row's page is allowed to exist precisely because it does not
   * pretend: it describes what would be there. The day someone builds the real
   * screen they have to drop `soon` from the row too, or the sidebar goes on
   * calling a finished feature unbuilt — and nothing else would catch that,
   * because both states compile and both render.
   */
  it('a row marked soon opens a page that says so, not a working screen', () => {
    const lying = everyRow
      .filter((item) => item.soon)
      .filter((item) => !fs.readFileSync(pageFor(item.href), 'utf8').includes('PlannedArea'))
      .map((item) => item.href);
    expect(lying).toEqual([]);
  });

  it('community rows live under /community, so the prefix never has to be retrofitted', () => {
    const community = [...PHOTOGRAPHER_NAV, ...CLIENT_NAV]
      .filter((group) => group.mode === 'community')
      .flatMap((group) => group.items);
    expect(community.length).toBeGreaterThan(0);
    expect(community.filter((item) => !item.href.startsWith('/community/'))).toEqual([]);
  });
});
