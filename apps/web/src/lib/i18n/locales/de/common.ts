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

  'common.close': 'Schließen',
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
};
