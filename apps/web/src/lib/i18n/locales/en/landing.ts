/**
 * Public marketing page.
 *
 * English is the source of truth — these keys define the `Landing` half of
 * `TranslationKey`, and every other locale is compile-checked against it.
 *
 * Every product claim here is something the product does today. The sample
 * data in the previews (names, dates, amounts) is illustrative; amounts and
 * dates are interpolated and formatted per locale by the page, never typed in.
 */
export const landing = {
  // ── Chrome ───────────────────────────────────────────────────────────────
  'landing.aria.skip': 'Skip to content',
  'landing.aria.home': 'Fotolio home',
  'landing.aria.sections': 'Sections',
  'landing.aria.openMenu': 'Open menu',
  'landing.aria.closeMenu': 'Close menu',
  'landing.aria.billingPeriod': 'Billing period',
  'landing.nav.product': 'Product',
  'landing.nav.galleries': 'Galleries',
  'landing.nav.workflow': 'Workflow',
  'landing.nav.pricing': 'Pricing',
  'landing.nav.faq': 'FAQ',
  'landing.nav.signIn': 'Sign in',
  'landing.nav.getStarted': 'Start free trial',
  // The footer link goes to /customer/auth/login — a client signing in, not a
  // photographer directory, which does not exist.
  'landing.nav.clientSignIn': 'Client sign-in',

  // ── Hero ─────────────────────────────────────────────────────────────────
  'landing.hero.title1': 'Run the business.',
  'landing.hero.title2pre': 'Keep the ',
  'landing.hero.title2accent': 'craft',
  'landing.hero.lede':
    'Fotolio takes every shoot from the first enquiry to the delivered gallery — so you stay behind the camera.',
  'landing.hero.ctaPrimary': 'Start 14-day free trial',
  'landing.hero.ctaSecondary': 'See the product',
  'landing.hero.artAria':
    'Studio Berg’s booking page with a wedding enquiry filled in, and a card showing what became of it',
  'landing.hero.stepEnquiry': 'Enquiry received',
  'landing.hero.stepContract': 'Contract signed',
  'landing.hero.stepDeposit': 'Deposit',
  'landing.hero.depositReceived': 'received',
  'landing.hero.stepGallery': 'Gallery delivered',
  // The studio's booking page in the hero. Its labels are the real form's
  // `request.*` keys (leads.ts); only the sample content lives here.
  'landing.book.tagline': 'Wedding & family photography',
  'landing.book.messageValue':
    'Registry office in the morning, then a garden party with about 60 guests.',

  // ── Sample data shared by the previews ───────────────────────────────────
  'landing.mock.nav.leads': 'Leads',
  'landing.mock.nav.contracts': 'Contracts',
  'landing.mock.type.wedding': 'Wedding',
  'landing.mock.type.portrait': 'Portrait',
  'landing.mock.type.business': 'Business',
  'landing.mock.type.family': 'Family',
  'landing.mock.photos': '{count} photos',

  // ── Formats band ─────────────────────────────────────────────────────────
  'landing.formats.title': 'One studio for every kind of shoot.',
  'landing.formats.wedding': 'Wedding',
  'landing.formats.portrait': 'Portrait',
  'landing.formats.family': 'Family',
  'landing.formats.newborn': 'Newborn',
  'landing.formats.business': 'Business',
  'landing.formats.couples': 'Couples',
  'landing.formats.event': 'Event',
  'landing.formats.reportage': 'Reportage',
  'landing.facts.trialValue': '14 days',
  'landing.facts.trial': 'free trial, no credit card',
  'landing.facts.feeValue': '0 %',
  'landing.facts.fee': 'transaction fee from the Pro plan',
  'landing.facts.retentionValue': '2 years',
  'landing.facts.retention': 'galleries stay online on the Studio plan',
  'landing.facts.invoicesValue': 'GoBD',
  'landing.facts.invoices': 'compliant invoices, also under §\u00a019 UStG',

  // ── Product tabs ─────────────────────────────────────────────────────────
  'landing.product.title': 'Everything about a shoot, on one page.',
  'landing.product.lede':
    'Date, contract, payment and gallery sit together — not across five tabs and three inboxes.',
  'landing.product.tabsAria': 'Features',
  'landing.product.leadsTitle': 'Enquiries, scored',
  'landing.product.leadsText':
    'Every enquiry gets a score the moment it arrives. The ones worth answering today are at the top.',
  'landing.product.contractsTitle': 'Contracts, signed online',
  'landing.product.contractsText':
    'Created from the booking, sent, and signed online by your client.',
  'landing.product.paymentsTitle': 'Payments through Stripe',
  'landing.product.paymentsText': 'Deposit and balance by card or SEPA, reconciled for you.',
  'landing.product.invoicesTitle': 'Invoices to GoBD',
  'landing.product.invoicesText': 'Numbered in sequence, straight from the booking.',
  'landing.product.colName': 'Name',
  'landing.product.colClient': 'Client',
  'landing.product.colOccasion': 'Occasion',
  'landing.product.colDate': 'Date',
  'landing.product.colBudget': 'Budget',
  'landing.product.colScore': 'Score',
  'landing.product.colContract': 'Contract',
  'landing.product.colType': 'Type',
  'landing.product.colAmount': 'Amount',
  'landing.product.colStatus': 'Status',
  'landing.product.colNumber': 'No.',
  'landing.product.filterActive': 'Active {count}',
  'landing.product.filterBooked': 'Booked {count}',
  'landing.product.filterAll': 'All {count}',
  'landing.product.filterOpen': 'Open {count}',
  'landing.product.filterSigned': 'Signed {count}',
  'landing.product.dateOpen': 'open',
  'landing.product.budgetUpTo': 'up to {amount}',
  'landing.product.convert': 'Convert to booking',
  'landing.product.reply': 'Reply',
  'landing.product.contractWedding': 'Wedding coverage',
  'landing.product.contractPortrait': 'Portrait session',
  'landing.product.contractNewborn': 'Newborn session',
  'landing.product.contractCouple': 'Couple session',
  'landing.product.statusSigned': 'Signed',
  'landing.product.statusSent': 'Sent',
  'landing.product.statusDraft': 'Draft',
  'landing.product.sendForSignature': 'Send for signature',
  'landing.product.pdf': 'PDF',
  'landing.product.paymentsSummary': '{amount} received in July',
  'landing.product.payDepositSepa': 'Deposit · SEPA',
  'landing.product.payBalance': 'Balance',
  'landing.product.payFullCard': 'Full amount · card',
  'landing.product.payDepositCard': 'Deposit · card',
  'landing.product.statusReceived': 'Received',
  'landing.product.statusDue': 'Due {date}',
  'landing.product.statusOpen': 'Open',
  'landing.product.recordPayment': 'Record payment',
  'landing.product.statusPartlyPaid': 'Partly paid',
  'landing.product.statusPaid': 'Paid',
  'landing.product.newInvoice': 'New invoice',

  // ── Galleries ────────────────────────────────────────────────────────────
  'landing.gallery.title': 'Private galleries instead of WeTransfer links.',
  'landing.gallery.lede':
    'Your clients open their pictures through a link you control, and download them one by one or all at once.',
  'landing.gallery.aria': 'A client gallery as the client sees it',
  'landing.gallery.coverTitle': 'Lena\u00a0&\u00a0Kaan’s wedding',
  'landing.gallery.alt.rings': 'The two wedding rings in the bride’s hands',
  'landing.gallery.alt.brideBouquet': 'The bride with her bouquet in the garden',
  'landing.gallery.alt.dress': 'His hand on the back of her dress',
  'landing.gallery.alt.shoes': 'Her shoes, waiting on the armchair',
  'landing.gallery.alt.bouquet': 'Hand in hand beside the bouquet',
  'landing.gallery.alt.veil': 'Under the veil, in the doorway',
  'landing.gallery.alt.steps': 'Their shoes on the boardwalk',
  'landing.gallery.alt.forest': 'Walking away down the forest path',
  'landing.gallery.byline': 'Wedding and family photography Studio Berg',
  'landing.gallery.meta': '{count} photos · Online until {date}',
  'landing.gallery.downloadAll': 'Download all',
  'landing.gallery.linkTitle': 'One link, no account',
  'landing.gallery.linkText': 'Your clients open the gallery directly.',
  'landing.gallery.zipTitle': 'One by one or as a ZIP',
  'landing.gallery.zipText': 'Every picture on its own, or the whole set at once.',
  'landing.gallery.retentionTitle': 'Online as long as your plan says',
  'landing.gallery.retentionText': '60 days · 1 year · 2 years',

  // ── Workflow ─────────────────────────────────────────────────────────────
  'landing.flow.title': 'From enquiry to gallery, in five steps.',
  'landing.flow.enquiryTitle': 'Enquiry',
  'landing.flow.enquiryText': 'Arrives from your portfolio and gets scored.',
  'landing.flow.enquiryData': 'Score 92',
  'landing.flow.bookingTitle': 'Booking',
  'landing.flow.bookingText': 'The client picks a slot in your calendar.',
  // Labelled as the shoot: the steps run left to right, and a bare July date
  // before a May signature read as the timeline running backwards.
  'landing.flow.bookingData': 'shoot {date}',
  'landing.flow.contractTitle': 'Contract',
  'landing.flow.contractText': 'Sent and signed online.',
  'landing.flow.contractData': 'signed {date}',
  'landing.flow.paymentTitle': 'Payment',
  'landing.flow.paymentText': 'Deposit and balance by card or SEPA.',
  'landing.flow.paymentData': '{amount} received',
  'landing.flow.galleryTitle': 'Gallery',
  'landing.flow.galleryText': 'The pictures in a private gallery.',
  'landing.flow.galleryData': '{count} photos delivered',
  'landing.de.title': 'Built for the German market.',
  'landing.de.dsgvoTitle': 'DSGVO-konform',
  'landing.de.dsgvoText': 'Retention limits and deletion built in.',
  'landing.de.gobdTitle': 'GoBD-konforme Rechnungen',
  'landing.de.gobdText': 'Created straight from the booking.',
  'landing.de.smallBusinessTitle': 'Kleinunternehmer',
  'landing.de.smallBusinessText': 'Invoices under §\u00a019 UStG.',
  'landing.de.languagesTitle': 'German and English',
  'landing.de.languagesText': 'Switchable for you and your clients.',

  // ── Pricing ──────────────────────────────────────────────────────────────
  'landing.pricing.title': 'Simple pricing.',
  'landing.pricing.sub': '14 days free. No credit card, cancel any time.',
  'landing.pricing.monthly': 'Monthly',
  'landing.pricing.yearly': 'Yearly · 2 months free',
  'landing.pricing.perMonth': '/ month',
  'landing.pricing.billedYearly': 'Billed yearly',
  'landing.pricing.billedMonthly': 'Billed monthly',
  // Not "Most popular": with no customers yet that is a figure nobody can
  // show, which is exactly what the facts band refuses to print.
  'landing.pricing.recommended': 'Recommended',
  'landing.pricing.choose': 'Choose {plan}',
  // Sits with the prices, not in the footnote: German price-indication law
  // (PAngV) wants the VAT statement next to the figure it qualifies. Fotolio
  // sells to businesses, so the listed prices are net.
  'landing.pricing.vatNote': 'Prices exclude VAT.',
  'landing.pricing.feeNote':
    '* 2% of what you collect through Fotolio, on top of Stripe’s own fee. Pro and Studio pay nothing.',
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
  // "domain" was dropped when branding shipped: a custom domain needs DNS
  // verification and certificate issuance, which is infrastructure this does
  // not have. Selling the half that exists is the point of this table.
  'landing.price.f.whiteLabel': 'Your logo on client pages',

  // ── FAQ ──────────────────────────────────────────────────────────────────
  // Only answers the code backs: trial (BillingProperties.trialDays),
  // self-serve cancel (Stripe portal), link-only galleries, retention warning
  // + grace-period restore (GalleryRetentionService, GalleryService.extend),
  // § 19 UStG (TaxMode). Hosting location and the AVV wait for the operator.
  'landing.faq.title': 'Questions before you start.',
  'landing.faq.trialQ': 'Do I need a credit card for the trial?',
  'landing.faq.trialA':
    'No. You try Fotolio free for 14 days and decide afterwards whether, and on which plan, to continue.',
  'landing.faq.cancelQ': 'Can I cancel at any time?',
  'landing.faq.cancelA':
    'Yes. You cancel yourself under Settings → Billing, without having to write to anyone.',
  'landing.faq.accountQ': 'Do my clients need an account to see their gallery?',
  'landing.faq.accountA':
    'No. They get a private link, open the gallery in their browser and download pictures one by one or as a ZIP.',
  'landing.faq.expiryQ': 'What happens when a gallery expires?',
  'landing.faq.expiryA':
    'Your clients get an email reminder beforehand. After expiry the gallery goes offline but is not deleted straight away — you can still bring it back for a while.',
  'landing.faq.smallBusinessQ': 'Does it work for a Kleinunternehmer under §\u00a019 UStG?',
  'landing.faq.smallBusinessA':
    'Yes. Switch on the small-business rule in your settings; your invoices then show no VAT and carry the required notice.',

  // ── Closing + footer ─────────────────────────────────────────────────────
  'landing.close.title': 'Spend your day behind the camera.',
  'landing.close.text': '14 days free. No credit card, cancel any time.',
  'landing.close.cta': 'Start 14-day free trial',
  'landing.footer.brandText': 'Bookings, clients and galleries for photographers in Germany.',
  'landing.footer.product': 'Explore',
  'landing.footer.account': 'Account',
  'landing.footer.legal': 'Legal',
  'landing.footer.rights': '© {year} Fotolio',
} as const;

export type EnLanding = typeof landing;
