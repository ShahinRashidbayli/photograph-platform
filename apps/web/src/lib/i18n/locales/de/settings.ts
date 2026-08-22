import type { EnSettings } from '../en/settings';

/**
 * Einstellungen. Steuerbegriffe (Steuernummer, USt-IdNr.,
 * Kleinunternehmer, Regelbesteuerung) bleiben unverändert — sie sind
 * gesetzliche Bezeichnungen, keine übersetzbaren Labels.
 */
export const settings: Record<keyof EnSettings, string> = {
  'settings.title': 'Einstellungen',
  'settings.subtitle.photographer': 'Verwalte dein Konto, dein Studio und deine Abrechnung.',
  'settings.subtitle.client': 'Verwalte dein Konto.',

  'settings.account.title.photographer': 'Konto & Studio',
  'settings.account.title.client': 'Konto',
  'settings.account.subtitle.photographer': 'Deine persönlichen Daten und Studio-Angaben.',
  'settings.account.subtitle.client': 'Deine persönlichen Daten.',
  'settings.account.fullName': 'Vollständiger Name',
  'settings.account.email': 'E-Mail-Adresse',
  'settings.account.subdomain': 'Studioname / Subdomain',
  'settings.account.publicAddress': 'Deine öffentliche Adresse:',
  'settings.account.changePhoto': 'Foto ändern',
  'settings.account.uploading': 'Wird hochgeladen…',
  'settings.account.avatarTooLarge': 'Die Datei muss kleiner als 5 MB sein.',
  'settings.account.storageUnavailable':
    'Speicher ist nicht konfiguriert. Bitte wende dich an den Support.',
  'settings.account.uploadFailed': 'Upload zum Speicher fehlgeschlagen',
  'settings.account.avatarError':
    'Das Foto konnte nicht hochgeladen werden. Bitte versuche es erneut.',
  'settings.account.saveError':
    'Deine Änderungen konnten nicht gespeichert werden. Bitte versuche es erneut.',
  'settings.account.save': 'Änderungen speichern',
  'settings.account.saving': 'Wird gespeichert…',
  'settings.account.saved': 'Gespeichert ✓',

  'settings.plan.title': 'Tarif & Abrechnung',
  'settings.plan.subtitle': 'Dein aktuelles Abonnement und deine Zahlungseinstellungen.',
  'settings.plan.current': 'Aktueller Tarif',
  'settings.plan.upgrade': 'Tarif wechseln',
  'settings.plan.note':
    'Das ist dein eigenes Abonnement für die Plattform. Rechnungen an deine Kunden liegen bei der jeweiligen Buchung; was du ihnen berechnen kannst, stellst du unten unter „Online-Zahlungen“ ein.',

  // Fotolios eigenes Abo. Bewusst anders benannt als die Connect-/Auszahlungs-
  // Texte weiter oben: die beiden werden am leichtesten verwechselt.
  'settings.subscription.title': 'Dein Fotolio-Abo',
  'settings.subscription.subtitle':
    'Was du an Fotolio zahlst. Getrennt von den Auszahlungen oben — das ist, wie deine Kund:innen dich bezahlen.',
  'settings.subscription.loading': 'Wird geladen…',
  'settings.subscription.trial': 'Testphase',
  'settings.subscription.trialEndsOn': 'Deine Testphase läuft bis zum {date}.',
  'settings.subscription.active': 'Aktiv',
  'settings.subscription.renewsOn': 'Verlängert sich am {date}.',
  'settings.subscription.pastDue': 'Zahlung fehlgeschlagen',
  'settings.subscription.pastDueDetail':
    'Deine letzte Zahlung ist fehlgeschlagen. Dein Konto bleibt nutzbar, während Stripe es erneut versucht — bitte aktualisiere deine Karte.',
  'settings.subscription.locked': 'Nur-Lesen',
  'settings.subscription.lockedDetail':
    'Wähle einen Tarif, um wieder Buchungen, Galerien und Rechnungen anzulegen. Alles Bestehende bleibt verfügbar.',
  'settings.subscription.manage': 'Abo verwalten',
  'settings.subscription.choose': '{plan} wählen',
  'settings.subscription.currentPlan': '{plan} (aktuell)',
  'settings.subscription.yearly': 'Jährlich zahlen (2 Monate gratis)',
  'settings.subscription.unavailable':
    'Abonnements sind auf dieser Installation noch nicht aktiviert. Dein Konto bleibt nutzbar; wende dich an den Support.',
  'settings.subscription.loadError': 'Abo konnte nicht geladen werden.',
  'settings.subscription.checkoutError':
    'Checkout konnte nicht geöffnet werden. Bitte erneut versuchen.',
  'settings.subscription.portalError':
    'Abo-Portal konnte nicht geöffnet werden. Bitte erneut versuchen.',

  'settings.danger.title': 'Gefahrenzone',
  'settings.danger.subtitle': 'Unwiderrufliche Aktionen. Bitte mit Bedacht fortfahren.',
  'settings.danger.deleteAccount': 'Konto löschen',

  // ── Pakete ────────────────────────────────────────────────────────────
  'settings.packages.title': 'Pakete',
  'settings.packages.subtitle':
    'Preispakete, in die deine Kunden gebucht werden können. Wählst du eines bei einer Buchung, wird der Preis automatisch übernommen.',
  'settings.packages.loading': 'Pakete werden geladen…',
  'settings.packages.loadError': 'Pakete konnten nicht geladen werden.',
  'settings.packages.empty': 'Noch keine Pakete',
  'settings.packages.emptyBody':
    'Lege ein Preispaket an, um die automatische Preisübernahme bei Buchungen zu nutzen. Kunden sehen diese Pakete auf deiner öffentlichen Seite.',
  'settings.packages.name': 'Paketname *',
  'settings.packages.namePlaceholder': 'z. B. Hochzeit Standard',
  'settings.packages.price': 'Preis (€) *',
  'settings.packages.pricePlaceholder': 'z. B. 1800',
  'settings.packages.duration': 'Dauer (Stunden)',
  'settings.packages.durationPlaceholder': 'z. B. 8',
  'settings.packages.includedPhotos': 'Enthaltene Fotos',
  'settings.packages.includedPhotosPlaceholder': 'z. B. 300',
  'settings.packages.sortOrder': 'Reihenfolge',
  'settings.packages.active': 'Aktiv',
  'settings.packages.inactive': 'Inaktiv',
  'settings.packages.status': 'Status',
  'settings.packages.photos': 'Fotos',
  'settings.packages.actions': 'Aktionen',
  'settings.packages.cancel': 'Abbrechen',
  'settings.packages.delete': 'Löschen',
  'settings.packages.deleteConfirm': 'Dieses Paket löschen?',
  'settings.packages.create': 'Paket erstellen',
  'settings.packages.save': 'Änderungen speichern',
  'settings.packages.submitting': 'Wird gespeichert…',
  'settings.packages.nameRequired': 'Name ist erforderlich.',
  'settings.packages.priceInvalid': 'Der Preis muss eine positive Zahl in Euro sein.',
  'settings.packages.saveError': 'Das Paket konnte nicht gespeichert werden.',
  'settings.packages.deleteError': 'Das Paket konnte nicht gelöscht werden.',

  // ── Geschäftsangaben (§14 UStG) ───────────────────────────────────────
  'settings.billing.title': 'Geschäftsangaben',
  'settings.billing.subtitle':
    'Erscheinen auf jeder Rechnung, die du stellst. §14 UStG verlangt sie vollständig — bis dahin bleibt die Rechnungsstellung gesperrt.',
  'settings.billing.incomplete': 'Unvollständig — du kannst noch keine Rechnungen stellen.',
  'settings.billing.loading': 'Wird geladen…',
  'settings.billing.loadFailed':
    'Deine aktuellen Angaben konnten nicht geladen werden, deshalb ist das Formular ausgeblendet — ein Speichern mit leeren Feldern würde sie überschreiben. Bitte lade die Seite neu.',
  'settings.billing.businessName': 'Firmenname',
  'settings.billing.street': 'Straße und Hausnummer',
  'settings.billing.addressLine2': 'Adresszusatz (optional)',
  'settings.billing.postalCode': 'PLZ',
  'settings.billing.city': 'Ort',
  'settings.billing.country': 'Land',
  'settings.billing.taxId': 'Steuernummer',
  'settings.billing.vatId': 'USt-IdNr.',
  'settings.billing.taxIdHint':
    'Eine von beiden genügt — je nachdem, was dein Finanzamt vergeben hat.',
  'settings.billing.taxMode': 'Besteuerung',
  'settings.billing.taxModeKleinunternehmer': 'Kleinunternehmer (§19 UStG — keine USt.)',
  'settings.billing.taxModeRegelbesteuerung': 'Regelbesteuerung (mit USt.)',
  'settings.billing.taxModeHint':
    'Bestimmt, ob deine Rechnungen Umsatzsteuer ausweisen. Bereits gestellte Rechnungen bleiben unberührt — die sind gesetzlich fixiert.',
  'settings.billing.save': 'Geschäftsangaben speichern',
  'settings.billing.saving': 'Wird gespeichert…',
  'settings.billing.saved': 'Gespeichert',
  'settings.billing.loadError': 'Deine Geschäftsangaben konnten nicht geladen werden.',
  'settings.billing.saveError': 'Deine Geschäftsangaben konnten nicht gespeichert werden.',

  // ── Stripe Connect ────────────────────────────────────────────────────
  'settings.stripe.title': 'Online-Zahlungen',
  'settings.stripe.subtitle':
    'Kunden bezahlen deine Rechnungen per Karte oder SEPA-Lastschrift. Das Geld geht direkt auf dein eigenes Stripe-Konto — es liegt nie bei uns.',
  'settings.stripe.loading': 'Wird geladen…',
  'settings.stripe.unavailable': 'Nicht verfügbar',
  'settings.stripe.unavailableDetail':
    'Online-Zahlungen sind auf dieser Installation nicht aktiviert. Überweisung funktioniert weiterhin.',
  'settings.stripe.ready': 'Bereit',
  'settings.stripe.readyDetail':
    'Du kannst Karten- und SEPA-Zahlungen annehmen, und Stripe zahlt auf dein Bankkonto aus.',
  'settings.stripe.readyNoPayouts':
    'Du kannst Zahlungen annehmen. Stripe prüft deine Bankdaten noch, bevor ausgezahlt wird.',
  'settings.stripe.inReview': 'In Prüfung',
  'settings.stripe.inReviewDetail': 'Stripe prüft deine Angaben. Das dauert meist wenige Minuten.',
  'settings.stripe.incomplete': 'Unvollständig',
  'settings.stripe.incompleteDetail':
    'Du hast die Einrichtung begonnen, aber nicht abgeschlossen — Stripe fehlen noch ein paar Angaben.',
  'settings.stripe.notConnected': 'Nicht verbunden',
  'settings.stripe.notConnectedDetail':
    'Verbinde Stripe, damit Kunden deine Rechnungen per Karte oder SEPA-Lastschrift bezahlen können.',
  'settings.stripe.commission':
    'Im Tarif {plan} behalten wir {percent} jeder hier eingezogenen Zahlung. Überweisungen, die du selbst erfasst, sind kostenfrei.',
  'settings.stripe.noCommission':
    'Im Tarif {plan} behältst du 100 % jeder Zahlung — keine Provision.',
  'settings.stripe.connect': 'Stripe verbinden',
  'settings.stripe.finishSetup': 'Einrichtung abschließen',
  'settings.stripe.manage': 'Bei Stripe verwalten',
  'settings.stripe.opening': 'Stripe wird geöffnet…',
  'settings.stripe.refresh': 'Status aktualisieren',
  'settings.stripe.statusError': 'Dein Auszahlungsstatus konnte nicht geladen werden.',
  'settings.stripe.onboardingError': 'Stripe-Einrichtung konnte nicht geöffnet werden.',
  'settings.datev.title': 'DATEV-Export',
  'settings.datev.description':
    'Übergeben Sie Ihrem Steuerberater einen DATEV-Buchungsstapel (EXTF) aller Rechnungen eines Geschäftsjahres. Stornierte Rechnungen und ihre Stornobelege sind enthalten, wie von der GoBD gefordert.',
  'settings.datev.year': 'Geschäftsjahr',
  'settings.datev.download': 'CSV herunterladen',
  'settings.datev.accountsNotice':
    'Der Export verwendet SKR03-Standardkonten (Debitor 10000, Erlöse 8400 bzw. 8337 bei Kleinunternehmern). Lassen Sie Ihren Steuerberater vor dem Import prüfen, ob diese zu Ihrem Kontenrahmen passen — die Struktur stimmt, die Kontenzuordnung ist seine Entscheidung.',
};
