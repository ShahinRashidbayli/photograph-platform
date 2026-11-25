import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LandingPage from './LandingPage';
import { PLAN_TIERS } from '@/lib/plans';
import { useLangStore } from '@/store/langStore';

/**
 * What the landing page claims and how its controls behave, pinned.
 *
 * <p>Not a rendering test — layout lives in the stylesheet and changes freely.
 * These cover the ways this page has gone wrong, all of which type-check, lint
 * and build cleanly:
 *
 * <ol>
 *   <li><b>Stale or missing roadmap badges.</b> docs/PRICING.md §"What the
 *       landing page sells vs. what is built" is the source of truth; a shipped
 *       row must not carry "Soon", and an unbuilt one must.
 *   <li><b>Promising what does not exist.</b> The previous page told visitors
 *       their clients could "favourite" pictures. Nothing in the product does
 *       that. The gallery preview is drawn without a heart for that reason.
 *   <li><b>Currency written by hand.</b> "€1.240" under English copy reads as
 *       one euro twenty-four.
 * </ol>
 */

// jsdom has no matchMedia; components on the page may ask it about the viewport.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});

const asLocale = (lang: 'en' | 'de') => act(() => useLangStore.setState({ lang }));
afterEach(() => {
  asLocale('de');
});

const SOON = /^(soon|coming soon|bald|demnächst)$/i;

/** The pricing row carrying `label` — the badge is a sibling of the text. */
const rowOf = (label: string) => screen.getByText(label).closest('li') as HTMLElement;

describe('pricing advertises only what is built', () => {
  beforeEach(() => {
    asLocale('en');
    render(<LandingPage />);
  });

  it('carries no badge on shipped rows', () => {
    for (const label of [
      'Card & SEPA payments (2%)',
      'No transaction fee',
      'Contracts with e-signature',
      'Galleries online 60 days',
      'Galleries online 1 year',
      'Galleries online 2 years',
      'Up to 3 photographers',
      'Revenue & booking reports',
      'Your logo on client pages',
    ]) {
      expect(within(rowOf(label)).queryByText(SOON)).toBeNull();
    }
  });

  // Instagram DM automation needs Meta App Review before it can work at all.
  it('still badges what has not shipped', () => {
    expect(within(rowOf('Auto-reply to Instagram DMs')).queryByText(SOON)).not.toBeNull();
  });

  it('carries the picked plan to registration', () => {
    const hrefs = PLAN_TIERS.map((plan) =>
      screen.getByRole('link', { name: `Choose ${plan.tier}` }).getAttribute('href')
    );
    expect(hrefs).toEqual([
      '/register?plan=starter',
      '/register?plan=pro',
      '/register?plan=studio',
    ]);
  });
});

describe('nothing unbuilt is promised', () => {
  it.each(['en', 'de'] as const)('never mentions client favourites (%s)', (lang) => {
    asLocale(lang);
    const { container } = render(<LandingPage />);
    expect(container.textContent).not.toMatch(/favou?rit|favorisier/i);
  });

  // Claims nobody can back yet: a popularity ranking with no customers, an
  // origin while the operator's address and hosting are placeholders, and a
  // blanket "legally binding" for a simple electronic signature.
  it.each(['en', 'de'] as const)('makes no unbacked claims (%s)', (lang) => {
    asLocale(lang);
    const { container } = render(<LandingPage />);
    expect(container.textContent).not.toMatch(
      /most popular|am beliebtesten|made in germany|legally binding|rechtsverbindlich/i
    );
  });
});

describe('the page carries no photo credits', () => {
  // The stand-in photographs are credited in the Impressum (Bildnachweise),
  // which every page links to — not as a line of names and URLs on the page.
  it('names no photographer or licence', () => {
    asLocale('de');
    const { container } = render(<LandingPage />);
    expect(container.textContent).not.toMatch(/CC BY|Unsplash License|Ximonic/);
  });
});

describe('the sample booking tells one story', () => {
  it('counts the same delivered photos in the hero, the gallery and the workflow', () => {
    asLocale('en');
    const { container } = render(<LandingPage />);
    const counts = [...(container.textContent ?? '').matchAll(/([\d,]+) photos/g)].map((m) => m[1]);
    expect(counts.length).toBeGreaterThanOrEqual(3);
    expect(new Set(counts).size).toBe(1);
    expect(container.textContent).not.toMatch(/\bnext\b/);
  });

  it('describes the gallery photographs in the page language', () => {
    asLocale('de');
    render(<LandingPage />);
    expect(screen.getByAltText('Die beiden Eheringe in den Händen der Braut')).toBeInTheDocument();
  });
});

describe('FAQ', () => {
  it('answers the trial question without JavaScript-only widgets', () => {
    asLocale('en');
    const { container } = render(<LandingPage />);
    const summary = screen.getByText('Do I need a credit card for the trial?');
    expect(summary.tagName).toBe('SUMMARY');
    expect(container.querySelectorAll('#faq details')).toHaveLength(5);
    expect(screen.getAllByRole('link', { name: 'FAQ' })[0]).toHaveAttribute('href', '#faq');
  });
});

