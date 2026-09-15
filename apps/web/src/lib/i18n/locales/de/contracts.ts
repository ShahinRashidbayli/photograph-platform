import type { EnContracts } from '../en/contracts';

/**
 * Verträge und elektronische Signatur. Rechtsbegriffe (einfache elektronische
 * Signatur, eIDAS) bleiben unverändert — sie benennen ein bestimmtes
 * Rechtsinstrument.
 */
export const contracts: Record<keyof EnContracts, string> = {
  'contracts.title': 'Verträge',
  'contracts.heading': 'Vertrag',
  'contracts.new': 'Vertrag entwerfen',
  'contracts.none': 'Für diese Buchung gibt es noch keinen Vertrag.',
  'contracts.loading': 'Verträge werden geladen…',
  'contracts.loadError': 'Verträge konnten nicht geladen werden.',

  'contracts.status.DRAFT': 'Entwurf',
  'contracts.status.SENT': 'Wartet auf Unterschrift',
  'contracts.status.SIGNED': 'Unterzeichnet',
  'contracts.status.CANCELLED': 'Zurückgezogen',

  'contracts.action.edit': 'Bearbeiten',
  'contracts.action.send': 'An Kunden senden',
  'contracts.action.cancel': 'Zurückziehen',
  'contracts.action.download': 'PDF herunterladen',
  'contracts.action.save': 'Speichern',
  'contracts.action.saving': 'Speichern…',
  'contracts.action.close': 'Schließen',

  'contracts.field.title': 'Titel',
  'contracts.field.body': 'Vertragstext',

  'contracts.sentTo': 'Gesendet an {name}',
  'contracts.signedOn': 'Unterzeichnet am {date}',

  'contracts.disclaimer':
    'Dieser Entwurf ist ein Ausgangspunkt, keine Rechtsberatung. Lesen Sie ihn vor dem Senden — gebunden sind Sie.',
  'contracts.sendConfirmTitle': 'Diesen Vertrag senden?',
  'contracts.sendConfirmBody':
    'Nach dem Senden ist der Text festgeschrieben und Ihr Kunde kann ihn unterzeichnen. Eine Bearbeitung ist danach nicht mehr möglich — Sie können ihn nur zurückziehen und einen neuen entwerfen.',
  'contracts.cancelConfirmTitle': 'Diesen Vertrag zurückziehen?',
  'contracts.cancelConfirmBody':
    'Ihr Kunde kann ihn dann nicht mehr unterzeichnen. Der Datensatz bleibt erhalten und wird nicht gelöscht.',

  'contracts.tampered':
    'Achtung: Dieser Text stimmt nicht mehr mit dem unterzeichneten überein.',

  'contracts.sign.title': 'Dokumente',
  'contracts.sign.subtitle': 'Verträge, die Ihr Fotograf Ihnen gesendet hat.',
  'contracts.sign.emptyTitle': 'Nichts zu unterschreiben',
  'contracts.sign.emptyBody':
    'Sobald Ihr Fotograf Ihnen einen Vertrag sendet, erscheint er hier zum Lesen und Unterzeichnen.',
  'contracts.sign.open': 'Lesen und unterzeichnen',
  'contracts.sign.view': 'Ansehen',
  'contracts.sign.heading': 'Diesen Vertrag unterzeichnen',
  'contracts.sign.nameLabel': 'Geben Sie Ihren vollständigen Namen ein, um zu unterzeichnen',
  'contracts.sign.namePlaceholder': 'Ihr vollständiger Name',
  'contracts.sign.agree':
    'Ich habe diesen Vertrag gelesen und erkläre mich damit einverstanden.',
  'contracts.sign.submit': 'Vertrag unterzeichnen',
  'contracts.sign.submitting': 'Wird unterzeichnet…',
  'contracts.sign.error':
    'Der Vertrag konnte nicht unterzeichnet werden. Bitte versuchen Sie es erneut.',
  'contracts.sign.done': 'Unterzeichnet. Eine Kopie finden Sie unten.',
  'contracts.sign.legalNote':
    'Die Eingabe Ihres Namens und die Bestätigung gelten als einfache elektronische Signatur (Art. 3 Nr. 10 eIDAS). Ihr Name, der Zeitpunkt und Ihre IP-Adresse werden als Nachweis der Unterzeichnung gespeichert.',
  'contracts.sign.from': 'Von {name}',
  'contracts.sign.withdrawn':
    'Ihr Fotograf hat diesen Vertrag zurückgezogen. Es gibt nichts zu unterzeichnen.',

  'contracts.pageSubtitle': 'Alle Verträge Ihres Studios. Einen neuen starten Sie aus einer Buchung.',
  'contracts.emptyTitle': 'Noch keine Verträge',
  'contracts.emptyBody': 'Verträge entstehen aus einer Buchung — öffnen Sie die Buchung, für die Sie einen brauchen.',
  'contracts.goToBookings': 'Zu den Buchungen',
  'contracts.filterAll': 'Alle',
  'contracts.openBooking': 'Buchung öffnen',
  'nav.contracts': 'Verträge',
};
