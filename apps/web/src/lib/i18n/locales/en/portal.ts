/**
 * The client portal: the overview a client lands on, a shoot's own page, their
 * galleries and their payments.
 *
 * English is the source of truth — these keys define the `Portal` half of
 * `TranslationKey`, and every other locale is compile-checked against it.
 */
export const portal = {
  // ── Overview ──────────────────────────────────────────────────────────────
  'portal.hello': 'Hello {name}',
  'portal.welcome': 'Welcome',
  'portal.subtitle': 'Everything about your shoots with {studio}, in one place.',
  'portal.subtitleNoStudio': 'Everything about your shoots, in one place.',
  'portal.request': 'Request a new shoot',
  'portal.loadError': 'Your shoots could not be loaded just now.',
  'portal.partialError': 'Some details could not be loaded, so this overview may be incomplete.',

  // ── What is waiting on the client ─────────────────────────────────────────
  'portal.todo.title': 'To do',
  'portal.todo.none': 'You’re all set — nothing is waiting on you right now.',
  'portal.todo.sign': 'Sign the contract',
  'portal.todo.signAction': 'Read & sign',
  'portal.todo.pay': 'Pay {amount}',
  'portal.todo.payAction': 'Pay',
  'portal.todo.photos': 'Your photos are ready',
  'portal.todo.photosAction': 'Open gallery',
  'portal.meta.dueBy': 'due by {date}',
  'portal.meta.photos_one': '{count} photo',
  'portal.meta.photos_other': '{count} photos',
  'portal.meta.until': 'available until {date}',

  // ── Shoots and where they stand ───────────────────────────────────────────
  'portal.shoots.title': 'Your shoots',
  'portal.shoots.none': 'No shoots yet. Request one and it appears here once confirmed.',
  'portal.step.aria': 'Progress',
  'portal.step.requested': 'Requested',
  'portal.step.confirmed': 'Confirmed',
  'portal.step.contract': 'Contract',
  'portal.step.contractOpen': 'Contract to sign',
  'portal.step.payment': 'Payment',
  'portal.step.paymentProgress': '{paid} of {total}',
  'portal.step.shoot': 'Shoot',
  'portal.step.photos': 'Photos',
  'portal.status.photosDelivered': 'Photos delivered',
  'portal.status.done': 'Completed',

  // ── Requests not yet answered ─────────────────────────────────────────────
  'portal.requests.title': 'Your requests',
  'portal.requests.pending': 'Waiting for a reply',
  'portal.requests.declined': 'Not possible',
  'portal.requests.wish': '{occasion} · preferred date',
  'portal.requests.sent': 'Sent {date}',

  // ── Who to ask ────────────────────────────────────────────────────────────
  'portal.contact.title': 'Questions? {name} is happy to help.',
  'portal.contact.titleNoName': 'Questions about your shoot?',
  'portal.contact.heading': 'Contact',
  'portal.contact.email': 'Write an email',

  // ── One shoot ─────────────────────────────────────────────────────────────
  'portal.detail.back': 'Overview',
  'portal.detail.notFound': 'This shoot isn’t here any more.',
  'portal.detail.cancelled': 'This shoot was cancelled.',
  'portal.detail.nextSteps': 'Your next steps',
  'portal.detail.contract': 'Contract',
  'portal.detail.contractSent': 'Sent {date}',
  'portal.detail.contractSigned': 'Signed {date}',
  'portal.detail.contractNote':
    'You sign electronically with your name. Afterwards the PDF is kept under Documents.',
  'portal.detail.contractView': 'View',
  'portal.detail.payTitle': 'Pay',
  'portal.detail.paidTitle': 'Paid',
  'portal.detail.dueBy': 'The open amount is due by {date}.',
  'portal.detail.invoiceIssued': 'issued {date}',
  'portal.detail.photos': 'Your photos',
  'portal.detail.photosPending':
    'After the shoot your gallery appears here as soon as the photos are ready.',
  'portal.detail.when': 'Appointment',
  'portal.detail.date': 'Date',
  'portal.detail.time': 'Time',
  'portal.detail.place': 'Place',
  'portal.detail.map': 'Open in maps',
  'portal.detail.addToCalendar': 'Add to calendar',

  // ── Galleries ─────────────────────────────────────────────────────────────
  'portal.galleries.title': 'Galleries',
  'portal.galleries.subtitle': 'Your photos, to view and download.',
  'portal.galleries.empty': 'No gallery yet. As soon as your photos are ready, they appear here.',
  'portal.galleries.error': 'Your galleries could not be loaded just now.',
  'portal.galleries.daysLeft_one': 'Available until {date} — {count} day left',
  'portal.galleries.daysLeft_other': 'Available until {date} — {count} days left',
  'portal.galleries.downloadAll': 'Download all',
  'portal.galleries.upcoming': 'The gallery appears here after the shoot.',

  // ── Payments ──────────────────────────────────────────────────────────────
  'portal.payments.title': 'Payments',
  'portal.payments.subtitle': 'All invoices from {studio} in one place.',
  'portal.payments.subtitleNoStudio': 'All your invoices in one place.',
  'portal.payments.nextDue': 'Next: {amount} due by {date}',
  'portal.payments.allPaid': 'Everything is paid — thank you.',
  'portal.payments.col.invoice': 'Invoice',
  'portal.payments.col.shoot': 'Shoot',
  'portal.payments.col.date': 'Issued',
  'portal.payments.col.amount': 'Amount',
  'portal.payments.col.status': 'Status',
  'portal.payments.col.actions': 'Actions',
  'portal.payments.pdfFor': 'Invoice {number} as PDF',
  'portal.payments.questions': 'Questions about an invoice?',
} as const;

export type EnPortal = typeof portal;