describe('money follows the locale', () => {
  it('writes the symbol before the digits in English', () => {
    asLocale('en');
    const { container } = render(<LandingPage />);
    expect(screen.getAllByText('€')[0].nextSibling).toHaveTextContent('19');
    // "€1.240" in English is €1.24 — the bug hand-typed amounts produced.
    expect(container.textContent).not.toMatch(/€\d+\.\d{3}/);
  });

  it('writes the symbol after the digits in German, with the VAT basis beside it', () => {
    asLocale('de');
    render(<LandingPage />);
    expect(screen.getAllByText('€')[0].previousSibling).toHaveTextContent('19');
    expect(screen.getByText('Alle Preise zzgl. gesetzlicher MwSt.')).toBeInTheDocument();
  });

  it('switches every plan to its yearly price', async () => {
    asLocale('en');
    render(<LandingPage />);
    await userEvent.click(screen.getByRole('radio', { name: /yearly/i }));

    expect(screen.getByRole('radio', { name: /yearly/i })).toHaveAttribute('aria-checked', 'true');
    for (const plan of PLAN_TIERS) {
      expect(screen.getByText(plan.yearly)).toBeInTheDocument();
    }
    expect(screen.getAllByText('Billed yearly')).toHaveLength(PLAN_TIERS.length);
  });

  it('switches the period with the arrow keys and keeps one tab stop', async () => {
    asLocale('en');
    render(<LandingPage />);
    const monthly = screen.getByRole('radio', { name: /monthly/i });
    const yearly = screen.getByRole('radio', { name: /yearly/i });
    expect([monthly.tabIndex, yearly.tabIndex]).toEqual([0, -1]);

    monthly.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(yearly).toHaveFocus();
    expect(yearly).toHaveAttribute('aria-checked', 'true');
    expect([monthly.tabIndex, yearly.tabIndex]).toEqual([-1, 0]);

    await userEvent.keyboard('{ArrowLeft}');
    expect(monthly).toHaveFocus();
    expect(monthly).toHaveAttribute('aria-checked', 'true');
  });
});

describe('product tabs', () => {
  beforeEach(() => {
    asLocale('en');
    render(<LandingPage />);
  });

  it('shows the screen that belongs to the selected feature', async () => {
    const panel = () => screen.getByRole('tabpanel');
    expect(within(panel()).getByText('Sarah M.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: /contracts, signed online/i }));

    expect(screen.getByRole('tab', { name: /contracts, signed online/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(within(panel()).getByText('Wedding coverage')).toBeInTheDocument();
    expect(within(panel()).queryByText('Sarah M.')).toBeNull();
  });

  it('moves between features with the arrow keys and keeps one tab stop', async () => {
    const leads = screen.getByRole('tab', { name: /enquiries, scored/i });
    leads.focus();

    await userEvent.keyboard('{ArrowDown}');
    const contracts = screen.getByRole('tab', { name: /contracts, signed online/i });
    expect(contracts).toHaveFocus();
    expect(contracts).toHaveAttribute('aria-selected', 'true');

    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { name: /invoices to gobd/i })).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}');
    expect(leads).toHaveFocus();

    const inTabOrder = screen.getAllByRole('tab').filter((tab) => tab.tabIndex === 0);
    expect(inTabOrder).toEqual([leads]);
  });
});

describe('the hero', () => {
  // The hero card used to loop (clear, refill, forever) behind a pause
  // button. It now plays once in CSS, so every step is in the markup from the
  // first render and there is nothing to pause.
  it('renders the result card finished, with no loop to pause', () => {
    asLocale('en');
    render(<LandingPage />);
    for (const step of ['Enquiry received', 'Contract signed', 'Deposit', 'Gallery delivered']) {
      expect(screen.getAllByText(step).length).toBeGreaterThan(0);
    }
    expect(screen.queryByRole('button', { name: /animation|pause/i })).toBeNull();
  });

  // It pictured a dashboard with four euro amounts and a revenue chart, which
  // read as accounting software. Money belongs in the payments and invoices
  // previews, where the feature is money.
  it.each(['en', 'de'] as const)('shows no amounts of money (%s)', (lang) => {
    asLocale(lang);
    const { container } = render(<LandingPage />);
    const hero = container.querySelector('.lp-hero-band') as HTMLElement;
    expect(hero.textContent).not.toMatch(/€/);
  });

  it('pictures the client’s booking page in the page language', () => {
    asLocale('de');
    const { container } = render(<LandingPage />);
    const hero = container.querySelector('.lp-hero-band') as HTMLElement;
    expect(within(hero).getByText('Shooting anfragen')).toBeInTheDocument();
    expect(within(hero).getByText('Anfrage senden')).toBeInTheDocument();
  });
});

describe('the nav', () => {
  // The nav and hero are dark in both themes, so a toggle there changed only
  // its own icon. The theme follows the system, or the choice made in the app.
  const TOGGLE = /dark theme|light theme|dunklen Design|hellen Design/i;

  it.each(['en', 'de'] as const)(
    'offers no theme toggle, in the bar or the phone menu (%s)',
    async (lang) => {
      asLocale(lang);
      render(<LandingPage />);
      expect(screen.queryByRole('button', { name: TOGGLE })).toBeNull();
      await userEvent.click(screen.getByRole('button', { name: /menu|menü/i }));
      expect(screen.queryByRole('button', { name: TOGGLE })).toBeNull();
    }
  );
});
