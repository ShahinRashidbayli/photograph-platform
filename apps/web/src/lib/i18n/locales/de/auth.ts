import type { EnAuth } from '../en/auth';

/**
 * Sign-in, registration and the customer magic-link flow.
 *
 * Typed against the English namespace: a missing or misspelled key fails the
 * build here, pointing at this file rather than one giant dictionary.
 */
export const auth: Record<keyof EnAuth, string> = {
  // ── Customer magic-link login ─────────────────────────────────────────────
  'customerLogin.visualTitle': 'Ihre Fotos, Ihre Momente',
  'customerLogin.visualSubtitle':
    'Melden Sie sich an, um Ihre Buchung zu verfolgen, Ihre Galerie anzusehen und Ihrem Fotografen zu schreiben.',
  'customerLogin.photographerSignIn': 'Als Fotograf anmelden',
  'customerLogin.title': 'Als Kunde anmelden',
  'customerLogin.subtitle':
    'Geben Sie Ihre E-Mail-Adresse und die Subdomain Ihres Fotografen ein — wir senden Ihnen einen einmaligen Anmeldelink. Kein Passwort nötig.',
  'customerLogin.emailLabel': 'E-Mail-Adresse',
  'customerLogin.subdomainLabel': 'Subdomain des Fotografen',
  'customerLogin.subdomainHelper': 'Die Subdomain, die Ihr Fotograf mit Ihnen geteilt hat.',
  'customerLogin.subdomainHelperLocked': 'Sie melden sich auf der Seite Ihres Fotografen an.',
  'customerLogin.fullNameLabel': 'Vollständiger Name (optional)',
  'customerLogin.fullNameHelper': 'Wird nur bei der ersten Anmeldung verwendet.',
  'customerLogin.submit': 'Anmeldelink senden →',
  'customerLogin.submitLoading': 'Link wird gesendet…',
  'customerLogin.footer':
    'Zum ersten Mal hier? Keine Registrierung nötig — mit Ihren Angaben wird Ihr Konto automatisch eingerichtet.',
  'customerLogin.errorRequired': 'E-Mail-Adresse und Subdomain des Fotografen sind erforderlich',
  'customerLogin.errorEmail': 'Bitte geben Sie eine gültige E-Mail-Adresse ein',
  'customerLogin.errorSubdomain':
    'Bitte geben Sie eine gültige Fotografen-Subdomain ein (z. B. anna-foto)',
  'customerLogin.errorSend':
    'Anmeldelink konnte nicht gesendet werden. Bitte versuchen Sie es erneut.',
  'customerLogin.sentTitle': 'Prüfen Sie Ihr Postfach',
  'customerLogin.sentBody':
    'Wenn {email} bei diesem Fotografen registriert ist, haben wir Ihnen gerade einen Anmeldelink gesendet. Er ist 15 Minuten gültig.',
  'customerLogin.sentHint':
    'Nichts erhalten? Sehen Sie in Ihrem Spam-Ordner nach oder fordern Sie unten einen neuen an.',
  'customerLogin.resend': 'Link erneut senden',
  'customerLogin.resendLoading': 'Wird gesendet…',
  'customerLogin.resendDone': 'Gesendet! Prüfen Sie Ihr Postfach erneut.',

  // ── Photographer login ────────────────────────────────────────────────────
  'login.crossLink': 'Als Kunde anmelden',
  'login.title': 'Willkommen zurück',
  'login.subtitle': 'Melden Sie sich in Ihrem Fotolio-Studio an.',
  'login.emailLabel': 'E-Mail-Adresse',
  'login.passwordLabel': 'Passwort',
  'login.showPassword': 'Passwort anzeigen',
  'login.hidePassword': 'Passwort verbergen',
  'login.forgot': 'Passwort vergessen?',
  'login.submit': 'Anmelden',
  'login.submitLoading': 'Anmeldung läuft…',
  'login.noAccount': 'Noch kein Konto?',
  'login.createOne': 'Registrieren',
  'login.errorRequired': 'E-Mail-Adresse und Passwort sind erforderlich',
  'login.errorInvalid': 'Ungültige E-Mail-Adresse oder Passwort',
  'login.errorGeneric': 'Anmeldung fehlgeschlagen',

  // ── Photographer registration ─────────────────────────────────────────────
  'register.crossLink': 'Anmelden',
  'register.visualTitle': 'Bauen Sie Ihr Fotografie-Geschäft aus',
  'register.visualSubtitle':
    '14 Tage kostenlos testen. Keine Kreditkarte. Ihre eigene Buchungsseite in Minuten.',
  'register.title': 'Erstellen Sie Ihr Studio',
  'register.planNote':
    'Sie haben den Tarif {plan} gewählt — 14 Tage kostenlos, jederzeit änderbar.',
  'register.planChange': 'Tarife vergleichen',
  'register.subtitle': '14 Tage kostenlos testen · Keine Kreditkarte erforderlich',
  'register.fullNameLabel': 'Vollständiger Name',
  'register.emailLabel': 'E-Mail-Adresse',
  'register.subdomainLabel': 'Ihre Subdomain',
  'register.subdomainHelper': '3–63 Zeichen · Kleinbuchstaben, Ziffern und Bindestriche',
  'register.passwordLabel': 'Passwort',
  'register.passwordHelper': 'Mind. 10 Zeichen, mit mindestens einem Buchstaben und einer Ziffer',
  'register.pwWeak': 'Schwach',
  'register.pwMedium': 'Mittel',
  'register.pwStrong': 'Stark',
  'register.submit': 'Studio erstellen',
  'register.submitLoading': 'Studio wird erstellt…',
  'register.alreadyAccount': 'Sie haben bereits ein Konto?',
  'register.signIn': 'Anmelden',
  'register.bookingQuestion': 'Buchen Sie bei einem Fotografen?',
  'register.clientSignIn': 'Als Kunde anmelden',
  'register.successTitle': 'Willkommen bei Fotolio!',
  'register.successBody':
    'Ihr Studio ist unter {subdomain}.fotolio.de live. Weiterleitung zu Ihrem Dashboard…',
  'register.errorAllRequired': 'Alle Felder sind erforderlich',
  'register.errorEmail': 'Bitte geben Sie eine gültige E-Mail-Adresse ein',
  'register.errorPasswordLength': 'Das Passwort muss mindestens 10 Zeichen lang sein',
  'register.errorPasswordComposition':
    'Das Passwort muss mindestens einen Buchstaben und eine Ziffer enthalten',
  'register.errorSubdomain':
    'Die Subdomain muss 3–63 Zeichen lang sein, mit einem Buchstaben oder einer Ziffer beginnen und enden; Bindestriche sind dazwischen erlaubt',
  'register.errorGeneric': 'Registrierung fehlgeschlagen',
};
