import type { TranslationKey } from '@/lib/i18n';

/**
 * The plan tiers, shared by the marketing page and the in-app Plan panel.
 *
 * <p>It lived inside `LandingPage.tsx` until the Plan panel needed the same
 * numbers. Copying it would have meant a price visible to a signed-in
 * photographer that could quietly disagree with the one that sold them the
 * plan — the worst kind of drift, because both screens look right on their own.
 */
// Mirrors docs/PRICING.md. That document is the spec — this array must not
// drift from it, because whatever is listed here is a promise to a customer.
//
// Two placements are deliberate and load-bearing (PRICING.md §4/§5):
//   - Stripe deposits sit in STARTER, not Pro. Every plan can take money; the
//     Starter photographer pays a commission on it and Pro pays none. Locking
//     payments away from Starter would mean they never see the core value, so
//     they would never upgrade at all.
//   - CRM sits in Starter because a client list is table stakes, not a growth
//     feature.
// The 2% Starter commission is stated in the label rather than buried, because
// it is the thing a photographer will compare against Pro; the footnote adds
// that it sits on top of Stripe's own fee.
//
// Both payment rows lost their "soon" badge on 2026-08-18, when card/SEPA
// shipped on Stripe Connect Express. The three gallery-retention rows lost
// theirs on 2026-08-22, when the expiry job landed (ADR-001) — retention is the
// value metric these plans are priced on, so leaving all three badged as
// unbuilt meant the one axis that separates the tiers read as vapour on every
// card at once.
//
// Studio's seats lost theirs when staff invitations shipped (V25). Until then
// Studio was the weakest card on the page: three of its five rows were badged,
// and the only thing it actually gave you over Pro was one more year of
// retention for another €40 a month.
//
// Labels answer "what do I actually get?" for a first-time visitor — no
// internal jargon ("lead", "portfolio & website"). They stay short because a
// pricing bullet is scanned, not read, and the row lays its check icon out with
// `alignItems: center`, so a wrapped label breaks the alignment. Detail that
// does not fit goes in the footnote.
//
// `id` is the plan the CTA carries to /register?plan=… so the visitor lands on
// a page that confirms the plan they picked. Keep it in sync with the DB's
// CHECK constraint on tenants.plan (STARTER | PRO | STUDIO).
export const PLAN_TIERS: {
  id: 'starter' | 'pro' | 'studio';
  tier: string;
  monthly: string;
  yearly: string;
  highlighted: boolean;
  features: { labelKey: TranslationKey; soon?: boolean; footnote?: boolean }[];
}[] = [
  {
    // Retention — not gigabytes — is the value metric: storage is production ×
    // retention, so the time window already prices the space, and a
    // photographer can reason about "60 days" but not about "30 GB". The GB
    // caps still exist as a fair-use guard, documented in docs/PRICING.md §7.4
    // rather than sold here.
    id: 'starter',
    tier: 'Starter',
    monthly: '19',
    yearly: '16',
    highlighted: false,
    features: [
      { labelKey: 'landing.price.f.portfolioWebsite' },
      { labelKey: 'landing.price.f.leadMgmt' },
      { labelKey: 'landing.price.f.onlineBookings' },
      { labelKey: 'landing.price.f.crm' },
      { labelKey: 'landing.price.f.stripeDeposits', footnote: true },
      { labelKey: 'landing.price.f.retention60' },
    ],
  },
  {
    // Ordered strongest-first: Instagram DM automation is the one thing no
    // competitor has (ROADMAP §4.5); 0% commission is the arithmetic that makes
    // the upgrade pay for itself.
    id: 'pro',
    tier: 'Pro',
    monthly: '39',
    yearly: '32',
    highlighted: true,
    features: [
      { labelKey: 'landing.price.f.everythingStarter' },
      { labelKey: 'landing.price.f.instagramDm', soon: true },
      { labelKey: 'landing.price.f.zeroCommission' },
      { labelKey: 'landing.price.f.contractsEsign' },
      { labelKey: 'landing.price.f.retention1y' },
    ],
  },
  {
    id: 'studio',
    tier: 'Studio',
    monthly: '79',
    yearly: '65',
    highlighted: false,
    features: [
      { labelKey: 'landing.price.f.everythingPro' },
      { labelKey: 'landing.price.f.upTo3' },
      { labelKey: 'landing.price.f.analytics' },
      { labelKey: 'landing.price.f.whiteLabel' },
      { labelKey: 'landing.price.f.retention2y' },
    ],
  },
];
