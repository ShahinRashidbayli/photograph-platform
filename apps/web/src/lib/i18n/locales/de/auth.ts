import type { EnAuth } from '../en/auth';

/**
 * Sign-in, registration and the customer login-code flow.
 *
 * Typed against the English namespace: a missing or misspelled key fails the
 * build here, pointing at this file rather than one giant dictionary.
 */
export const auth: Record<keyof EnAuth, string> = {
  // ── Customer sign-in by emailed code ──────────────────────────────────────
  'customerLogin.visualTitle': 'Ihre Fotos,\nIhre *Momente*',
  'customerLogin.visualSubtitle':
    'Melden Sie sich an, um Ihren Termin zu verfolgen, Ihre Galerie anzusehen und Ihrem Fotografen zu schreiben.',
  'customerLogin.photographerSignIn': 'Anmeldung für Fotografen',
  'customerLogin.title': 'Als Kunde anmelden',
  'customerLogin.subtitle':
    'Geben Sie Ihre E-Mail-Adresse ein — wir schicken Ihnen einen 6-stelligen Code. Kein Passwort nötig.',
  'customerLogin.emailLabel': 'E-Mail-Adresse',
  'customerLogin.studioLabel': 'Ihr Fotograf',
  'customerLogin.studioChange': 'Ändern',
  'customerLogin.fullNameLabel': 'Vollständiger Name',
  'customerLogin.optional': '(optional)',
  'customerLogin.fullNameHelper': 'Wird nur bei der ersten Anmeldung verwendet.',
  'customerLogin.submit': 'Code senden →',
  'customerLogin.submitLoading': 'Code wird gesendet…',
  'customerLogin.footer':
    'Zum ersten Mal hier? Keine Registrierung nötig — Ihr Konto wird automatisch angelegt.',
  'customerLogin.errorRequired': 'Bitte geben Sie Ihre E-Mail-Adresse ein',
  'customerLogin.errorEmail': 'Bitte geben Sie eine gültige E-Mail-Adresse ein',
  'customerLogin.errorSend': 'Code konnte nicht gesendet werden. Bitte versuchen Sie es erneut.',
  'customerLogin.sentTitle': 'Code eingeben',
  'customerLogin.sentBody':
    'Wenn {email} bei diesem Fotografen registriert ist, haben wir gerade einen 6-stelligen Code gesendet. Er ist 10 Minuten gültig.',
  'customerLogin.sentBodyAny':
    'Wenn ein Fotograf {email} hinterlegt hat, haben wir Ihnen gerade Ihren 6-stelligen Code geschickt — bei mehreren Fotografen einen pro Fotograf. Er ist 10 Minuten gültig.',
  'customerLogin.sentHint':
    'Lassen Sie diese Seite offen — öffnen Sie Ihre E-Mails und geben Sie den Code hier ein.',
  'customerLogin.codeLabel': '6-stelliger Code',
  'customerLogin.codeSubmit': 'Anmelden →',
  'customerLogin.codeSubmitLoading': 'Anmeldung läuft…',
  'customerLogin.errorCodeFormat': 'Bitte geben Sie den 6-stelligen Code aus Ihrer E-Mail ein',
  'customerLogin.errorCodeInvalid': 'Dieser Code ist ungültig. Fordern Sie unten einen neuen an.',
  'customerLogin.changeEmail': '← Andere E-Mail-Adresse verwenden',
  'customerLogin.resend': 'Neuen Code senden',
  'customerLogin.resendLoading': 'Wird gesendet…',
  'customerLogin.resendDone': 'Gesendet! Prüfen Sie Ihr Postfach erneut.',
  'customerLogin.resendIn': 'Erneut senden in {wait}',
  'customerLogin.resendError':
    'Es konnte kein weiterer Code gesendet werden. Bitte versuchen Sie es erneut.',
  'customerLogin.resendLimited':
    'Sie haben bereits mehrere Codes angefordert. Bitte warten Sie einen Moment.',
  'customerLogin.resendLimitedFor':
    'Sie haben bereits mehrere Codes angefordert. Sie können in {wait} einen weiteren anfordern.',

  // ── Photographer login ────────────────────────────────────────────────────
  'login.crossLink': 'Als Kunde anmelden',
  'login.visualTitle': 'Ihr *Studio*, genau wie Sie es verlassen haben.',
  'login.visualSubtitle': 'Buchungen, Kunden und Galerien — alles an einem Ort.',
  'login.title': 'Willkommen zurück',
  'login.subtitle': 'Melden Sie sich in Ihrem Fotolio-Studio an.',
  'login.emailLabel': 'E-Mail-Adresse',
  'login.passwordLabel': 'Passwort',
  'login.forgot': 'Passwort vergessen?',
  'login.submit': 'Anmelden',
  'login.submitLoading': 'Anmeldung läuft…',
  'login.noAccount': 'Noch kein Konto?',
  'login.createOne': 'Registrieren',
  'login.errorRequired': 'E-Mail-Adresse und Passwort sind erforderlich',
  'login.errorInvalid': 'Ungültige E-Mail-Adresse oder Passwort',
  'login.errorLocked': 'Zu viele fehlgeschlagene Anmeldeversuche. Bitte warten Sie einige Minuten.',
  'login.errorLockedFor':
    'Zu viele fehlgeschlagene Anmeldeversuche. Sie können es in {wait} erneut versuchen.',
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
  'register.successVerifyNote':
    'Noch eines: Wir haben einen Bestätigungslink an {email} gesendet. Bis Sie ihn anklicken, können wir keine Buchungsmails oder Rechnungen in Ihrem Namen versenden.',
  'register.goToDashboard': 'Zu meinem Dashboard',
  'register.errorEmail': 'Bitte geben Sie eine gültige E-Mail-Adresse ein',
  'register.errorPasswordLength': 'Das Passwort muss mindestens 10 Zeichen lang sein',
  'register.errorPasswordComposition':
    'Das Passwort muss mindestens einen Buchstaben und eine Ziffer enthalten',
  'register.errorSubdomain':
    'Die Subdomain muss 3–63 Zeichen lang sein, mit einem Buchstaben oder einer Ziffer beginnen und enden; Bindestriche sind dazwischen erlaubt',
  'register.errorGeneric': 'Registrierung fehlgeschlagen',
  'register.errorRateLimited':
    'Zu viele Registrierungsversuche aus diesem Netzwerk. Bitte versuchen Sie es später erneut.',
  'register.errorRateLimitedFor':
    'Zu viele Registrierungsversuche aus diesem Netzwerk. Sie können es in {wait} erneut versuchen.',
  // ── E-Mail-Bestätigung (Link aus dem Postfach) ────────────────────────────
  'verifyEmail.visualTitle': 'Ein Klick und es ist bestätigt.',
  'verifyEmail.visualSubtitle':
    'Erst mit bestätigter Adresse versenden wir Buchungsmails und Rechnungen in Ihrem Namen.',
  'verifyEmail.loadingTitle': 'E-Mail wird bestätigt',
  'verifyEmail.loadingBody': 'Einen Moment — wir prüfen Ihren Link.',
  'verifyEmail.successTitle': 'E-Mail bestätigt',
  'verifyEmail.successBody':
    'Ihre Adresse ist bestätigt. Sie können diesen Tab schließen oder zum Dashboard weitergehen.',
  'verifyEmail.errorTitle': 'Bestätigung fehlgeschlagen',
  'verifyEmail.errorMissingToken':
    'Diesem Link fehlt sein Token. Öffnen Sie ihn direkt aus der E-Mail, statt ihn zu kopieren, oder fordern Sie im Dashboard einen neuen an.',
  'verifyEmail.errorInvalid':
    'Dieser Bestätigungslink ist ungültig oder abgelaufen. Im Dashboard können Sie einen neuen anfordern.',
  'verifyEmail.goToDashboard': 'Zum Dashboard',
  'verifyEmail.signIn': 'Anmelden',

  // ── Passwort zurücksetzen: Link anfordern ─────────────────────────────────
  'forgot.visualTitle': 'Ausgesperrt? Kommt vor.',
  'forgot.visualSubtitle': 'Wir bringen Sie im Nu zurück in Ihr Studio.',
  'forgot.title': 'Passwort zurücksetzen',
  'forgot.subtitle':
    'Geben Sie Ihre E-Mail-Adresse ein und wir senden Ihnen einen Link für ein neues Passwort.',
  'forgot.emailLabel': 'E-Mail-Adresse',
  'forgot.submit': 'Link senden',
  'forgot.submitLoading': 'Link wird gesendet…',
  'forgot.errorRequired': 'Geben Sie die E-Mail-Adresse Ihres Kontos ein.',
  'forgot.errorSend': 'Der Link konnte nicht gesendet werden. Bitte versuchen Sie es erneut.',
  'forgot.errorRateLimited': 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.',
  'forgot.errorRateLimitedFor': 'Zu viele Anfragen. Sie können es in {wait} erneut versuchen.',
  'forgot.sentVisualTitle': 'Sehen Sie in Ihr Postfach.',
  'forgot.sentVisualSubtitle': 'Der Link ist eine Stunde lang gültig.',
  'forgot.sentTitle': 'Prüfen Sie Ihre E-Mails',
  'forgot.sentBody':
    'Falls ein Konto für {email} existiert, haben wir einen Link zum Festlegen eines neuen Passworts gesendet. Er läuft in einer Stunde ab und ist nur einmal gültig.',
  'forgot.sentHint':
    'Nichts angekommen? Sehen Sie im Spam-Ordner nach und versuchen Sie es in ein paar Minuten erneut.',
  'forgot.backToSignIn': 'Zurück zur Anmeldung',
  'forgot.clientTip':
    'Sie sind Kundin oder Kunde? Sie brauchen kein Passwort — nutzen Sie den Anmeldelink Ihrer Fotografin oder Ihres Fotografen.',
  'forgot.remembered': 'Doch wieder eingefallen?',

  // ── Passwort zurücksetzen: neues Passwort wählen ──────────────────────────
  'reset.visualTitle': 'Wählen Sie ein neues Passwort.',
  'reset.visualSubtitle': 'Etwas, das nur Sie wählen würden.',
  'reset.title': 'Neues Passwort festlegen',
  'reset.subtitle': 'Mindestens {min} Zeichen, mit einem Buchstaben und einer Ziffer.',
  'reset.passwordLabel': 'Neues Passwort',
  'reset.confirmLabel': 'Neues Passwort bestätigen',
  'reset.submit': 'Passwort aktualisieren',
  'reset.submitLoading': 'Wird aktualisiert…',
  'reset.errorLength': 'Das Passwort muss mindestens {min} Zeichen lang sein.',
  'reset.errorComposition':
    'Das Passwort muss mindestens einen Buchstaben und eine Ziffer enthalten.',
  'reset.errorMismatch': 'Die beiden Passwörter stimmen nicht überein.',
  'reset.errorInvalidLink':
    'Dieser Link ist nicht mehr gültig. Fordern Sie einen neuen an und versuchen Sie es erneut.',
  'reset.errorGeneric':
    'Das Passwort konnte nicht zurückgesetzt werden. Bitte versuchen Sie es erneut.',
  'reset.missingVisualTitle': 'Dieser Link sieht unvollständig aus.',
  'reset.missingVisualSubtitle': 'Der Link funktioniert nur vollständig.',
  'reset.missingTitle': 'Dem Link fehlt sein Token',
  'reset.missingBody': 'Öffnen Sie den Link direkt aus der E-Mail oder fordern Sie einen neuen an.',
  'reset.requestNew': 'Neuen Link anfordern',
  'reset.doneVisualTitle': 'Alles erledigt.',
  'reset.doneVisualSubtitle': 'Melden Sie sich mit Ihrem neuen Passwort an.',
  'reset.doneTitle': 'Passwort aktualisiert',
  'reset.doneBody':
    'Sie wurden sicherheitshalber überall sonst abgemeldet. Melden Sie sich mit dem neuen Passwort an, um fortzufahren.',
  'reset.goToSignIn': 'Zur Anmeldung',
  'reset.backToSignIn': 'Zurück zur Anmeldung',

  // ── Registrierung: Bestätigung, Einwilligung, Verfügbarkeit ───────────────
  'register.confirmLabel': 'Passwort bestätigen',
  'register.errorConfirmRequired': 'Bitte wiederholen Sie Ihr Passwort.',
  'register.errorConfirmMismatch': 'Die beiden Passwörter stimmen nicht überein.',
  'register.errorFullName': 'Bitte geben Sie Ihren Namen ein.',
  'register.terms': 'Ich akzeptiere die {agb} und habe die {privacy} gelesen.',
  'register.termsAgb': 'AGB',
  'register.termsPrivacy': 'Datenschutzerklärung',
  'register.errorTerms':
    'Bitte akzeptieren Sie die AGB und die Datenschutzerklärung, um fortzufahren.',
  'register.subdomainChecking': 'Verfügbarkeit wird geprüft…',
  'register.subdomainAvailable': '{subdomain}.fotolio.de ist frei — gehört Ihnen.',
  'register.subdomainTaken': 'Diese Adresse ist bereits vergeben. Bitte wählen Sie eine andere.',
  'register.subdomainReserved': 'Diese Adresse ist reserviert. Bitte wählen Sie eine andere.',
  'register.subdomainTooShort': 'Mindestens 3 Zeichen.',
  // ── Einladung annehmen (/invite) ──────────────────────────────────────────
  'invite.checking': 'Einladung wird geprüft…',
  'invite.title': '{studio} beitreten',
  'invite.subtitle':
    'Passwort festlegen und los. Sie sehen dieselben Buchungen, Kunden und Galerien wie der Rest von {studio}.',
  'invite.emailLabel': 'Ihre E-Mail',
  'invite.nameLabel': 'Ihr Name',
  'invite.passwordLabel': 'Passwort wählen',
  'invite.passwordHelp': 'Mindestens 10 Zeichen, mit einem Buchstaben und einer Ziffer.',
  'invite.join': 'Studio beitreten',
  'invite.joining': 'Konto wird erstellt…',
  'invite.error': 'Das hat nicht geklappt. Bitte versuchen Sie es erneut.',
  'invite.invalidTitle': 'Diese Einladung ist nicht mehr gültig',
  'invite.invalidBody':
    'Sie ist möglicherweise abgelaufen, zurückgezogen oder bereits verwendet worden. Bitten Sie den Studio-Inhaber um eine neue.',
  'invite.backToLogin': 'Zur Anmeldung',
  'invite.haveAccount': 'Sie haben schon ein Konto? Anmelden',
  'invite.visualTitle': 'Ein Studio, ein Arbeitsbereich',
  'invite.visualSubtitle':
    'Buchungen, Kunden und Galerien — geteilt mit den Fotografen, mit denen Sie arbeiten.',
};
