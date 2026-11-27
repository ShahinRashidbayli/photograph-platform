import type { EnClients } from '../en/clients';

/**
 * Clients route.
 *
 * Typed against the English namespace: a missing or misspelled key fails the
 * build here, pointing at this file rather than one giant dictionary.
 */
export const clients: Record<keyof EnClients, string> = {
  // ── Clients page ──────────────────────────────────────────────────────────
  'clients.title': 'Kunden',
  'clients.subtitle':
    'Pflegen Sie Kundenbeziehungen, verfolgen Sie Termine und bauen Sie langfristige Kontakte auf.',
  'clients.errorTitle': 'Kunden konnten nicht geladen werden',
  'clients.errorLoad':
    'Wir konnten Ihre Kunden nicht laden. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut.',
  'clients.loadingDetails': 'Kundendetails werden geladen…',
  'clients.stat.total': 'Kunden gesamt',
  'clients.stat.totalHint': '{amount} insgesamt eingegangen',
  'clients.stat.activeHint': 'Kunden mit anstehenden Terminen',
  'clients.stat.avgSpend': 'Durchschnittlich eingegangen',
  'clients.stat.avgSpendHint': 'Pro Kunde insgesamt',
  'clients.listTitle': 'Alle Kunden',
  'clients.listSubtitle':
    'Sortiert nach letzter Aktivität · Eingegangenes & Buchungen auf einen Blick',
  'clients.search.placeholder': 'Name oder E-Mail suchen…',
  'clients.filter.All': 'Alle',
  'clients.filter.Active': 'Aktiv',
  'clients.filter.Repeat': 'Stammkunden',
  'clients.empty.noneTitle': 'Noch keine Kunden',
  'clients.empty.noneBody':
    'Kunden erscheinen hier automatisch, sobald Sie ihre erste Buchung anlegen.',
  'clients.empty.noMatchTitle': 'Keine passenden Kunden',
  'clients.bookingCount_one': '{count} Buchung',
  'clients.bookingCount_other': '{count} Buchungen',
  'clients.upcomingBadge': '{count} anstehend',

  'clientDetail.noneSelectedTitle': 'Kein Kunde ausgewählt',
  'clientDetail.noneSelectedBody': 'Wählen Sie einen Kunden aus der Liste, um Details zu sehen.',
  'clientDetail.joined': 'Kunde seit {date}',
  'clientDetail.stat.totalSpent': 'Eingegangen',
  'clientDetail.stat.bookings': 'Buchungen',
  'clientDetail.stat.upcoming': 'Anstehend',
  'clientDetail.stat.lastSession': 'Letzter Termin',
  'clientDetail.contactInfo': 'Kontaktdaten',
  'clientDetail.email': 'E-Mail',
  'clientDetail.phone': 'Telefon',
  'clientDetail.joinedLabel': 'Kunde seit',
  'clientDetail.notes': 'Kundennotizen',
  'clientDetail.noNotes': 'Noch keine Notizen zu diesem Kunden.',
  'clientDetail.notesEdit': 'Bearbeiten',
  'clientDetail.notesSave': 'Speichern',
  'clientDetail.notesSaving': 'Wird gespeichert…',
  'clientDetail.notesCancel': 'Abbrechen',
  'clientDetail.notesPlaceholder': 'Private Notiz zu diesem Kunden hinzufügen…',
  'clientDetail.notesError': 'Notiz konnte nicht gespeichert werden. Bitte erneut versuchen.',
  'clientDetail.records.bookings': 'Buchungen',
  'clientDetail.records.galleries': 'Galerien',
  'clientDetail.records.invoices': 'Rechnungen',
  'clientDetail.records.contracts': 'Verträge',
  'clientDetail.records.noBookings': 'Keine Buchungen für diesen Kunden.',
  'clientDetail.records.noGalleries': 'Noch keine Galerien für diesen Kunden.',
  'clientDetail.records.noInvoices': 'Noch keine Rechnungen für diesen Kunden.',
  'clientDetail.records.noContracts': 'Noch keine Verträge für diesen Kunden.',
  'clientDetail.records.loading': 'Buchungen, Galerien, Rechnungen und Verträge werden geladen…',
  'clientDetail.records.error':
    'Buchungen und Dokumente dieses Kunden konnten nicht geladen werden.',
  'clients.backToList': 'Alle Kunden',
};
