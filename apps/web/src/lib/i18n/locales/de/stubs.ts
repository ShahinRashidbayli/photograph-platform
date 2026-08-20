import type { EnStubs } from '../en/stubs';

/** Noch nicht gebaute Bereiche. */
export const stubs: Record<keyof EnStubs, string> = {
  'stubs.reports.title': 'Berichte',
  'stubs.reports.subtitle': 'Conversion, Saisonalität und Paketmix deiner Buchungen.',
  'stubs.reports.body':
    'Conversion von Anfrage zu Buchung, saisonale Nachfrage und deine umsatzstärksten Pakete. Wir zeigen das, sobald du ein paar Buchungen durchlaufen hast — die Daten müssen erst existieren, bevor es ein Diagramm gibt.',
  'stubs.revenue.title': 'Umsatz',
  'stubs.revenue.subtitle': 'Einnahmen, offene Anzahlungen und Entwicklung im Jahresvergleich.',
  'stubs.revenue.body':
    'Monatsumsatz, eingegangene gegenüber offenen Anzahlungen und Jahresvergleich. Stripe-Auszahlungen und der Abgleich mit Rechnungen stehen auf der Roadmap.',
  'stubs.documents.title': 'Dokumente',
  'stubs.documents.subtitle': 'Verträge, Model Releases und Einwilligungen zu deinen Shootings.',
  'stubs.documents.notAvailable': 'Noch nicht verfügbar',
  'stubs.documents.body':
    'Verträge und E-Signatur sind noch nicht gebaut, deshalb gibt es hier nichts zu sehen. Sobald sie da sind, erscheint hier alles, was du mit deinem Fotografen unterschrieben hast — und nichts davon, bevor du es wirklich unterschrieben hast.',
  'stubs.documents.back': 'Zurück zu den Buchungen',
  'stubs.comingSoon': 'Demnächst',
};
