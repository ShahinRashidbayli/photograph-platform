/**
 * The client's payments screen. Client-facing, so these strings matter more
 * than the photographer-facing surfaces: the people reading them are German
 * consumers who never chose this product — their photographer did.
 */
export const payments = {
  'payments.title': 'Payments',
  'payments.loading': 'Loading your payments…',
  'payments.summary.empty': 'Your deposits and balances appear here once you book a session.',
  'payments.summary.line': '{paid} paid of {total} · {remaining} remaining across {count} sessions',
  'payments.summary.lineSingle': '{paid} paid of {total} · {remaining} remaining across 1 session',
  'payments.loadError': "We couldn't load your payments right now. Please refresh in a moment.",

  'payments.due.inDays_one': 'Due in {count} day',
  'payments.due.inDays_other': 'Due in {count} days',
  'payments.due.now': 'Balance due',
  'payments.due.remainingBalance': '{title} · remaining balance',
  'payments.due.beforeSession': 'Before your session on {date}',
  'payments.due.settleBelow':
    'Settle it under Invoices below — by card, SEPA Direct Debit or bank transfer.',

  'payments.settled.badge': 'All settled',
  'payments.settled.title': "You're all paid up",
  'payments.settled.body': 'No outstanding balances. Your payment history is below.',

  'payments.history.title': 'Payment history',
  'payments.history.session': 'Session',
  'payments.history.amount': 'Amount',
  'payments.history.status': 'Status',
  'payments.history.partial': '{paid} paid, {remaining} due',
  'payments.history.paidToDate': 'Paid to date',

  'payments.schedule.title': 'Payment schedule',
  'payments.schedule.deposit': 'Deposit',
  'payments.schedule.remaining': 'Remaining',
  'payments.schedule.paid': 'Paid',
  'payments.schedule.pending': 'Pending',
  'payments.schedule.by': 'Before {date}',
  'payments.schedule.total': '{title} total',
  'payments.schedule.none': 'No scheduled payments — you have no outstanding balance.',

  'payments.invoices.title': 'Invoices',

  'payments.how.title': 'How payment works',
  'payments.how.body':
    'Your photographer issues an invoice; you can pay it here by card or SEPA Direct Debit, or by bank transfer using the reference shown on it. Payments go directly to your photographer — Stripe handles the card details, and they never reach this site.',

  'payments.questions.title': 'Questions about a charge?',
  'payments.questions.body':
    'Message your photographer directly — refunds and reschedules follow the terms you agreed when booking.',
  'payments.questions.message': 'Message photographer',
  'payments.questions.messagingSoon': 'Messaging coming soon',

  'payments.empty.title': 'No payments yet',
  'payments.empty.body':
    "When you book a session, your deposit and balance will appear here — along with everything you've paid.",
  'payments.empty.cta': 'View your bookings',

  'payments.state.paid': 'Paid',
  'payments.state.partial': 'Deposit paid',
  'payments.state.due': 'Due',
  'payments.state.quote': 'Quote',
  'payments.sessionFallback': 'Session',
} as const;

export type EnPayments = typeof payments;
