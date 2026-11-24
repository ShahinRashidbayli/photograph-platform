import type { EnDashboard } from '../en/dashboard';

/**
 * Overview page.
 *
 * Typed against the English namespace: a missing or misspelled key fails the
 * build here, pointing at this file rather than one giant dictionary.
 */
export const dashboard: Record<keyof EnDashboard, string> = {
  // ── Dashboard overview ────────────────────────────────────────────────────
  'dashboard.welcome': 'Willkommen zurück, {name}',
  'dashboard.planBadge': 'Tarif {plan}',
  'dashboard.subtitle': 'Hier ist Ihre Studio-Übersicht',
  'dashboard.clientSubtitle': 'Sehen Sie Ihre anstehenden Buchungen und Galerien.',
  'dashboard.viewPortfolio': 'Portfolio ansehen',
  'dashboard.createBooking': 'Buchung erstellen',
  'dashboard.kpi.bookingsThisMonth': 'Buchungen diesen Monat',
  'dashboard.kpi.upcomingTotal': '{count} anstehend insgesamt',
  'dashboard.kpi.booked': 'Gebucht',
  'dashboard.kpi.bookedHelp': 'Bestätigte, verschobene und abgeschlossene Shootings in {year}',
  'dashboard.kpi.invoiced': 'In Rechnung gestellt',
  'dashboard.kpi.invoicedHelp': '{year} ausgestellte Rechnungen, abzüglich Storno',
  'dashboard.kpi.collected': 'Eingegangen',
  'dashboard.kpi.collectedHelp': '{year} eingegangene Zahlungen',
  'dashboard.kpi.activeClients': 'Aktive Kunden',
  'dashboard.kpi.openBooking_one': 'mit einer offenen Buchung',
  'dashboard.kpi.openBooking_other': 'mit offenen Buchungen',
  'dashboard.kpi.newLeads': 'Neue Leads',
  'dashboard.kpi.leadsTotal_one': '{count} Lead insgesamt',
  'dashboard.kpi.leadsTotal_other': '{count} Leads insgesamt',
  'dashboard.upcomingBookings': 'Anstehende Buchungen',
  'dashboard.recentLeads': 'Neueste Leads',
  'dashboard.viewAll': 'Alle ansehen',
  'dashboard.emptyBookings': 'Keine anstehenden Buchungen.',
  'dashboard.emptyLeads': 'Keine neuen Leads.',
  'dashboard.eventFallback': 'Termin',
  'leadScore.HIGH': 'Hoch',
  'leadScore.MED': 'Mittel',
  'leadScore.LOW': 'Niedrig',
  'budget.OVER_1000': '€1000+',
  'budget.500_1000': '€500–999',
  'budget.200_500': '€200–499',
  'budget.UNDER_200': 'unter €200',
  'budget.unknown': '—',
};
