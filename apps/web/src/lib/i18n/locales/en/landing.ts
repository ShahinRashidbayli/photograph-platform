/**
 * Public marketing page.
 *
 * English is the source of truth — these keys define the `Landing` half of
 * `TranslationKey`, and every other locale is compile-checked against it.
 */
export const landing = {
  // ── Landing page ──────────────────────────────────────────────────────────
  'landing.aria.home': 'Fotolio home',
  'landing.aria.mockPreview': 'Fotolio bookings dashboard preview',
  'landing.aria.billingPeriod': 'Billing period',
  // Below 860px the section links collapse behind this button. They used to be
  // `display: none` with nothing in their place, so the whole in-page nav
  // simply did not exist on a phone.
  'landing.aria.openMenu': 'Open menu',
  'landing.aria.closeMenu': 'Close menu',
  'landing.aria.sections': 'Sections',
  'landing.nav.features': 'Features',
  'landing.nav.howItWorks': 'How it works',
  'landing.nav.pricing': 'Pricing',
  // Points at the audience section, which is now about what the
  // photographer gets. Labelling it "for clients" re-created, in the
  // nav, the two-audience framing the section itself dropped.
  'landing.nav.studio': 'Your studio',
  // The footer link goes to /customer/auth/login. It used to read "Find a
  // photographer", promising a directory that does not exist and landing
  // the visitor on a sign-in form instead.
  'landing.nav.clientSignIn': 'Client sign-in',
  'landing.nav.signIn': 'Sign in',
  'landing.nav.getStarted': 'Get started',

  'landing.hero.title1': 'Run the business.',
  'landing.hero.title2pre': 'Keep the ',
  'landing.hero.title2accent': 'craft',
  'landing.hero.lede':
    'Leads, bookings, contracts, Stripe payments and client galleries — Fotolio handles the business side, so you stay behind the camera.',
  'landing.hero.ctaPrimary': 'Start 14-day free trial',
  'landing.hero.ctaSecondary': 'See how it works',
  'landing.hero.microNoCard': 'No credit card',
  'landing.hero.microCancel': 'Cancel anytime',
  'landing.hero.mockThisWeek': 'This week',
  // The amount is interpolated, never written into the string: typed by hand it
  // read "€1.240" in *both* locales — the German separator under English copy,
  // where it means one euro twenty-four, and the English symbol placement under
  // German copy on the page that sells "built for the German market". The page
  // passes `format.eur(…)`, so each locale gets its own grouping and its own
  // side for the symbol.
  'landing.hero.mockExpected': '{amount} expected',
  'landing.hero.toastTitle': 'New booking confirmed',
  'landing.hero.toastMeta': 'Wedding · {amount} deposit paid',

  'landing.cap.leadScoring': 'Lead scoring',
  'landing.cap.onlineBooking': 'Online booking',
  'landing.cap.esign': 'E-sign contracts',
  'landing.cap.stripe': 'Stripe payments',
  'landing.cap.galleries': 'Private galleries',
  'landing.cap.invoices': 'GoBD invoices',
  'landing.cap.bilingual': 'Bilingual DE / EN',

  'landing.booking.confirmed': 'Confirmed',
  'landing.booking.depositPaid': 'Deposit paid',
  'landing.booking.contractSent': 'Contract sent',
  'landing.booking.n1Name': 'Lena & Kaan — Wedding',
  'landing.booking.n1Meta': 'Sat 12 Jul · Grugapark, Essen',
  'landing.booking.n2Name': 'Meyer Family — Portrait',
  'landing.booking.n2Meta': 'Sun 13 Jul · Studio',
  'landing.booking.n3Name': 'Julia T. — Newborn',
  'landing.booking.n3Meta': 'Tue 15 Jul · On location',

  'landing.features.eyebrow': 'Everything in one place',
  'landing.features.title': 'Run your studio without the busywork.',
  'landing.features.sub':
    'From the first enquiry to the final gallery delivery, every step of the shoot lives in one connected workspace.',
  'landing.features.galleriesTitle': 'No WeTransfer links, no expiry stress',
  'landing.features.galleriesText':
    'Deliver private, branded galleries your clients can view, favourite and download — the link stays yours, and it stays alive as long as you say.',
  // Sample data for the previews. These live in the dictionaries rather than in
  // the page because a mock that says "Sat 12 Jul" under German copy is the
  // fastest way to tell a visitor the product was not built for them.
  'landing.features.galleryBarName': 'Lena & Kaan — Wedding',
  'landing.features.galleryBarMeta': '248 photos · 12 favourited',
  'landing.features.downloadAll': 'Download all',
  'landing.features.bookingsTitle': 'No more back-and-forth on dates',
  'landing.features.bookingsText':
    'Clients pick a slot straight from your portfolio page and it lands in your calendar — no email thread, no double booking.',
  'landing.features.booked': 'Booked',
  'landing.features.open': 'Open',
  'landing.features.slotBooked': 'Sat 12 Jul · 14:00',
  'landing.features.slotOpen': 'Sun 13 Jul · 10:00',
  'landing.features.slotOpenLate': 'Sun 13 Jul · 16:00',
  'landing.features.contractsTitle': 'Contracts & e-sign',
  'landing.features.contractsText':
    'Send shoot agreements and collect legally binding signatures — no email back-and-forth.',
  'landing.features.stripeTitle': 'Stripe payments',
  'landing.features.stripeText':
    'Take deposits and final payments online with automatic reconciliation.',
  // This card had no preview while payments were unbuilt — mocking a "Paid" row
  // for a feature that could not take a cent is the one thing a roadmap card
  // must not do. Card and SEPA shipped on Connect Express on 2026-08-18, so the
  // preview now shows the states the product actually produces.
  'landing.features.payDeposit': 'Deposit · {amount}',
  'landing.features.payBalance': 'Balance · {amount}',
  'landing.features.payMethods': 'Card · SEPA',
  'landing.features.paid': 'Paid',
  'landing.features.payEnabled': 'Enabled',
  'landing.features.leadTitle': 'No enquiry slips through',
  'landing.features.leadText':
    'Every request is captured and scored the moment it arrives, so the ones worth answering today are at the top.',
  'landing.features.leadHot': '92 · Hot',
  'landing.features.leadWarm': '61 · Warm',
  'landing.features.leadCold': '34 · Cold',
  'landing.features.leadHotName': 'Sarah M. · Wedding',
  'landing.features.leadWarmName': 'Tom K. · Portrait',
  'landing.features.leadColdName': 'Jonas B. · Family',
  'landing.features.germanTitle': 'Built for the German market',
  'landing.features.germanText':
    'Bilingual DE / EN, DSGVO-aware by default, GoBD-konforme Rechnungen and Kleinunternehmer support.',

  'landing.workflow.eyebrow': 'One connected pipeline',
  'landing.workflow.title': 'Every shoot, from enquiry to paid.',
  'landing.workflow.sub':
    'Fotolio moves each booking through the same clean flow — so you always know exactly what’s next.',
  'landing.pipeline.enquiryTitle': 'Enquiry',
  'landing.pipeline.enquiryText': 'A lead lands from your portfolio and gets scored automatically.',
  'landing.pipeline.bookingTitle': 'Booking',
  'landing.pipeline.bookingText': 'The client picks a slot; it syncs straight to your calendar.',
  'landing.pipeline.contractTitle': 'Contract',
  'landing.pipeline.contractText':
    'The shoot agreement is sent and e-signed in minutes — legally binding.',
  'landing.pipeline.paymentTitle': 'Payment',
  'landing.pipeline.paymentText':
    'Deposit and balance are collected via Stripe, reconciled for you.',
  'landing.pipeline.galleryTitle': 'Gallery',
  'landing.pipeline.galleryText':
    'Final images land in a private, branded gallery to view and download.',

  'landing.audience.eyebrow': 'Your studio',
  'landing.audience.title': 'The whole business — not just the shoot.',
  'landing.audience.sub':
    'The portfolio, the enquiries, the galleries and the client data — one workspace, all of it yours.',
  // Hands off to the pricing table directly below. This section used to carry
  // a second copy of the hero's "start your trial" button instead.
  'landing.audience.seePricing': 'See plans and pricing',
  // Outcome + the detail that makes it concrete. The detail is the point: a
  // second list of feature names is what made this section skippable.
  'landing.studio.portfolioTitle': 'Portfolio with a booking page',
  'landing.studio.portfolioText': 'Your own subdomain, your own look',
  'landing.studio.leadsTitle': 'Enquiries scored and sorted',
  'landing.studio.leadsText': 'What is worth answering sits at the top',
  'landing.studio.galleriesTitle': 'Private client galleries',
  'landing.studio.galleriesText': 'A link you control — no WeTransfer',
  'landing.studio.dataTitle': 'Client data kept DSGVO-konform',
  'landing.studio.dataText': 'Retention limits and deletion built in',
  'landing.audience.clientTitle': 'And this is what your clients get',
  'landing.clientExp.book': 'Book a slot in two clicks',
  'landing.clientExp.gallery': 'View and download the gallery',
  'landing.clientExp.link': 'One link, no account needed',

  'landing.pricing.eyebrow': 'Pricing',
  'landing.pricing.title': 'Simple, transparent pricing.',
  'landing.pricing.sub': 'Start free for 14 days. No credit card, cancel anytime.',
  'landing.pricing.monthly': 'Monthly',
  'landing.pricing.yearly': 'Yearly',
  'landing.pricing.save': '−2 months',
  'landing.pricing.perMonth': '/mo',
  'landing.pricing.billedYearly': 'Billed yearly',
  'landing.pricing.billedMonthly': 'Billed monthly',
  'landing.pricing.mostPopular': 'Most popular',
  // Sits with the prices, not in the footnote: German price-indication law
  // (PAngV) wants the VAT statement next to the figure it qualifies, and a
  // page with no statement at all implicitly claims the €19 is what you pay.
  // Fotolio sells to businesses, so the listed prices are net.
  'landing.pricing.vatNote': 'Prices exclude VAT.',
  'landing.pricing.feeNote':
    '* 2% of what you collect through Fotolio, on top of Stripe’s own fee. Pro and Studio pay nothing.',
  'landing.pricing.getStarted': 'Get started',
  'landing.price.f.portfolioWebsite': 'Your own booking website',
  'landing.price.f.leadMgmt': 'Enquiry inbox & scoring',
  'landing.price.f.onlineBookings': 'Online booking & calendar',
  'landing.price.f.retention60': 'Galleries online 60 days',
  'landing.price.f.retention1y': 'Galleries online 1 year',
  'landing.price.f.retention2y': 'Galleries online 2 years',
  'landing.price.f.everythingStarter': 'Everything in Starter',
  'landing.price.f.stripeDeposits': 'Card & SEPA payments (2%)',
  'landing.price.f.zeroCommission': 'No transaction fee',
  'landing.price.f.instagramDm': 'Auto-reply to Instagram DMs',
  'landing.price.f.contractsEsign': 'Contracts with e-signature',
  'landing.price.f.crm': 'Client history & notes',
  'landing.price.f.everythingPro': 'Everything in Pro',
  'landing.price.f.upTo3': 'Up to 3 photographers',
  'landing.price.f.analytics': 'Revenue & booking reports',
  'landing.price.f.whiteLabel': 'Your own domain & branding',

  // Split the way the hero's headline is, so the closing line carries the same
  // shimmering accent word — the two display lines bookend the page.
  'landing.cta.titlePre': 'Spend your day behind the ',
  'landing.cta.titleAccent': 'camera',
  'landing.cta.text':
    'Let Fotolio handle the leads, contracts and payments while you do the part only you can.',
  'landing.cta.button': 'Start 14-day free trial',
  'landing.cta.micro': 'No credit card required · DSGVO-konform',

  'landing.footer.brandText':
    'The all-in-one platform for photographers in Germany. Bookings, clients and galleries in one connected studio.',
  'landing.footer.product': 'Product',
  'landing.footer.account': 'Account',
  'landing.footer.legal': 'Legal',
  'landing.footer.rights': '© {year} Fotolio. All rights reserved.',
  'landing.footer.made': 'Made in Germany · DSGVO-konform',
} as const;

export type EnLanding = typeof landing;
