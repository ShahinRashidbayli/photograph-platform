import type { TranslationKey } from '@/lib/i18n';

// The dashboard navigation model — data only, no markup and no React.
//
// It lived inside `(dashboard)/layout.tsx` until the shell outgrew a single
// file: 2 000 lines in which the nav rows, their SVGs, the notification panel
// and the layout's own state were one unit, so every nav change meant editing
// the file every page in the app depends on. Splitting the model out is what
// makes a second navigation mode (docs/adr/003) a data change rather than
// surgery on the shell.
//
// Nav is grouped into sections so the sidebar mirrors the mental model:
// daily-work pages first, content-management after it. Each group renders with
// an uppercase section header for grouping signal without using horizontal
// dividers.
//
// The analytics group is conditional: /revenue and /reports are Studio's
// ANALYTICS capability. It used to be filtered out entirely, on the reasoning
// that a sidebar is a list of places you can go and linking there would land a
// Starter photographer on a screen the API answers with 402. The objection was
// about the destination, not the row — so the row is now shown with a plan
// badge and points at the upgrade section instead of at the locked page. That
// keeps the sidebar honest (nothing links somewhere that refuses you) while
// letting a photographer discover that reports exist at all, which hiding it
// made impossible.

/**
 * Which drawing a row shows.
 *
 * <p>A key rather than the SVG itself. Markup here would make this module a
 * client component and put it back in the bundle it was extracted from; the
 * drawings live in {@code components/layout/NavIcon} and are looked up by this
 * key. Names describe the destination, not the shape, because two rows that
 * happen to draw a similar document are still different rows.
 */
export type NavIconKey =
  | 'overview'
  | 'bookings'
  | 'leads'
  | 'instagram'
  | 'clients'
  | 'contracts'
  | 'portfolio'
  | 'galleries'
  | 'space'
  | 'offerings'
  | 'locations'
  | 'studios'
  | 'learning'
  | 'gear'
  | 'revenue'
  | 'reports'
  | 'payments'
  | 'documents';

/**
 * Which half of the product a group belongs to.
 *
 * <p>{@code workspace} is first person — your bookings, your clients, your
 * portfolio, all of it data this tenant owns. {@code community} is third
 * person — locations, studios and teaching that belong to other photographers
 * and that you only browse.
 *
 * <p>Today both halves render in one sidebar and this field changes nothing.
 * It is here early on purpose: the community half is expected to outgrow a
 * group heading and become a switch at the top of the nav, and when it does,
 * which rows go on which side is already stated here rather than being
 * re-derived from group titles at the moment of the change.
 */
export type NavMode = 'workspace' | 'community';

export type NavLeaf = {
  labelKey: TranslationKey;
  href: string;
  icon: NavIconKey;
  badgeKey?: 'unrepliedLeads';
  /**
   * Plan capability this single row needs. Overrides the group's, for the case
   * a gated page belongs in an ungated group — Contracts sits with the daily
   * work it is part of, rather than in a group of its own invented to carry
   * the gate.
   *
   * <p>A {@code Capability} name as the API serialises it — the plan grants it.
   * What a tenant *declares* about itself ("also rents out space") is a
   * different thing and must not be spelled here; see docs/adr/003 §5.
   */
  capability?: string;
  /**
   * The screen behind this row does not exist yet.
   *
   * <p>The row is still listed, carrying the same amber "Soon" pill the
   * landing page and the plan table use, and it opens a real page — one that
   * says in the conditional what would be here and asks whether this studio
   * wants it. Not a 404, and not a screen of plausible sample data pretending
   * to be the feature. See {@code components/PlannedArea}.
   *
   * <p>No plan badge is shown next to it, even where {@code capability} is
   * set. A tier answers "could I use this?", and pricing something nobody can
   * open yet reads as an upsell for a page that does not exist. The gate and
   * its badge switch themselves on the day the screen lands and this flag
   * comes off.
   */
  soon?: boolean;
};

export type NavGroup = {
  titleKey?: TranslationKey;
  mode: NavMode;
  items: NavLeaf[];
  /**
   * Plan capability this group needs. Groups without one are always shown;
   * the value is a {@code Capability} name as the API serialises it.
   */
  capability?: string;
};

