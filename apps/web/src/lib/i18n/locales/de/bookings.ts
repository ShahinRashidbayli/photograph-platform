import type { EnBookings } from '../en/bookings';

/**
 * Bookings route, its modals, and the shared booking vocabulary.
 *
 * Typed against the English namespace: a missing or misspelled key fails the
 * build here, pointing at this file rather than one giant dictionary.
 */
export const bookings: Record<keyof EnBookings, string> = {
  // ── Shared domain vocabulary ──────────────────────────────────────────────
  'bookingStatus.ENQUIRY': 'Neu',
  'bookingStatus.DEPOSIT_PAID': 'Anzahlung',
  'bookingStatus.CONFIRMED': 'Bestätigt',
  'bookingStatus.FULLY_PAID': 'Bezahlt',
  'bookingStatus.COMPLETED': 'Abgeschlossen',
  'bookingStatus.CANCELLED': 'Storniert',
  'bookingStatus.UNKNOWN': 'Unbekannt',

  'bookingStatusDetail.DEPOSIT_PAID': 'Anzahlung ausstehend',
  'bookingStatusCustomer.ENQUIRY': 'Angefragt',
  'bookingStatusCustomer.DEPOSIT_PAID': 'Ihre Anzahlung ausstehend',
  'bookingStatusCustomer.CONFIRMED': 'Bestätigt',
  'bookingStatusCustomer.FULLY_PAID': 'Vollständig bezahlt',
  'bookingStatusCustomer.COMPLETED': 'Fotos geliefert',
  'bookingStatusCustomer.CANCELLED': 'Storniert',
  'statusAction.ENQUIRY': 'Anfrage wieder öffnen',
  'statusAction.CONFIRMED': 'Buchung bestätigen',
  'statusAction.DEPOSIT_PAID': 'Anzahlung als bezahlt markieren',
  'statusAction.FULLY_PAID': 'Als vollständig bezahlt markieren',
  'statusAction.COMPLETED': 'Als abgeschlossen markieren',
  'statusAction.CANCELLED': 'Buchung stornieren',

  // ── Bookings page ─────────────────────────────────────────────────────────
  'bookings.title': 'Buchungen',
  'bookings.titleClient': 'Meine Buchungen',
  'bookings.subtitle':
    'Verwalten Sie alle aktiven Buchungen, Zahlungen und Kundendaten an einem Ort.',
  'bookings.clientSessions_one': '{count} aktiver Termin',
  'bookings.clientSessions_other': '{count} aktive Termine',
  'bookings.clientNext_one': 'nächster in {count} Tag',
  'bookings.clientNext_other': 'nächster in {count} Tagen',
  'bookings.loading': 'Buchungen werden geladen…',
  'bookings.loadingCalendar': 'Kalender wird geladen…',
  'bookings.errorTitle': 'Buchungen konnten nicht geladen werden',
  'bookings.errorLoad':
    'Wir konnten Ihre Buchungen nicht laden. Bitte versuchen Sie es erneut.',
  'bookings.errorUpdateStatus': 'Der Buchungsstatus konnte nicht aktualisiert werden.',
  'bookings.tryAgain': 'Erneut versuchen',

  'bookings.filter.all': 'Alle',
  'bookings.filter.deposit': 'Anzahlung',
  'bookings.filter.confirmed': 'Bestätigt',
  'bookings.filter.pending': 'Ausstehend',
  'bookings.filter.completed': 'Abgeschlossen',

  'bookings.view.aria': 'Buchungsansicht',
  'bookings.view.table': 'Tabelle',
  'bookings.view.calendar': 'Kalender',
  'bookings.newBooking': 'Neue Buchung',
  'bookings.requestSession': 'Termin anfragen',

  'bookings.stat.active': 'Aktive Buchungen',
  'bookings.stat.activeTrend': '{confirmed} bestätigt · {progress} in Bearbeitung',
  'bookings.stat.revenue': 'Gebuchter Umsatz',
  'bookings.stat.revenueTrend': '{amount} bisher eingenommen',
  'bookings.stat.awaiting': 'Ausstehende Zahlungen',
  'bookings.stat.allBalancesSettled': 'Alle Beträge beglichen',
  'bookings.stat.openBalance_one': '{count} Buchung mit offenem Betrag',
  'bookings.stat.openBalance_other': '{count} Buchungen mit offenem Betrag',
  'bookings.stat.nextSession': 'Nächster Termin',
  'bookings.stat.noneScheduled': 'Nichts geplant',
  'bookings.stat.inDays_one': 'in {count} Tag',
  'bookings.stat.inDays_other': 'in {count} Tagen',
  'bookings.stat.paidSoFar': 'Bisher bezahlt',
  'bookings.stat.ofTotal': 'von {amount} gesamt',
  'bookings.stat.outstanding': 'Offener Betrag',
  'bookings.stat.allSettled': 'Alles beglichen',
  'bookings.stat.dueBefore': 'Fällig vor Ihrem Termin',

  'bookings.search.title': 'Buchungen suchen',
  'bookings.search.placeholder': 'Buchungen suchen…',
  'bookings.search.filterButton': 'Filtern & Suchen',

  'bookings.empty.photographer':
    'Noch keine Buchungen. Erstellen Sie Ihre erste Buchung, um loszulegen.',
  'bookings.empty.client':
    'Sie haben noch keine Buchungen. Fragen Sie einen Termin an, um loszulegen.',
  'bookings.empty.filters': 'Keine Buchungen entsprechen diesen Filtern.',
  'bookings.empty.selectPhotographer':
    'Wählen Sie eine Buchung aus, um Details zu sehen, oder erstellen Sie eine neue.',
  'bookings.empty.selectClient': 'Wählen Sie eine Buchung aus, um Details zu sehen.',

  'bookings.sessionFallback': 'Termin',
  'bookings.awaitingDeposit': 'Anzahlung ausstehend',
  'bookings.balanceDue': '{amount} offen · fällig {date}',

  'bookings.detail.closed': 'Diese Buchung ist abgeschlossen.',
  'bookings.detail.clientInfo': 'Kundendaten',
  'bookings.detail.name': 'Name',
  'bookings.detail.email': 'E-Mail',
  'bookings.detail.eventType': 'Art des Termins',
  'bookings.detail.location': 'Ort',
  'bookings.detail.payment': 'Zahlung',
  'bookings.detail.total': 'Gesamt',
  'bookings.detail.status': 'Status',
  'bookings.detail.depositPaid': 'Anzahlung bezahlt',
  'bookings.detail.amountPaid': '{amount} bezahlt',
  'bookings.detail.amountRemaining': '{amount} offen',
  'bookings.detail.notes': 'Notizen',
  'bookings.detail.noNotes': 'Noch keine Notizen hinterlegt.',

  'bookings.cancel.title': 'Diese Buchung stornieren?',
  'bookings.cancel.message':
    'Damit wird die Buchung von {name} storniert. Das kann nicht rückgängig gemacht werden.',
  'bookings.cancel.messageFallback': 'Das kann nicht rückgängig gemacht werden.',
  'bookings.cancel.confirm': 'Buchung stornieren',
  'bookings.cancel.keep': 'Buchung behalten',

  // ── Client booking detail ─────────────────────────────────────────────────
  'customerBooking.nextPayment': 'Nächste Zahlung',
  'customerBooking.dueOn': 'Fällig {date}.',
  'customerBooking.dueOnDays_one': 'Fällig {date} — {count} Tag vor Ihrem Termin.',
  'customerBooking.dueOnDays_other': 'Fällig {date} — {count} Tage vor Ihrem Termin.',
  'customerBooking.payNow': 'Jetzt bezahlen',
  'customerBooking.paymentsSoon': 'Online-Zahlungen kommen bald',
  'customerBooking.paidInFull': 'Vollständig bezahlt — vielen Dank! {amount}',
  'customerBooking.progress': 'Fortschritt',
  'customerBooking.step.requestSent': 'Anfrage gesendet',
  'customerBooking.step.deposit': 'Anzahlung',
  'customerBooking.step.depositReceived': 'Anzahlung erhalten · {amount}',
  'customerBooking.step.confirmed': 'Bestätigt',
  'customerBooking.step.pending': 'Ausstehend',
  'customerBooking.step.remaining': 'Restzahlung',
  'customerBooking.step.by': 'Bis {date}',
  'customerBooking.step.paid': 'Bezahlt',
  'customerBooking.step.gallery': 'Galerie-Lieferung',
  'customerBooking.step.delivered': 'Geliefert',
  'customerBooking.step.galleryEta': '~14 Tage nach Ihrem Termin',
  'customerBooking.yourPhotographer': 'Ihr Fotograf',
  'customerBooking.phoneSoon': 'Telefon kommt bald',
  'customerBooking.messagingSoon': 'Nachrichten kommen bald',
  'customerBooking.messageNow': 'Jetzt schreiben',

  // ── Create-booking modal (photographer) ───────────────────────────────────
  'createBooking.aria': 'Neue Buchung erstellen',
  'createBooking.title': 'Neue Buchung',
  'createBooking.subtitle':
    'Die Buchung startet als Anfrage — Sie können sie danach weiterführen.',
  'createBooking.clientName': 'Name des Kunden *',
  'createBooking.clientEmail': 'E-Mail des Kunden *',
  'createBooking.eventDate': 'Datum des Termins *',
  'createBooking.eventTime': 'Uhrzeit',
  'createBooking.eventType': 'Art des Termins',
  'createBooking.eventTypePlaceholder': 'Hochzeit, Portrait…',
  'createBooking.location': 'Ort',
  'createBooking.package': 'Paket',
  'createBooking.noPackage': 'Kein Paket — individueller Preis',
  'createBooking.packageHelp':
    'Ein Paket füllt den Gesamtbetrag unten aus. Überschreiben Sie ihn für einen individuellen Preis.',
  'createBooking.total': 'Gesamtbetrag (€)',
  'createBooking.deposit': 'Anzahlung (€)',
  'createBooking.notes': 'Interne Notizen',
  'createBooking.notesPlaceholder': 'Nur für Sie sichtbar.',
  'createBooking.submit': 'Buchung erstellen',
  'createBooking.submitting': 'Wird erstellt…',
  'createBooking.errName': 'Der Name des Kunden ist erforderlich.',
  'createBooking.errEmail': 'Die E-Mail des Kunden ist erforderlich.',
  'createBooking.errEmailInvalid': 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
  'createBooking.errDate': 'Das Datum des Termins ist erforderlich.',
  'createBooking.errDeposit': 'Die Anzahlung darf den Gesamtbetrag nicht überschreiten.',
  'createBooking.errSubmit':
    'Die Buchung konnte nicht erstellt werden. Bitte versuchen Sie es erneut.',

  // ── Request-session modal (client) ────────────────────────────────────────
  'requestSession.aria': 'Termin anfragen',
  'requestSession.title': 'Termin anfragen',
  'requestSession.subtitle':
    'Sagen Sie Ihrem Fotografen, was Sie vorhaben — er bestätigt Details und Preis.',
  'requestSession.sessionType': 'Art des Termins *',
  'requestSession.choose': 'Auswählen…',
  'requestSession.budget': 'Budgetrahmen *',
  'requestSession.preferredDate': 'Wunschdatum *',
  'requestSession.location': 'Ort',
  'requestSession.locationPlaceholder': 'Berlin, Hamburg…',
  'requestSession.message': 'Nachricht',
  'requestSession.messagePlaceholder':
    'Erzählen Sie Ihrem Fotografen von Anlass, Stil, Gästezahl…',
  'requestSession.submit': 'Anfrage senden',
  'requestSession.submitting': 'Wird gesendet…',
  'requestSession.sentTitle': 'Anfrage gesendet',
  'requestSession.sentBody':
    'Ihr Fotograf prüft sie und bestätigt Ihre Buchung. Sie sehen sie hier, sobald sie bestätigt ist.',
  'requestSession.done': 'Fertig',
  'requestSession.errType': 'Bitte wählen Sie eine Art des Termins.',
  'requestSession.errBudget': 'Bitte wählen Sie einen Budgetrahmen.',
  'requestSession.errDate': 'Bitte wählen Sie ein Wunschdatum.',
  'requestSession.errSubmit':
    'Ihre Anfrage konnte nicht gesendet werden. Bitte versuchen Sie es erneut.',
  'requestSession.type.HOCHZEIT': 'Hochzeit',
  'requestSession.type.PORTRAIT': 'Portrait',
  'requestSession.type.FAMILIE': 'Familie',
  'requestSession.type.EVENT': 'Event',
  'requestSession.type.ANDERES': 'Sonstiges',

  // ── Bookings calendar ─────────────────────────────────────────────────────
  'calendar.aria': 'Buchungskalender',
  'calendar.today': 'Heute',
  'calendar.month': 'Monat',
  'calendar.week': 'Woche',
  'calendar.day': 'Tag',
};
