import type { TranslationKey } from '@/lib/i18n';
import type { Plan } from '@/lib/plan-gate';

/**
 * Settings, split into panels.
 *
 * <h2>Why it stopped being one page</h2>
 * It had grown to eleven sections in a single column — account, packages,
 * invoicing identity, Impressum, payouts, DATEV, subscription, branding,
 * resources, team, delete account — across ~3,400 lines. Nobody scrolls that;
 * they scan it once, fail to find the thing, and use search. Two symptoms gave
 * it away before anyone measured it: every upgrade prompt in the app had to
 * link to a `#settings-subscription` fragment, and that fragment needed a
 * retrying scroll shim to land at all. A page that needs a shim to point at its
 * own contents is telling you it is more than one page.
 *
 * <h2>How the panels are grouped</h2>
 * By whose question each answers, not by which API serves it:
 * <ul>
 *   <li><b>Account</b> — you, the person. Name, login, and leaving.</li>
 *   <li><b>Studio</b> — what clients see and what you sell.</li>
 *   <li><b>Business</b> — who you are on paper. Deliberately holds the
 *       invoicing identity and the Impressum <em>together</em>: they ask for
 *       the same name and address and were two screens apart, which is how
 *       they end up disagreeing.</li>
 *   <li><b>Payments</b> — money coming in, and handing it to a bookkeeper.</li>
 *   <li><b>Plan</b> — money going out, to us. Now a real route, so upgrade
 *       prompts link to a page instead of a fragment.</li>
 *   <li><b>Team</b> — other people in the studio.</li>
 * </ul>
 *
 * <p>A client sees only Account, so the tab strip is hidden for them entirely
 * rather than rendered with one lonely tab.
 *
 * <h2>Plan-gated tabs</h2>
 * Team is Studio-only — Starter and Pro have one seat, so the panel is an
 * upgrade prompt and nothing else. It carries a tier badge for the same reason
 * the sidebar's Revenue and Reports rows do: hiding it means a photographer on
 * Starter cannot find out the capability exists, and showing it unmarked means
 * they find out by opening it. The badge is the only version that answers the
 * question before the click.
 *
 * <p>Studio and Business are deliberately <em>not</em> gated even though each
 * holds something that is. Branding needs WHITE_LABEL_BRANDING, but packages
 * and resources on the same panel are table stakes every plan gets — gating the
 * tab would take working features away to hide one locked card, which
 * DEVELOPMENT_PLAN's rule 3 forbids. That card carries its own prompt.
 */
export interface SettingsTab {
  href: string;
  labelKey: TranslationKey;
  /** Photographer-only panels; the API refuses them to CUSTOMER tokens too. */
  photographerOnly: boolean;
  /**
   * Set when the whole panel needs a tier the plan may not have. Only for
   * panels that are *entirely* gated — a panel with one locked card among
   * working ones is not this.
   */
  requiresPlan?: Plan;
}

export const SETTINGS_TABS: readonly SettingsTab[] = [
  { href: '/settings', labelKey: 'settings.tab.account', photographerOnly: false },
  { href: '/settings/studio', labelKey: 'settings.tab.studio', photographerOnly: true },
  { href: '/settings/business', labelKey: 'settings.tab.business', photographerOnly: true },
  { href: '/settings/payments', labelKey: 'settings.tab.payments', photographerOnly: true },
  { href: '/settings/plan', labelKey: 'settings.tab.plan', photographerOnly: true },
  {
    href: '/settings/team',
    labelKey: 'settings.tab.team',
    photographerOnly: true,
    requiresPlan: 'STUDIO',
  },
  // Not plan-gated: answering an erasure request is a legal duty on every
  // plan, and a lapsed account must still be able to meet it.
  { href: '/settings/privacy', labelKey: 'settings.tab.privacy', photographerOnly: true },
] as const;
