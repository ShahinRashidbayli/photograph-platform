/**
 * Overview page.
 *
 * English is the source of truth — these keys define the `Dashboard` half of
 * `TranslationKey`, and every other locale is compile-checked against it.
 */
export const dashboard = {
  // ── Dashboard overview ────────────────────────────────────────────────────
  'dashboard.welcome': 'Welcome back, {name}',
  'dashboard.planBadge': '{plan} Plan',
  'dashboard.subtitle': "Here's your studio overview",
  'dashboard.clientSubtitle': 'View your upcoming bookings and galleries.',
  'dashboard.viewPortfolio': 'View portfolio',
  'dashboard.createBooking': 'Create booking',
  'dashboard.kpi.bookingsThisMonth': 'Bookings this month',
  'dashboard.kpi.upcomingTotal': '{count} upcoming in total',
  'dashboard.kpi.totalRevenue': 'Total revenue',
  'dashboard.kpi.collected': '{amount} collected so far',
  'dashboard.kpi.activeClients': 'Active clients',
  'dashboard.kpi.openBooking_one': 'with an open booking',
  'dashboard.kpi.openBooking_other': 'with open bookings',
  'dashboard.kpi.newLeads': 'New leads',
  'dashboard.kpi.leadsTotal_one': '{count} lead in total',
  'dashboard.kpi.leadsTotal_other': '{count} leads in total',
  'dashboard.upcomingBookings': 'Upcoming bookings',
  'dashboard.recentLeads': 'Recent leads',
  'dashboard.viewAll': 'View all',
  'dashboard.emptyBookings': 'No upcoming bookings.',
  'dashboard.emptyLeads': 'No recent leads.',
  'dashboard.eventFallback': 'Event',
  'leadScore.HIGH': 'High',
  'leadScore.MED': 'Medium',
  'leadScore.LOW': 'Low',
  'budget.OVER_1000': '€1000+',
  'budget.500_1000': '€500–999',
  'budget.200_500': '€200–499',
  'budget.UNDER_200': 'under €200',
  'budget.unknown': '—',
} as const;

export type EnDashboard = typeof dashboard;
