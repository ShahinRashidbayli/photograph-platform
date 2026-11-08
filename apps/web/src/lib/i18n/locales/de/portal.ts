import type { EnPortal } from '../en/portal';

/**
 * Das Kundenportal: die Übersicht, die Seite eines Shootings, Galerien und
 * Zahlungen.
 *
 * Typed against the English namespace: a missing or misspelled key fails the
 * build here, pointing at this file rather than one giant dictionary.
 */
export const portal: Record<keyof EnPortal, string> = {
  // ── Übersicht ─────────────────────────────────────────────────────────────
  'portal.hello': 'Hallo {name}',
  'portal.welcome': 'Willkommen',
  'portal.subtitle': 'Alles zu Ihren Shootings mit {studio} an einem Ort.',
  'portal.subtitleNoStudio': 'Alles zu Ihren Shootings an einem Ort.',
  'portal.request': 'Neues Shooting anfragen',
  'portal.loadError': 'Ihre Shootings konnten gerade nicht geladen werden.',
  'portal.partialError':
    'Einige Angaben konnten nicht geladen werden — die Übersicht ist eventuell unvollständig.',

  // ── Zu erledigen ──────────────────────────────────────────────────────────
  'portal.todo.title': 'Zu erledigen',
  'portal.todo.none': 'Alles erledigt — gerade wartet nichts auf Sie.',
  'portal.todo.sign': 'Vertrag unterschreiben',
  'portal.todo.signAction': 'Lesen & unterschreiben',
  'portal.todo.pay': '{amount} bezahlen',
  'portal.todo.payAction': 'Bezahlen',
  'portal.todo.photos': 'Ihre Fotos sind da',
  'portal.todo.photosAction': 'Galerie öffnen',
  'portal.meta.dueBy': 'fällig bis {date}',
  'portal.meta.photos_one': '{count} Foto',
  'portal.meta.photos_other': '{count} Fotos',
  'portal.meta.until': 'verfügbar bis {date}',

  // ── Shootings ─────────────────────────────────────────────────────────────
  'portal.shoots.title': 'Ihre Shootings',
  'portal.shoots.none':
    'Noch keine Shootings. Fragen Sie eins an — es erscheint hier, sobald es bestätigt ist.',
  'portal.step.aria': 'Fortschritt',
  'portal.step.requested': 'Angefragt',
  'portal.step.confirmed': 'Bestätigt',
  'portal.step.contract': 'Vertrag',
  'portal.step.contractOpen': 'Vertrag offen',
  'portal.step.payment': 'Zahlung',
  'portal.step.paymentProgress': '{paid} von {total}',
  'portal.step.shoot': 'Shooting',
  'portal.step.photos': 'Fotos',
  'portal.status.photosDelivered': 'Fotos geliefert',
  'portal.status.done': 'Abgeschlossen',

  // ── Anfragen ──────────────────────────────────────────────────────────────
  'portal.requests.title': 'Ihre Anfragen',
  'portal.requests.pending': 'Wartet auf Antwort',
  'portal.requests.declined': 'Leider nicht möglich',
  'portal.requests.wish': '{occasion} · Wunschtermin',
  'portal.requests.sent': 'Gesendet am {date}',

  // ── Kontakt ───────────────────────────────────────────────────────────────
  'portal.contact.title': 'Fragen? {name} hilft gern.',
  'portal.contact.titleNoName': 'Fragen zu Ihrem Shooting?',
  'portal.contact.heading': 'Kontakt',
  'portal.contact.email': 'E-Mail schreiben',

  // ── Ein Shooting ──────────────────────────────────────────────────────────
  'portal.detail.back': 'Übersicht',
  'portal.detail.notFound': 'Dieses Shooting gibt es hier nicht (mehr).',
  'portal.detail.cancelled': 'Dieses Shooting wurde abgesagt.',
  'portal.detail.nextSteps': 'Ihre nächsten Schritte',
  'portal.detail.contract': 'Vertrag',
  'portal.detail.contractSent': 'Gesendet am {date}',
  'portal.detail.contractSigned': 'Unterschrieben am {date}',
  'portal.detail.contractNote':
    'Sie unterschreiben elektronisch mit Ihrem Namen. Die PDF finden Sie danach unter Dokumente.',
  'portal.detail.contractView': 'Ansehen',
  'portal.detail.payTitle': 'Bezahlen',
  'portal.detail.paidTitle': 'Bezahlt',
  'portal.detail.dueBy': 'Der offene Betrag ist fällig bis {date}.',
  'portal.detail.invoiceIssued': 'ausgestellt am {date}',
  'portal.detail.photos': 'Ihre Fotos',
  'portal.detail.photosPending':
    'Nach dem Shooting erscheint Ihre Galerie hier, sobald die Fotos fertig sind.',
  'portal.detail.when': 'Termin',
  'portal.detail.date': 'Datum',
  'portal.detail.time': 'Uhrzeit',
  'portal.detail.place': 'Ort',
  'portal.detail.map': 'In Karten öffnen',
  'portal.detail.addToCalendar': 'In Kalender eintragen',

  // ── Galerien ──────────────────────────────────────────────────────────────
  'portal.galleries.title': 'Galerien',
  'portal.galleries.subtitle': 'Ihre Fotos zum Ansehen und Herunterladen.',
  'portal.galleries.empty':
    'Noch keine Galerie. Sobald Ihre Fotos fertig sind, erscheinen sie hier.',
  'portal.galleries.error': 'Ihre Galerien konnten gerade nicht geladen werden.',
  'portal.galleries.daysLeft_one': 'Verfügbar bis {date} — noch {count} Tag',
  'portal.galleries.daysLeft_other': 'Verfügbar bis {date} — noch {count} Tage',
  'portal.galleries.downloadAll': 'Alle herunterladen',
  'portal.galleries.upcoming': 'Die Galerie erscheint hier nach dem Shooting.',

  // ── Zahlungen ─────────────────────────────────────────────────────────────
  'portal.payments.title': 'Zahlungen',
  'portal.payments.subtitle': 'Alle Rechnungen von {studio} an einem Ort.',
  'portal.payments.subtitleNoStudio': 'Alle Ihre Rechnungen an einem Ort.',
  'portal.payments.nextDue': 'Als Nächstes: {amount} fällig bis {date}',
  'portal.payments.allPaid': 'Alles bezahlt — vielen Dank.',
  'portal.payments.col.invoice': 'Rechnung',
  'portal.payments.col.shoot': 'Shooting',
  'portal.payments.col.date': 'Ausgestellt',
  'portal.payments.col.amount': 'Betrag',
  'portal.payments.col.status': 'Status',
  'portal.payments.col.actions': 'Aktionen',
  'portal.payments.pdfFor': 'Rechnung {number} als PDF',
  'portal.payments.questions': 'Fragen zu einer Rechnung?',
};
