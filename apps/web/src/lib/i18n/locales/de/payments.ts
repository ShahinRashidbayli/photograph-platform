import type { EnPayments } from '../en/payments';

/** Zahlungen aus Kundensicht. */
export const payments: Record<keyof EnPayments, string> = {
  'payments.title': 'Zahlungen',
  'payments.loading': 'Deine Zahlungen werden geladen…',
  'payments.summary.empty':
    'Sobald du ein Shooting buchst, erscheinen hier deine Anzahlung und der Restbetrag.',
  'payments.summary.line': '{paid} von {total} bezahlt · {remaining} offen für {count} Shootings',
  'payments.summary.lineSingle': '{paid} von {total} bezahlt · {remaining} offen für 1 Shooting',
  'payments.loadError':
    'Deine Zahlungen konnten gerade nicht geladen werden. Bitte lade die Seite gleich neu.',

  'payments.due.inDays_one': 'Fällig in {count} Tag',
  'payments.due.inDays_other': 'Fällig in {count} Tagen',
  'payments.due.now': 'Restbetrag fällig',
  'payments.due.remainingBalance': '{title} · Restbetrag',
  'payments.due.beforeSession': 'Vor deinem Shooting am {date}',
  'payments.due.settleBelow':
    'Unten unter „Rechnungen“ bezahlen — per Karte, SEPA-Lastschrift oder Überweisung.',

  'payments.settled.badge': 'Alles beglichen',
  'payments.settled.title': 'Du hast alles bezahlt',
  'payments.settled.body': 'Keine offenen Beträge. Deine Zahlungshistorie steht unten.',

  'payments.history.title': 'Zahlungshistorie',
  'payments.history.session': 'Shooting',
  'payments.history.amount': 'Betrag',
  'payments.history.status': 'Status',
  'payments.history.partial': '{paid} bezahlt, {remaining} offen',
  'payments.history.paidToDate': 'Bisher bezahlt',

  'payments.schedule.title': 'Zahlungsplan',
  'payments.schedule.deposit': 'Anzahlung',
  'payments.schedule.remaining': 'Restbetrag',
  'payments.schedule.paid': 'Bezahlt',
  'payments.schedule.pending': 'Ausstehend',
  'payments.schedule.by': 'Bis {date}',
  'payments.schedule.total': '{title} gesamt',
  'payments.schedule.none': 'Keine geplanten Zahlungen — du hast keinen offenen Betrag.',

  'payments.invoices.title': 'Rechnungen',

  'payments.how.title': 'So funktioniert die Zahlung',
  'payments.how.body':
    'Dein Fotograf stellt eine Rechnung; du kannst sie hier per Karte oder SEPA-Lastschrift bezahlen — oder per Überweisung mit dem angegebenen Verwendungszweck. Zahlungen gehen direkt an deinen Fotografen. Die Kartendaten verarbeitet Stripe; sie erreichen diese Seite nie.',

  'payments.questions.title': 'Fragen zu einer Zahlung?',
  'payments.questions.body':
    'Schreib deinem Fotografen direkt — für Erstattungen und Verschiebungen gelten die Bedingungen aus deiner Buchung.',
  'payments.questions.message': 'Fotograf kontaktieren',
  'payments.questions.messagingSoon': 'Nachrichten folgen bald',

  'payments.empty.title': 'Noch keine Zahlungen',
  'payments.empty.body':
    'Wenn du ein Shooting buchst, erscheinen hier Anzahlung und Restbetrag — zusammen mit allem, was du bereits bezahlt hast.',
  'payments.empty.cta': 'Zu deinen Buchungen',

  'payments.state.paid': 'Bezahlt',
  'payments.state.partial': 'Anzahlung bezahlt',
  'payments.state.due': 'Offen',
  'payments.state.quote': 'Angebot',
  'payments.sessionFallback': 'Shooting',
};
