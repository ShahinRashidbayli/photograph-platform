import type { EnAnalytics } from '../en/analytics';

/** Umsatz- und Buchungsberichte — siehe englische Datei für die Regel dahinter. */
export const analytics: Record<keyof EnAnalytics, string> = {
  'analytics.year': 'Jahr',
  'analytics.month': 'Monat',
  'analytics.loading': 'Zahlen werden geladen…',
  'analytics.loadError': 'Ihre Berichte konnten nicht geladen werden.',
  'analytics.showTable': 'Zahlen als Tabelle anzeigen',
  'analytics.invoiced': 'In Rechnung gestellt',
  'analytics.collected': 'Eingegangen',
  'analytics.lockedTitle': 'Berichte gehören zu Studio',
  'analytics.lockedBody':
    'Umsatz- und Buchungsberichte werten aus, was Sie bereits getan haben — Rechnungen, Zahlungen, Buchungen und Anfragen. Sie sind im Studio-Tarif enthalten.',
  'analytics.lockedCta': 'Tarif ansehen',
  'analytics.emptyTitle': 'In diesem Jahr noch nichts',
  'analytics.emptyBody':
    'Sobald Sie eine Rechnung stellen oder ein Shooting buchen, erscheinen die Zahlen dieses Jahres hier. Nichts wird geschätzt — ein leeres Jahr bleibt leer.',

  'analytics.revenue.title': 'Umsatz',
  'analytics.revenue.subtitle':
    'Was Sie in Rechnung gestellt haben und was tatsächlich eingegangen ist. Stornierte Rechnungen bleiben außen vor.',
  'analytics.revenue.summary': 'Das Jahr auf einen Blick',
  'analytics.revenue.byMonth': 'Monat für Monat',
  'analytics.revenue.outstanding': 'Noch offen',
  'analytics.revenue.averageInvoice': 'Durchschnittliche Rechnung',
  'analytics.revenue.invoiceCount': 'aus {count} Rechnungen',
  'analytics.revenue.ofInvoiced': '{percent} des Rechnungsbetrags',

  'analytics.reports.title': 'Buchungsberichte',
  'analytics.reports.subtitle':
    'Wann Sie ausgelastet waren, was aus Ihren Anfragen wurde und welche Pakete sich verkaufen.',
  'analytics.reports.summary': 'Das Jahr auf einen Blick',
  'analytics.reports.bookings': 'Buchungen',
  'analytics.reports.byMonth': 'Buchungen pro Monat',
  'analytics.reports.byStatus': 'Wie sie ausgingen',
  'analytics.reports.byPhotographer': 'Wer hat was fotografiert',
  'analytics.reports.unassigned': 'Nicht zugewiesen',
  'analytics.reports.packages': 'Pakete, die sich verkaufen',
  'analytics.reports.leads': 'Anfragen',
  'analytics.reports.converted': 'Wurden zu Buchungen',
  'analytics.reports.conversionRate': '{percent} der Anfragen',
};
