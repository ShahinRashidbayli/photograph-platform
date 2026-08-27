/**
 * Revenue and booking reports — Studio's `ANALYTICS` capability.
 *
 * <p>The wording carries one rule the screens depend on: every figure is
 * described as what it is, never as a forecast. "Invoiced" and "collected" are
 * two different facts, and a report that blurred them would tell a photographer
 * they had a good year while the money was still in somebody else's account.
 */
export const analytics = {
  'analytics.year': 'Year',
  'analytics.month': 'Month',
  'analytics.loading': 'Loading your figures…',
  'analytics.loadError': 'Could not load your reports.',
  'analytics.showTable': 'Show the figures as a table',
  'analytics.invoiced': 'Invoiced',
  'analytics.collected': 'Collected',
  // Shown when the plan does not include reports. An upgrade prompt, not an
  // error: the customer has done nothing wrong.
  'analytics.lockedTitle': 'Reports are part of Studio',
  'analytics.lockedBody':
    'Revenue and booking reports read the work you have already done — invoices, payments, bookings and enquiries. They are included in the Studio plan.',
  'analytics.lockedCta': 'See your plan',
  'analytics.emptyTitle': 'Nothing in this year yet',
  'analytics.emptyBody':
    'Once you issue an invoice or book a shoot, the figures for that year appear here. Nothing is estimated — an empty year stays empty.',

  'analytics.revenue.title': 'Revenue',
  'analytics.revenue.subtitle':
    'What you invoiced, and what actually arrived. Cancelled invoices are excluded.',
  'analytics.revenue.summary': 'The year at a glance',
  'analytics.revenue.byMonth': 'Month by month',
  'analytics.revenue.outstanding': 'Still owed',
  'analytics.revenue.averageInvoice': 'Average invoice',
  'analytics.revenue.invoiceCount': 'across {count} invoices',
  'analytics.revenue.ofInvoiced': '{percent} of invoiced',

  'analytics.reports.title': 'Booking reports',
  'analytics.reports.subtitle':
    'When you were busy, what your enquiries turned into, and which packages sell.',
  'analytics.reports.summary': 'The year at a glance',
  'analytics.reports.bookings': 'Bookings',
  'analytics.reports.byMonth': 'Bookings by month',
  'analytics.reports.byStatus': 'Where they ended up',
  'analytics.reports.byPhotographer': 'Who shot what',
  'analytics.reports.unassigned': 'Unassigned',
  'analytics.reports.packages': 'Packages that sell',
  'analytics.reports.leads': 'Enquiries',
  'analytics.reports.converted': 'Became bookings',
  'analytics.reports.conversionRate': '{percent} of enquiries',
} as const;

export type EnAnalytics = typeof analytics;
