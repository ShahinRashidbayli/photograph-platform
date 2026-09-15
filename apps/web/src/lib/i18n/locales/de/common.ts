import type { EnCommon } from '../en/common';

/**
 * Shared chrome, contact actions and generic UI verbs.
 *
 * Typed against the English namespace: a missing or misspelled key fails the
 * build here, pointing at this file rather than one giant dictionary.
 */
export const common: Record<keyof EnCommon, string> = {
  // ── Common chrome ─────────────────────────────────────────────────────────
  'theme.switchToDark': 'Zum dunklen Design wechseln',
  'theme.switchToLight': 'Zum hellen Design wechseln',
  'auth.emailPlaceholder': 'name@beispiel.de',
  'auth.showPassword': 'Passwort anzeigen',
  'auth.hidePassword': 'Passwort verbergen',

  // ── Warten nach einer Sperre / einem Limit ────────────────────────────────
  'auth.retrySeconds_one': '{count} Sekunde',
  'auth.retrySeconds_other': '{count} Sekunden',
  'auth.retryMinutes_one': '{count} Minute',
  'auth.retryMinutes_other': '{count} Minuten',

  'common.close': 'Schließen',
  'dateField.open': 'Datum wählen',
  'common.cancel': 'Abbrechen',
  'common.soon': 'Bald',
  'common.comingSoon': 'Kommt bald',

  'common.tryAgain': 'Erneut versuchen',
  'common.saving': 'Wird gespeichert…',
  'common.confirm': 'Bestätigen',
  'common.working': 'Wird ausgeführt…',

  'common.tryOtherFilter': 'Versuchen Sie einen anderen Filter oder Suchbegriff.',

  // ── Contact actions (leads + clients) ─────────────────────────────────────
  'contact.whatsapp': 'WhatsApp',
  'contact.whatsappTitle': 'WhatsApp-Chat öffnen',
  'contact.noPhone': 'Keine Telefonnummer hinterlegt',
  'contact.email': 'E-Mail',
  'contact.emailTitle': 'E-Mail an {email}',
  'contact.noEmail': 'Keine E-Mail-Adresse hinterlegt',

  'upgrade.cta': 'Tarife ansehen',
  'upgrade.ctaNamed': 'Auf {plan} upgraden',
  'upgrade.seePlans': 'Tarife ansehen',
  'upgrade.notNow': 'Jetzt nicht',
  'upgrade.dialogTitle': 'Dafür braucht es einen größeren Tarif',
  'upgrade.dialogBody': 'Diese Funktion ist in Ihrem aktuellen Tarif nicht enthalten.',
  'upgrade.dialogPlanLine': 'Verfügbar ab {plan}.',
  'upgrade.navLocked': 'Enthalten ab {plan}',
  'upgrade.contractsTitle': 'Verträge & E-Signatur',
  'upgrade.contractsBody':
    'Senden Sie aus dieser Buchung heraus einen Fotovertrag und holen Sie eine rechtsverbindliche Unterschrift ein — ohne E-Mail-Hin-und-Her.',
};