export const PHOTOGRAPHER_NAV: NavGroup[] = [
  {
    // Untitled first group — primary daily-work pages live here.
    mode: 'workspace',
    items: [
      { labelKey: 'nav.overview', href: '/dashboard', icon: 'overview' },
      { labelKey: 'nav.bookings', href: '/bookings', icon: 'bookings' },
      // Leads carries a live count badge of un-replied leads — "you have N
      // enquiries waiting" surfaces from the sidebar without needing to
      // open the page first.
      { labelKey: 'nav.leads', href: '/leads', icon: 'leads', badgeKey: 'unrepliedLeads' },
      // Directly under Leads because that is what it feeds: a DM becomes an
      // enquiry becomes a lead. Instagram is also the only one of the six
      // planned features with no community half — the account is only ever
      // yours — which is why it needs no new structure to land in.
      {
        labelKey: 'nav.instagram',
        href: '/instagram',
        icon: 'instagram',
        capability: 'INSTAGRAM_AUTOMATION',
        soon: true,
      },
      { labelKey: 'nav.clients', href: '/clients', icon: 'clients' },
    ],
  },
  {
    titleKey: 'nav.section.content',
    mode: 'workspace',
    items: [
      { labelKey: 'nav.contracts', href: '/contracts', icon: 'contracts', capability: 'CONTRACTS' },
      { labelKey: 'nav.portfolio', href: '/portfolio', icon: 'portfolio' },
      { labelKey: 'nav.galleries', href: '/galleries', icon: 'galleries' },
      // The owned halves of two community features. They sit on the same
      // shelf as Portfolio for the same reason Portfolio is here: they are
      // things this studio publishes. Searching for someone else's space or
      // coach is the other half, and lives under Community below.
      //
      // Neither carries a capability. Which studios may list a space is a
      // thing the tenant declares about itself rather than a tier it buys
      // (see NavLeaf#capability), and naming a capability the API does not
      // grant would lock the row shut for everyone, permanently.
      { labelKey: 'nav.space', href: '/space', icon: 'space', soon: true },
      { labelKey: 'nav.offerings', href: '/offerings', icon: 'offerings', soon: true },
    ],
  },
  // Everything below this line belongs to someone else.
  //
  // A group heading rather than a second sidebar: cheap, reversible, and
  // already a pattern here. What it buys is that these rows start in their
  // final home — a row that lives among your own data for six months and then
  // moves has taught people something that then gets taken away.
  //
  // The URLs are under /community from the first one for the same reason:
  // retro-fitting a prefix breaks every link anyone saved. If these four rows
  // plus the workspace's own stop being scannable in one list, the heading is
  // what gets promoted to a mode switch — see NavMode.
  //
  // Nothing behind these is built. Each row opens a page describing what would
  // be, which is also where the studio says whether it wants it — the tally
  // that decides which of these gets built first. That used to be one list at
  // /roadmap; the list is still there, but it is no longer a row of its own,
  // because eleven built rows and six unbuilt ones in the same sidebar made
  // "what is next" read like a twelfth place to work rather than a question.
  {
    // No heading. It had one while these rows sat inside the workspace list
    // and needed to say where the neighbourhood changed; the switch above the
    // list says that now, and a "COMMUNITY" header directly under a selected
    // "Community" tab is the same word twice.
    mode: 'community',
    items: [
      { labelKey: 'nav.locations', href: '/community/locations', icon: 'locations', soon: true },
      { labelKey: 'nav.studios', href: '/community/studios', icon: 'studios', soon: true },
      // Coaching and workshops arrive as one row. Both answer "who can teach
      // me this?", and splitting them in the nav would make the sidebar carry
      // a distinction the person browsing does not have yet.
      { labelKey: 'nav.learning', href: '/community/learning', icon: 'learning', soon: true },
      { labelKey: 'nav.gear', href: '/community/gear', icon: 'gear', soon: true },
    ],
  },
  // Both pages read real figures now — Invoiced and Collected from issued
  // invoices and succeeded payments, reports from bookings, leads and
  // packages — so they are linked. Shown with a plan badge on a tier without ANALYTICS.
  {
    titleKey: 'nav.section.analytics',
    mode: 'workspace',
    capability: 'ANALYTICS',
    items: [
      { labelKey: 'nav.revenue', href: '/revenue', icon: 'revenue' },
      { labelKey: 'nav.reports', href: '/reports', icon: 'reports' },
    ],
  },
];

// Payments is linked and reads REAL data — it derives every amount from the
// client's own bookings (deposit paid, balance due, totals), so there are no
// invented invoices. Documents is linked again as of the contract module: it
// reads /api/customer/contracts, which returns only contracts actually sent to
// this customer and never a photographer's draft, so the fabricated-sample
// problem that unlinked it no longer exists. A client with no contracts sees an
// empty state rather than an invented one.
//
// No community half. Every one of those features is photographer-to-
// photographer; a client has no reason to browse studios for rent.
export const CLIENT_NAV: NavGroup[] = [
  {
    mode: 'workspace',
    items: [
      { labelKey: 'nav.overview', href: '/bookings', icon: 'bookings' },
      { labelKey: 'nav.payments', href: '/payments', icon: 'payments' },
      { labelKey: 'nav.galleries', href: '/galleries', icon: 'galleries' },
      { labelKey: 'nav.documents', href: '/documents', icon: 'documents' },
    ],
  },
];

/**
 * The modes a navigation actually contains, in display order.
 *
 * <p>Derived rather than listed so a nav with one mode — the client's — gets
 * no switch at all. A control offering one choice is not a choice.
 */
export function modesIn(nav: NavGroup[]): NavMode[] {
  return (['workspace', 'community'] as const).filter((mode) =>
    nav.some((group) => group.mode === mode)
  );
}

/** The groups belonging to one side of the switch. */
export function groupsFor(nav: NavGroup[], mode: NavMode): NavGroup[] {
  return nav.filter((group) => group.mode === mode);
}

/**
 * Which side of the switch a path belongs to, or null when no row claims it.
 *
 * <p>Read from the model rather than from the {@code /community} prefix. The
 * prefix happens to be the rule today, and a rule that lives in two places is
 * one that will disagree with itself the first time a community feature is
 * given a shorter URL.
 *
 * <p>Null matters: {@code /settings} is in no group, and landing there must
 * leave the sidebar on whichever side the photographer last had open rather
 * than silently resetting it.
 */
export function modeForPath(nav: NavGroup[], pathname: string): NavMode | null {
  for (const group of nav) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(item.href + '/')) return group.mode;
    }
  }
  return null;
}
