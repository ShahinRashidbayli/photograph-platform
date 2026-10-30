/**
 * The screens that exist as routes but have no backend yet.
 *
 * <p>Grouped together on purpose: their whole job is to say "not built" in the
 * user's own language rather than showing invented data, so the wording is the
 * feature and it should be reviewed in one place.
 */
export const stubs = {
  'stubs.reports.title': 'Reports',
  'stubs.reports.subtitle':
    'Conversion, seasonality, and package mix analysis for your bookings pipeline.',
  'stubs.reports.body':
    "Lead-to-booking conversion rate, seasonal demand curves, and your top packages by revenue. We'll surface these once you've worked through a few bookings — the data has to exist before the chart does.",
  'stubs.revenue.title': 'Revenue',
  'stubs.revenue.subtitle': 'Track earnings, outstanding deposits, and year-over-year growth.',
  'stubs.revenue.body':
    'Monthly revenue, deposits collected vs outstanding, and year-over-year comparison. Stripe payouts and invoice reconciliation are on the roadmap.',
  'stubs.documents.title': 'Documents',
  'stubs.documents.subtitle': 'Contracts, model releases and consent forms for your sessions.',
  'stubs.documents.notAvailable': 'Not available yet',
  'stubs.documents.body':
    "Contracts and e-signature aren't built yet, so there's nothing to show here. When they land, everything you've signed with your photographer will appear on this page — and nothing will appear before you've actually signed it.",
  'stubs.documents.back': 'Back to bookings',
  'stubs.comingSoon': 'Coming soon',
} as const;

export type EnStubs = typeof stubs;
