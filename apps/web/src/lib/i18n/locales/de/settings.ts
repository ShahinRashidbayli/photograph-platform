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
  'settings.subscription.switchTo': 'Zu {plan} wechseln',
  'settings.subscription.devSwitchWarning':
    'Für diese Installation ist keine Stripe-Abrechnung eingerichtet, und Tarifwechsel ohne Zahlung sind erlaubt. Es wird nichts berechnet und kein Abonnement angelegt — eine Entwicklungseinstellung.',
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
  // ── Team / Plätze ─────────────────────────────────────────────────────────
  'settings.branding.title': 'Ihr Branding',
  'settings.branding.description':
    'Ihr Logo und Ihre Farbe auf den Seiten, die Ihre Kunden sehen — Portfolio, Anfrageformular und jede ausgelieferte Galerie. Der Name Fotolio verschwindet dort ebenfalls.',
  'settings.branding.loading': 'Branding wird geladen…',
  'settings.branding.loadError': 'Ihr Branding konnte nicht geladen werden.',
  'settings.branding.saveError': 'Ihr Branding konnte nicht gespeichert werden.',
  'settings.branding.uploadError': 'Das Logo konnte nicht hochgeladen werden.',
  'settings.branding.logo': 'Logo',
  'settings.branding.noLogo': 'Kein Logo',
  'settings.branding.uploadLogo': 'Logo hochladen',
  'settings.branding.replaceLogo': 'Ersetzen',
  'settings.branding.removeLogo': 'Entfernen',
  'settings.branding.color': 'Markenfarbe',
  'settings.branding.colorHint': 'Für Schaltflächen und Akzente auf Ihren kundenseitigen Seiten.',
  'settings.branding.save': 'Speichern',
  'settings.branding.saved': 'Branding gespeichert.',
  'settings.branding.upgradeTitle': 'Ihr eigener Name darauf',
  'settings.branding.upgradeBody':
    'Mit White-Label-Branding erscheinen Ihr Logo und Ihre Farbe auf Portfolio, Anfrageformular und Kundengalerien, und der Name Fotolio verschwindet dort. Enthalten im Studio-Tarif.',
  'settings.resources.title': 'Räume & Ausrüstung',
  'settings.resources.description':
    'Was ein Shooting außer Ihnen braucht — ein Studioraum, ein Lichtset, ein zweites Gehäuse. Sind sie erfasst, kann eine Buchung angeben, welche sie nutzt, und Sie werden gewarnt, wenn zwei Shootings am selben Tag dasselbe wollen.',
  'settings.resources.loading': 'Wird geladen…',
  'settings.resources.loadError': 'Räume und Ausrüstung konnten nicht geladen werden.',
  'settings.resources.addError': 'Konnte nicht hinzugefügt werden.',
  'settings.resources.saveError': 'Die Änderung konnte nicht gespeichert werden.',
  'settings.resources.rooms': 'Räume',
  'settings.resources.equipment': 'Ausrüstung',
  'settings.resources.kind': 'Art',
  'settings.resources.add': 'Hinzufügen',
  'settings.resources.addLabel': 'Raum oder Ausrüstung hinzufügen',
  'settings.resources.addPlaceholder': 'Studio A, Profoto B10…',
  'settings.resources.retire': 'Stilllegen',
  'settings.resources.restore': 'Reaktivieren',
  'settings.resources.emptyTitle': 'Noch nichts erfasst',
  'settings.resources.emptyBody':
    'Erfassen Sie die Räume und Ausrüstung, die Sie verplanen. Stillgelegtes bleibt hier — es erklärt weiterhin, womit frühere Arbeiten entstanden sind.',
  'settings.team.title': 'Team',
  'settings.team.description':
    'Die Fotografen, die in diesem Studio arbeiten. Alle hier sehen dieselben Buchungen, Kunden und Galerien — nur Sie können einladen, entfernen und ändern, was das Studio bezahlt.',
  'settings.team.loading': 'Team wird geladen…',
  'settings.team.loadError': 'Ihr Team konnte nicht geladen werden.',
  'settings.team.seatsUsed': '{used} von {total} Plätzen belegt',
  'settings.team.seatsFull': 'Voll',
  'settings.team.seatsFullHelp':
    'Alle Plätze Ihres Tarifs sind belegt. Entfernen Sie jemanden, ziehen Sie eine offene Einladung zurück, oder wechseln Sie in einen Tarif mit mehr Plätzen.',
  'settings.team.roleOwner': 'Inhaber',
  'settings.team.roleMember': 'Fotograf',
  'settings.team.invite': 'Einladung senden',
  'settings.team.inviteLabel': 'Fotografen einladen',
  'settings.team.invitePlaceholder': 'name@studio.de',
  'settings.team.inviteSent': 'Einladung an {email} gesendet.',
  'settings.team.inviteError': 'Die Einladung konnte nicht gesendet werden.',
  'settings.team.invitedExpires': 'Einladung läuft ab am {date}',
  'settings.team.revoke': 'Zurückziehen',
  'settings.team.revokeError': 'Die Einladung konnte nicht zurückgezogen werden.',
  'settings.team.remove': 'Entfernen',
  'settings.team.removeTitle': 'Aus dem Studio entfernen?',
  'settings.team.removeBody':
    '{name} verliert sofort den Zugang zu diesem Studio. Buchungen, Kunden und Galerien bleiben — sie gehören dem Studio, nicht dem Konto.',
  'settings.team.removeError': 'Die Person konnte nicht entfernt werden.',
  'settings.team.emptyTitle': 'Bisher nur Sie',
  'settings.team.emptyBody':
    'Laden Sie einen Fotografen ein — er erhält einen eigenen Zugang zu diesem Studio.',
  'settings.team.upgradeTitle': 'Mit anderen Fotografen arbeiten',
  'settings.team.upgradeBody':
    'Ihr Tarif enthält einen Platz. In einem Tarif mit mehr Plätzen laden Sie Fotografen in dieses Studio ein — sie erhalten einen eigenen Zugang und sehen dieselben Buchungen, Kunden und Galerien.',
  'settings.team.overLimit':
    'Ihr Tarif enthält {seats} Platz, und dieses Studio hat mehr Personen. Entfernen Sie jemanden oder ziehen Sie eine offene Einladung zurück, um wieder darunter zu kommen — niemand verliert seine Arbeit, Buchungen bleiben beim Studio.',
  'settings.team.leave': 'Studio verlassen',
  'settings.team.leaveHelp':
    'Beim Verlassen wird Ihr Zugang zu diesem Studio entfernt. Buchungen, Kunden und Galerien, an denen Sie gearbeitet haben, bleiben — sie gehören dem Studio. Ihre E-Mail wird wieder frei, Sie können damit ein eigenes Studio eröffnen.',
  'settings.team.leaveTitle': 'Studio verlassen?',
  'settings.team.leaveBody':
    'Sie werden abgemeldet und verlieren sofort den Zugang. Das lässt sich hier nicht rückgängig machen — der Inhaber müsste Sie erneut einladen.',
  'settings.team.leaveError': 'Das Studio konnte nicht verlassen werden.',
  'settings.team.makeOwner': 'Zum Inhaber machen',
  'settings.team.handoverTitle': 'Studio übergeben?',
  'settings.team.handoverBody':
    '{name} wird Inhaber, Sie werden hier zum gewöhnlichen Fotografen. Abrechnung, Tarif und die Frage, wer im Studio ist, gehen über — einschließlich der Möglichkeit, Sie zu entfernen. Nur diese Person kann es zurückgeben.',
  'settings.team.handoverError': 'Das Studio konnte nicht übergeben werden.',
  'settings.team.pastInvites': 'Frühere Einladungen',
  'settings.team.statusPending': 'Offen',
  'settings.team.statusAccepted': 'Angenommen',
  'settings.team.statusRevoked': 'Zurückgezogen',
  'settings.team.statusExpired': 'Abgelaufen',

  'settings.legal.title': 'Rechtliche Angaben',
  'settings.legal.intro':
    'Diese Angaben erscheinen im Impressum und in der Datenschutzerklärung Ihrer öffentlichen Seite. Sie sind gesetzlich verpflichtet (§5 DDG, Art. 13 DSGVO), sie zu hinterlegen — Fotolios eigenes Impressum deckt Ihre Seite nicht ab.',
  'settings.legal.loadError': 'Rechtliche Angaben konnten nicht geladen werden.',
  'settings.legal.saveError': 'Speichern fehlgeschlagen. Bitte erneut versuchen.',
  'settings.legal.save': 'Speichern',
  'settings.legal.saving': 'Speichern…',
  'settings.legal.saved': 'Gespeichert ✓',
  'settings.legal.completeTitle': 'Pflichtangaben vollständig.',
  'settings.legal.completeBody': 'Ihre öffentliche Seite zeigt ein gültiges Impressum.',
  'settings.legal.view': 'Ansehen →',
  'settings.legal.incompleteTitle_one': 'Noch {count} Pflichtangabe offen.',
  'settings.legal.incompleteTitle_other': 'Noch {count} Pflichtangaben offen.',
  'settings.legal.incompleteBody':
    'Ihre öffentliche Seite weist bis dahin darauf hin, dass Impressum und Datenschutzerklärung nicht veröffentlicht sind — Ihr Anfrageformular nimmt aber weiterhin Anfragen entgegen. Es erhebt damit personenbezogene Daten, ohne dass die nach Art. 13 DSGVO geschuldeten Angaben abrufbar sind. Das Risiko einer Abmahnung liegt bei Ihnen, nicht bei Fotolio.',
  'settings.legal.fieldName': 'Anbieter / Name',
  'settings.legal.fieldStreet': 'Straße und Hausnummer',
  'settings.legal.fieldPostalCode': 'PLZ',
  'settings.legal.fieldCity': 'Ort',
  'settings.legal.fieldCountry': 'Land',
  'settings.legal.fieldEmail': 'E-Mail',
  'settings.legal.fieldPhone': 'Telefon',
  'settings.legal.fieldVatId': 'USt-IdNr.',
  'settings.legal.hintVatId':
    'Nur falls umsatzsteuerpflichtig (§27a UStG). Kleinunternehmer nach §19 UStG lassen das Feld leer.',
  'settings.legal.fieldRegister': 'Handelsregister',
  'settings.legal.hintRegister': 'Nur bei Eintragung, z. B. „Amtsgericht Berlin, HRB 12345“.',
  'settings.legal.fieldResponsible': 'Verantwortlich (§18 Abs. 2 MStV)',
  'settings.legal.hintResponsible': 'Leer lassen, wenn identisch mit dem Anbieter.',
  'settings.legal.fieldPrivacyContact': 'Datenschutz-Kontakt',
  'settings.legal.hintPrivacyContact': 'Leer lassen, wenn identisch mit der E-Mail oben.',

  'settings.tab.aria': 'Einstellungsbereiche',
  'settings.tab.account': 'Konto',
  'settings.tab.studio': 'Studio',
  'settings.tab.business': 'Firma & Recht',
  'settings.tab.payments': 'Zahlungen',
  'settings.tab.plan': 'Tarif',
  'settings.tab.team': 'Team',
  'settings.business.overlapNote':
    'Beide Formulare unten fragen nach Firmenname und Anschrift — eines für Ihre Rechnungen (§14 UStG), eines für Ihr Impressum (§5 DDG). Sie werden getrennt gespeichert, halten Sie sie deshalb übereinstimmend.',
  'settings.business.footnote':
    'Rechnungen verwenden die Angaben aus dem ersten Formular; Ihr öffentliches Impressum und die Datenschutzerklärung das zweite.',

  'settings.subscription.yourPlan': 'Ihr Tarif',
  'settings.subscription.perMonth': '/ Monat',
};
