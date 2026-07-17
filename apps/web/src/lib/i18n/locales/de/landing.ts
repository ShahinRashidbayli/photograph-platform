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
  'landing.nav.features': 'Funktionen',
  'landing.nav.howItWorks': 'So funktioniert’s',
  'landing.nav.pricing': 'Preise',
  'landing.nav.forClients': 'Für Kunden',
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
  'landing.hero.mockExpected': '€1.240 erwartet',
  'landing.hero.toastTitle': 'Neue Buchung bestätigt',
  'landing.hero.toastMeta': 'Hochzeit · €480 Anzahlung bezahlt',

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

  'landing.features.eyebrow': 'Alles an einem Ort',
  'landing.features.title': 'Führen Sie Ihr Studio ohne den Papierkram.',
  'landing.features.sub':
    'Von der ersten Anfrage bis zur finalen Galerie-Auslieferung lebt jeder Schritt des Shootings in einem verbundenen Workspace.',
  'landing.features.galleriesTitle': 'Kundengalerien, die verkaufen',
  'landing.features.galleriesText':
    'Liefern Sie private, gebrandete Galerien, die Ihre Kunden ansehen, favorisieren und herunterladen können — keine WeTransfer-Links, kein Ablaufstress.',
  'landing.features.galleryBarMeta': '248 Fotos · 12 favorisiert',
  'landing.features.downloadAll': 'Alle herunterladen',
  'landing.features.bookingsTitle': 'Online-Buchungen',
  'landing.features.bookingsText':
    'Kunden buchen Sessions direkt von Ihrer Portfolio-Seite — synchronisiert mit Ihrem Kalender.',
  'landing.features.booked': 'Gebucht',
  'landing.features.open': 'Frei',
  'landing.features.contractsTitle': 'Verträge & digitale Signatur',
  'landing.features.contractsText':
    'Senden Sie Shooting-Verträge und holen Sie rechtsverbindliche Unterschriften ein — kein E-Mail-Hin-und-Her.',
  'landing.features.signed': 'Signiert',
  'landing.features.esigned': 'digital signiert',
  'landing.features.stripeTitle': 'Stripe-Zahlungen',
  'landing.features.stripeText':
    'Nehmen Sie Anzahlungen und Restzahlungen online entgegen — mit automatischem Abgleich.',
  'landing.features.deposit': 'Anzahlung',
  'landing.features.paid': 'Bezahlt',
  'landing.features.balance': 'Restbetrag',
  'landing.features.due': 'Fällig 12. Jul',
  'landing.features.leadTitle': 'Lead-Management',
  'landing.features.leadText':
    'Erfassen, bewerten und leiten Sie Anfragen — damit keine Buchungsanfrage durchrutscht.',
  'landing.features.leadHot': '92 · Heiß',
  'landing.features.leadWarm': '61 · Warm',
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

  'landing.audience.eyebrow': 'Beide Seiten der Linse',
  'landing.audience.title': 'Für alle im Bild gebaut.',
  'landing.audience.photographersTitle': 'Für Fotografen',
  'landing.audience.photographersTag': 'Ein Studio für das gesamte Geschäft',
  'landing.audience.clientsTitle': 'Für Kunden',
  'landing.audience.clientsTag': 'Buchen, signieren und ansehen — alles in einem Link',
  'landing.audience.startTrial': 'Kostenlos testen',
  'landing.audience.findPhotographer': 'Fotografen finden',
  'landing.phFeat.portfolio': 'Portfolio & öffentliche Buchungsseite',
  'landing.phFeat.leads': 'Lead-Management & Scoring',
  'landing.phFeat.contracts': 'Verträge & Zahlungen',
  'landing.phFeat.data': 'DSGVO-konforme Kundendaten',
  'landing.clFeat.browse': 'Portfolios durchsuchen & online buchen',
  'landing.clFeat.sign': 'Verträge online signieren',
  'landing.clFeat.pay': 'Sicher mit Stripe bezahlen',
  'landing.clFeat.gallery': 'Ihre Galerie ansehen & herunterladen',

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

  'landing.cta.eyebrow': 'Bereit, wenn Sie es sind',
  'landing.cta.title': 'Verbringen Sie Ihren Tag hinter der Kamera.',
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
