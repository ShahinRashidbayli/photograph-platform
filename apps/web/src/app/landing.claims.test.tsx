import { act, render, screen, within } from '@testing-library/react';
import LandingPage from './LandingPage';
import { useLangStore } from '@/store/langStore';

/**
 * What the landing page claims, pinned.
 *
 * <p>Not a rendering test — the layout is inline styles and changes freely.
 * These assertions cover the two ways this page has actually gone wrong, both
 * of which type-check, lint and build cleanly:
 *
 * <ol>
 *   <li><b>Stale roadmap badges.</b> A "Soon" badge is only ever removed by
 *       hand, and twice it was not: payments shipped 2026-08-18 and gallery
 *       retention 2026-08-22, and both kept theirs. The page then contradicted
 *       itself — the pricing table sold "Card & SEPA payments (2%)" as included
 *       while the feature card beside it said the same thing was unbuilt.
 *       docs/PRICING.md §"What the landing page sells vs. what is built" is the
 *       source of truth; these tests are its enforcement.
 *   <li><b>Currency written by hand.</b> The amounts were typed into the
 *       dictionaries, which put "€1.240" under both locales — the German
 *       separator in English, where it reads as one euro twenty-four, and the
 *       English symbol placement in German, on the page whose pitch is that it
 *       was built for the German market.
 * </ol>
 */

const asLocale = (lang: 'en' | 'de') => act(() => useLangStore.setState({ lang }));
afterEach(() => asLocale('de'));

/** The badge `ComingSoon` renders at either size, in either locale. */
const SOON = /^(soon|coming soon|bald|demnächst)$/i;

/**
 * The row, card or list item carrying `label` — the badge is a sibling of the
 * text, so an assertion has to look at the element that contains both.
 *
 * <p>Climbing to the nearest `li`/`h3`/`h4` matters: a pricing label is wrapped
 * in its own span (roadmap rows are muted), and stopping there would search
 * inside the label and find no badge on any row, passing every assertion for
 * the wrong reason. The marquee has no such ancestor and needs none — its item
 * span holds the text and the badge together.
 */
function claimFor(label: string | RegExp): HTMLElement {
  const node = screen.getAllByText(label)[0];
  return (node.closest('li, h3, h4') as HTMLElement | null) ?? node;
}

const expectNoBadge = (label: string | RegExp) =>
  expect(within(claimFor(label)).queryByText(SOON)).toBeNull();

const expectBadge = (label: string | RegExp) =>
  expect(within(claimFor(label)).queryByText(SOON)).not.toBeNull();

describe('shipped features are not advertised as unbuilt', () => {
  beforeEach(() => {
    asLocale('en');
    render(<LandingPage />);
  });

  // Shipped 2026-08-18 on Stripe Connect Express. It appears four times on the
  // page and only the pricing row had its badge removed, so the same screen
  // gave two answers.
  it('payments carry no badge, on any of the surfaces that mention them', () => {
    expectNoBadge('Stripe payments'); // capability marquee + feature card
    expectNoBadge('Payment'); // pipeline step
    expectNoBadge('Card & SEPA payments (2%)'); // Starter pricing row
    expectNoBadge('No transaction fee'); // Pro pricing row
  });

  // ADR-001, shipped 2026-08-22. Retention is the value metric the three plans
  // are priced on, so badging all three read as though the only axis separating
  // the tiers was unbuilt.
  it('gallery retention carries no badge on any plan', () => {
    expectNoBadge('Galleries online 60 days');
    expectNoBadge('Galleries online 1 year');
    expectNoBadge('Galleries online 2 years');
  });

  it('GoBD invoices carry no badge', () => {
    expectNoBadge('GoBD invoices');
  });

  // Shipped with V25 (staff_role + staff_invitations). Until then Studio was
  // the weakest card on the page: three of its five rows badged, and the only
  // thing it gave you over Pro was one more year of retention for €40 a month.
  it('Studio seats carry no badge', () => {
    expectNoBadge('Up to 3 photographers');
  });

  // The other direction matters just as much: the badge has to keep working for
  // the things that genuinely are not built, or the honest-roadmap device the
  // page is built around stops meaning anything.
  it('still badges what has not shipped', () => {
    expectBadge('Contracts & e-sign');
    expectBadge('Auto-reply to Instagram DMs');
    expectBadge('Revenue & booking reports');
    expectBadge('Your own domain & branding');
  });
});

describe('money follows the locale', () => {
  it('writes the symbol before the digits in English', () => {
    asLocale('en');
    render(<LandingPage />);
    expect(screen.getByText(/€1,240 expected/)).toBeInTheDocument();
    // The plan price is two spans, so match the card rather than a text node.
    expect(screen.getAllByText('€')[0].nextSibling).toHaveTextContent('19');
  });

  it('writes the symbol after the digits in German', () => {
    asLocale('de');
    render(<LandingPage />);
    expect(screen.getByText(/1\.240 € erwartet/)).toBeInTheDocument();
    expect(screen.getAllByText('€')[0].previousSibling).toHaveTextContent('19');
  });

  it('never ships a hand-written amount in the other locale’s format', () => {
    asLocale('en');
    const { container } = render(<LandingPage />);
    // "€1.240" in English is €1.24 — the bug this replaced.
    expect(container.textContent).not.toMatch(/€\d+\.\d{3}/);
  });
});

describe('prices state their VAT basis', () => {
  it('says so next to the figures, as PAngV requires', () => {
    asLocale('de');
    render(<LandingPage />);
    expect(screen.getByText(/zzgl\. gesetzlicher MwSt\./)).toBeInTheDocument();
  });
});
