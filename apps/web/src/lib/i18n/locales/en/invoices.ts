/**
 * Invoicing and payment vocabulary shared by the client's booking detail, the
 * payments page and the invoice list component.
 *
 * Its own namespace rather than an appendix to `bookings`: these strings are
 * about documents and money, appear on more than one route, and are the
 * strings most likely to need a lawyer's eye in German — keeping them together
 * makes that review a single file.
 */
export const invoices = {
  'invoices.title': 'Invoices',
  'invoices.loading': 'Loading invoices…',
  'invoices.error': "We couldn't load your invoices right now.",
  'invoices.empty': 'No invoices yet.',
  'invoices.emptyForBooking':
    'Your photographer hasn’t sent an invoice for this session yet. The amount above is what you agreed — nothing is due until an invoice arrives.',
  'invoices.number': 'Invoice {number}',
  'invoices.outstanding': 'outstanding',
  'invoices.paid': 'Paid',
  'invoices.partiallyPaid': '{amount} paid',
  'invoices.pay': 'Pay {amount}',
  'invoices.downloadPdf': 'Download PDF',
  'invoices.bankTransferHint':
    'Prefer a bank transfer? Use the reference {reference} so your photographer can match it.',

  // ── Stripe payment dialog ─────────────────────────────────────────────────
  'invoices.payDialog.title': 'Pay {amount}',
  'invoices.payDialog.methodCard': 'Card',
  'invoices.payDialog.methodSepa': 'SEPA Direct Debit',
  'invoices.payDialog.preparing': 'Preparing a secure payment…',
  'invoices.payDialog.unavailable': 'Online payment is not available for this invoice right now.',
  'invoices.payDialog.startFailed': 'Could not start the payment. Please try again.',
  'invoices.payDialog.confirmFailed': 'The payment could not be completed.',
  'invoices.payDialog.processing': 'Processing…',
  'invoices.payDialog.succeededTitle': 'Payment received',
  'invoices.payDialog.succeededBody': 'Thank you — your photographer has been notified.',
  'invoices.payDialog.pendingTitle': 'Payment submitted',
  'invoices.payDialog.pendingBody':
    'Your bank is processing the debit. This page updates as soon as it clears.',
  'invoices.payDialog.done': 'Done',
  'invoices.payDialog.close': 'Close',
  'invoices.payDialog.methodGroup': 'Payment method',
  'invoices.payDialog.security':
    'Payments are processed by Stripe and go directly to your photographer. Card details never reach this site.',
} as const;

export type EnInvoices = typeof invoices;
