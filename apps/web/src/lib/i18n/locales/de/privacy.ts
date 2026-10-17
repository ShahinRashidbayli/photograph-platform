import type { EnPrivacy } from '../en/privacy';

/**
 * Daten einer Person löschen (Art. 17 DSGVO) — Einstellungen → Datenschutz.
 *
 * Für Fotografinnen und Fotografen geschrieben, die eine Anfrage beantworten:
 * Jede Zeile sagt, was mit welchen Daten geschieht, und was bleibt, sagt warum.
 */
export const privacy: Record<keyof EnPrivacy, string> = {
  'privacy.title': 'Daten einer Person löschen',
  'privacy.description':
    'Wenn eine Kundin oder ein Kunde die Löschung ihrer Daten verlangt, geben Sie die E-Mail-Adresse ein. Bevor etwas geschieht, sehen Sie genau, was gelöscht würde und was Sie von Gesetzes wegen aufbewahren müssen.',
  'privacy.emailLabel': 'E-Mail-Adresse der Person',
  'privacy.emailPlaceholder': 'name@beispiel.de',
  'privacy.preview': 'Anzeigen, was gelöscht würde',
  'privacy.previewing': 'Wird geprüft …',
  'privacy.previewHeading': 'Wenn Sie {email} löschen',
  'privacy.doneHeading': '{email} gelöscht',
  'privacy.nothingFound': 'Ihr Studio hat unter dieser Adresse nichts gespeichert.',
  'privacy.erase': 'Endgültig löschen',
  'privacy.erasing': 'Wird gelöscht …',
  'privacy.another': 'Weitere Person löschen',
  'privacy.confirmTitle': 'Diese Person endgültig löschen?',
  'privacy.confirmMessage':
    'Gelöschte Daten und Fotos lassen sich nicht wiederherstellen. Anonymisierte Buchungen bleiben ohne Name, Adresse und Notizen in Ihren Unterlagen.',
  'privacy.confirmPhotos_one': '{count} ausgeliefertes Foto wird aus dem Speicher gelöscht.',
  'privacy.confirmPhotos_other': '{count} ausgelieferte Fotos werden aus dem Speicher gelöscht.',
  'privacy.doneNote':
    'Teilen Sie der Person mit, dass die Löschung erfolgt ist und was aus welchem Grund aufbewahrt wird — die Gründe stehen oben.',
  'privacy.ownerOnly': 'Nur die Inhaberin oder der Inhaber des Studios kann Daten löschen.',
  'privacy.previewError': 'Die Adresse konnte nicht geprüft werden. Bitte versuchen Sie es erneut.',
  'privacy.eraseError':
    'Es wurde nichts gelöscht — die Anfrage ist fehlgeschlagen. Bitte versuchen Sie es erneut.',

  'privacy.category.customerAccounts': 'Konto im Kundenportal',
  'privacy.category.clients': 'Kundenverzeichnis',
  'privacy.category.leads': 'Anfragen (Leads)',
  'privacy.category.inquiries': 'Buchungsanfragen',
  'privacy.category.bookings': 'Buchungen',
  'privacy.category.galleries': 'Galerien',
  'privacy.category.galleryPhotos': 'Ausgelieferte Fotos',
  'privacy.category.contracts': 'Verträge',
  'privacy.category.invoices': 'Rechnungen',
  'privacy.category.auditEntries': 'Aktivitätsprotokoll',

  'privacy.hint.bookings':
    'Datum, Paket, Beträge und Status bleiben für Ihre Buchhaltung erhalten.',
  'privacy.hint.auditEntries':
    'Die im Protokoll vermerkte Adresse wird entfernt, der Eintrag bleibt.',

  'privacy.will.deleted_one': '{count} wird gelöscht',
  'privacy.will.deleted_other': '{count} werden gelöscht',
  'privacy.will.anonymized_one': '{count} wird anonymisiert',
  'privacy.will.anonymized_other': '{count} werden anonymisiert',
  'privacy.will.retained_one': '{count} bleibt erhalten',
  'privacy.will.retained_other': '{count} bleiben erhalten',
  'privacy.did.deleted_one': '{count} gelöscht',
  'privacy.did.deleted_other': '{count} gelöscht',
  'privacy.did.anonymized_one': '{count} anonymisiert',
  'privacy.did.anonymized_other': '{count} anonymisiert',
  'privacy.did.retained_one': '{count} aufbewahrt',
  'privacy.did.retained_other': '{count} aufbewahrt',

  'privacy.basis.TAX_RECORDS':
    'Aufbewahrt, weil Rechnungen zehn Jahre aufbewahrt werden müssen (§147 AO, §14b UStG).',
  'privacy.basis.LEGAL_CLAIMS':
    'Aufbewahrt, weil ein unterschriebener Vertrag Ihr Nachweis der Vereinbarung ist (Art. 17 Abs. 3 lit. e DSGVO).',
};
