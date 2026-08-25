import type { EnLanding } from '../en/landing';

/**
 * Public marketing page.
 *
 * Typed against the English namespace: a missing or misspelled key fails the
 * build here, pointing at this file rather than one giant dictionary.
 */
export const landing: Record<keyof EnLanding, string> = {
  // ── Landing page ──────────────────────────────────────────────────────────
  'landing.aria.home': 'Fotolio Startseite',
  'landing.aria.mockPreview': 'Fotolio Buchungs-Dashboard-Vorschau',
  'landing.aria.billingPeriod': 'Abrechnungszeitraum',
  'landing.aria.openMenu': 'Menü öffnen',
  'landing.aria.closeMenu': 'Menü schließen',
  'landing.aria.sections': 'Abschnitte',
  'landing.nav.features': 'Funktionen',
  'landing.nav.howItWorks': 'So funktioniert’s',
  'landing.nav.pricing': 'Preise',
  // Points at the audience section, which is now about what the
  // photographer gets. Labelling it "for clients" re-created, in the
  // nav, the two-audience framing the section itself dropped.
  'landing.nav.studio': 'Ihr Studio',
  // The footer link goes to /customer/auth/login. It used to read "Find a
  // photographer", promising a directory that does not exist and landing
  // the visitor on a sign-in form instead.
  'landing.nav.clientSignIn': 'Kunden-Login',
  'landing.nav.signIn': 'Anmelden',
  'landing.nav.getStarted': 'Loslegen',

  'landing.hero.title1': 'Führen Sie Ihr Business.',
  'landing.hero.title2pre': 'Bewahren Sie Ihr ',
  'landing.hero.title2accent': 'Handwerk',
  'landing.hero.lede':
    'Leads, Buchungen, Verträge, Stripe-Zahlungen und Kundengalerien — Fotolio übernimmt das Geschäftliche, damit Sie hinter der Kamera bleiben.',
  'landing.hero.ctaPrimary': '14 Tage kostenlos testen',
  'landing.hero.ctaSecondary': 'So funktioniert’s',
  'landing.hero.microNoCard': 'Keine Kreditkarte',
  'landing.hero.microCancel': 'Jederzeit kündbar',
  'landing.hero.mockThisWeek': 'Diese Woche',
  // Der Betrag wird interpoliert und nie in den String geschrieben: von Hand
  // getippt stand hier „€1.240“ — die englische Stellung des Symbols unter
  // deutschem Text, ausgerechnet auf der Seite, die „für den deutschen Markt
  // gebaut“ verkauft. Die Seite übergibt `format.eur(…)`, das daraus „1.240 €“
  // macht.
  'landing.hero.mockExpected': '{amount} erwartet',
  'landing.hero.toastTitle': 'Neue Buchung bestätigt',
  'landing.hero.toastMeta': 'Hochzeit · {amount} Anzahlung bezahlt',

  'landing.cap.leadScoring': 'Lead-Scoring',
  'landing.cap.onlineBooking': 'Online-Buchung',
  'landing.cap.esign': 'Verträge digital signieren',
  'landing.cap.stripe': 'Stripe-Zahlungen',
  'landing.cap.galleries': 'Private Galerien',
  'landing.cap.invoices': 'GoBD-Rechnungen',
  'landing.cap.bilingual': 'Zweisprachig DE / EN',

  'landing.booking.confirmed': 'Bestätigt',
  'landing.booking.depositPaid': 'Anzahlung bezahlt',
  'landing.booking.contractSent': 'Vertrag gesendet',
  'landing.booking.n1Name': 'Lena & Kaan — Hochzeit',
  'landing.booking.n1Meta': 'Sa., 12. Juli · Grugapark, Essen',
  'landing.booking.n2Name': 'Familie Meyer — Porträt',
  'landing.booking.n2Meta': 'So., 13. Juli · Studio',
  'landing.booking.n3Name': 'Julia T. — Neugeborenes',
  'landing.booking.n3Meta': 'Di., 15. Juli · Vor Ort',

  'landing.features.eyebrow': 'Alles an einem Ort',
  'landing.features.title': 'Führen Sie Ihr Studio ohne den Papierkram.',
  'landing.features.sub':
    'Von der ersten Anfrage bis zur finalen Galerie-Auslieferung lebt jeder Schritt des Shootings in einem verbundenen Workspace.',
  'landing.features.galleriesTitle': 'Keine WeTransfer-Links, kein Ablaufstress',
  'landing.features.galleriesText':
    'Liefern Sie private, gebrandete Galerien, die Ihre Kunden ansehen, favorisieren und herunterladen können — der Link gehört Ihnen und bleibt so lange aktiv, wie Sie es sagen.',
  // Beispieldaten für die Vorschauen. Sie stehen in den Wörterbüchern und nicht
  // in der Seite, weil ein Mock mit „Sat 12 Jul“ unter deutschem Text dem
  // Besucher am schnellsten sagt, dass das Produkt nicht für ihn gebaut wurde.
  'landing.features.galleryBarName': 'Lena & Kaan — Hochzeit',
  'landing.features.galleryBarMeta': '248 Fotos · 12 favorisiert',
  'landing.features.downloadAll': 'Alle herunterladen',
  'landing.features.bookingsTitle': 'Termine ohne Hin und Her',
  'landing.features.bookingsText':
    'Kunden wählen einen Termin direkt auf Ihrer Portfolio-Seite, und er landet in Ihrem Kalender — kein E-Mail-Verlauf, keine Doppelbuchung.',
  'landing.features.booked': 'Gebucht',
  'landing.features.open': 'Frei',
  'landing.features.slotBooked': 'Sa., 12. Juli · 14:00',
  'landing.features.slotOpen': 'So., 13. Juli · 10:00',
  'landing.features.slotOpenLate': 'So., 13. Juli · 16:00',
  'landing.features.contractsTitle': 'Verträge & digitale Signatur',
  'landing.features.contractsText':
    'Senden Sie Shooting-Verträge und holen Sie rechtsverbindliche Unterschriften ein — kein E-Mail-Hin-und-Her.',
  'landing.features.stripeTitle': 'Stripe-Zahlungen',
  'landing.features.stripeText':
    'Nehmen Sie Anzahlungen und Restzahlungen online entgegen — mit automatischem Abgleich.',
  'landing.features.payDeposit': 'Anzahlung · {amount}',
  'landing.features.payBalance': 'Restbetrag · {amount}',
  'landing.features.payMethods': 'Karte · SEPA',
  'landing.features.paid': 'Bezahlt',
  'landing.features.payEnabled': 'Aktiv',
  'landing.features.leadTitle': 'Keine Anfrage geht unter',
  'landing.features.leadText':
    'Jede Anfrage wird beim Eingang erfasst und bewertet — die, die sich heute lohnen, stehen oben.',
  'landing.features.leadHot': '92 · Heiß',
  'landing.features.leadWarm': '61 · Warm',
  'landing.features.leadCold': '34 · Kalt',
  'landing.features.leadHotName': 'Sarah M. · Hochzeit',
  'landing.features.leadWarmName': 'Tom K. · Porträt',
  'landing.features.leadColdName': 'Jonas B. · Familie',
  'landing.features.germanTitle': 'Für den deutschen Markt gebaut',
  'landing.features.germanText':
    'Zweisprachig DE / EN, DSGVO-bewusst von Haus aus, GoBD-konforme Rechnungen und Kleinunternehmer-Unterstützung.',

  'landing.workflow.eyebrow': 'Eine verbundene Pipeline',
  'landing.workflow.title': 'Jedes Shooting, von der Anfrage bis bezahlt.',
  'landing.workflow.sub':
    'Fotolio bewegt jede Buchung durch denselben klaren Ablauf — so wissen Sie immer genau, was als Nächstes kommt.',
  'landing.pipeline.enquiryTitle': 'Anfrage',
  'landing.pipeline.enquiryText':
    'Ein Lead landet aus Ihrem Portfolio und wird automatisch bewertet.',
  'landing.pipeline.bookingTitle': 'Buchung',
  'landing.pipeline.bookingText':
    'Der Kunde wählt einen Termin; er wird direkt mit Ihrem Kalender synchronisiert.',
  'landing.pipeline.contractTitle': 'Vertrag',
  'landing.pipeline.contractText':
    'Der Shooting-Vertrag wird gesendet und in Minuten digital signiert — rechtsverbindlich.',
  'landing.pipeline.paymentTitle': 'Zahlung',
  'landing.pipeline.paymentText':
    'Anzahlung und Restbetrag werden über Stripe eingezogen und für Sie abgeglichen.',
  'landing.pipeline.galleryTitle': 'Galerie',
  'landing.pipeline.galleryText':
    'Die finalen Bilder landen in einer privaten, gebrandeten Galerie zum Ansehen und Herunterladen.',

  'landing.audience.eyebrow': 'Ihr Studio',
  'landing.audience.title': 'Das ganze Geschäft — nicht nur das Shooting.',
  'landing.audience.sub':
    'Portfolio, Anfragen, Galerien und Kundendaten — ein Arbeitsbereich, und alles davon gehört Ihnen.',
  'landing.audience.seePricing': 'Preise und Pakete ansehen',
  // Ergebnis + das Detail, das es konkret macht. Das Detail ist der Punkt: eine
  // zweite Liste von Funktionsnamen war der Grund, diesen Abschnitt zu überspringen.
  'landing.studio.portfolioTitle': 'Portfolio mit Buchungsseite',
  'landing.studio.portfolioText': 'Eigene Subdomain, eigene Handschrift',
  'landing.studio.leadsTitle': 'Anfragen bewertet und sortiert',
  'landing.studio.leadsText': 'Was sich lohnt, steht oben',
  'landing.studio.galleriesTitle': 'Private Kundengalerien',
  'landing.studio.galleriesText': 'Ein Link, den Sie steuern — kein WeTransfer',
  'landing.studio.dataTitle': 'Kundendaten DSGVO-konform',
  'landing.studio.dataText': 'Aufbewahrungsfristen und Löschung eingebaut',
  'landing.audience.clientTitle': 'Und das bekommen Ihre Kunden',
  'landing.clientExp.book': 'Termin in zwei Klicks buchen',
  'landing.clientExp.gallery': 'Galerie ansehen und herunterladen',
  'landing.clientExp.link': 'Ein Link, kein Konto nötig',

  'landing.pricing.eyebrow': 'Preise',
  'landing.pricing.title': 'Einfache, transparente Preise.',
  'landing.pricing.sub': '14 Tage kostenlos starten. Keine Kreditkarte, jederzeit kündbar.',
  'landing.pricing.monthly': 'Monatlich',
  'landing.pricing.yearly': 'Jährlich',
  'landing.pricing.save': '−2 Monate',
  'landing.pricing.perMonth': '/Mon.',
  'landing.pricing.billedYearly': 'Jährlich abgerechnet',
  'landing.pricing.billedMonthly': 'Monatlich abgerechnet',
  'landing.pricing.mostPopular': 'Am beliebtesten',
  'landing.pricing.vatNote': 'Alle Preise zzgl. gesetzlicher MwSt.',
  'landing.pricing.feeNote':
    '* 2 % Ihrer über Fotolio eingenommenen Zahlungen, zzgl. Stripe-Gebühr. Bei Pro und Studio entfällt sie.',
  'landing.pricing.getStarted': 'Loslegen',
  'landing.price.f.portfolioWebsite': 'Ihre eigene Buchungs-Website',
  'landing.price.f.leadMgmt': 'Anfragen-Eingang & Bewertung',
  'landing.price.f.onlineBookings': 'Online-Buchung & Kalender',
  'landing.price.f.retention60': 'Galerien 60 Tage online',
  'landing.price.f.retention1y': 'Galerien 1 Jahr online',
  'landing.price.f.retention2y': 'Galerien 2 Jahre online',
  'landing.price.f.everythingStarter': 'Alles aus Starter',
  'landing.price.f.stripeDeposits': 'Karten & SEPA (2 %)',
  'landing.price.f.zeroCommission': 'Keine Transaktionsgebühr',
  'landing.price.f.instagramDm': 'Auto-Antwort auf Instagram-DMs',
  'landing.price.f.contractsEsign': 'Verträge mit digitaler Signatur',
  'landing.price.f.crm': 'Kundenhistorie & Notizen',
  'landing.price.f.everythingPro': 'Alles aus Pro',
  'landing.price.f.upTo3': 'Bis zu 3 Fotografen',
  'landing.price.f.analytics': 'Umsatz- & Buchungsberichte',
  'landing.price.f.whiteLabel': 'Eigene Domain & Branding',

  'landing.cta.titlePre': 'Verbringen Sie Ihren Tag hinter der ',
  'landing.cta.titleAccent': 'Kamera',
  'landing.cta.text':
    'Überlassen Sie Fotolio die Leads, Verträge und Zahlungen, während Sie das tun, was nur Sie können.',
  'landing.cta.button': '14 Tage kostenlos testen',
  'landing.cta.micro': 'Keine Kreditkarte erforderlich · DSGVO-konform',

  'landing.footer.brandText':
    'Die All-in-one-Plattform für Fotografen in Deutschland. Buchungen, Kunden und Galerien in einem verbundenen Studio.',
  'landing.footer.product': 'Produkt',
  'landing.footer.account': 'Konto',
  'landing.footer.legal': 'Rechtliches',
  'landing.footer.rights': '© {year} Fotolio. Alle Rechte vorbehalten.',
  'landing.footer.made': 'Made in Germany · DSGVO-konform',
};
