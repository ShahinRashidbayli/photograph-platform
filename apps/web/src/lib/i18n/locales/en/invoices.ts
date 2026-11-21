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
  // ── Photographer: invoices on a booking ───────────────────────────────────
  // Addressed to the photographer ("Sie" in German), unlike the client-facing
  // strings above. Issuing is irreversible (GoBD), and the copy says so.
  'invoices.manage.new': 'New invoice',
  'invoices.manage.loadError': "Couldn't load the invoices for this booking.",
  'invoices.manage.retry': 'Retry',
  'invoices.manage.empty':
    'Nothing invoiced yet. An invoice is what starts the payment side — your client can pay it by card, SEPA or bank transfer.',
  'invoices.manage.status.paid': 'Paid',
  'invoices.manage.status.open': 'Open',
  'invoices.manage.status.overdue': 'Overdue',
  'invoices.manage.status.storno': 'Storno',
  'invoices.manage.status.cancelled': 'Cancelled',
  'invoices.manage.paidOf': '{paid} of {total} paid',
  'invoices.manage.dueOn': 'Due {date}',
  'invoices.manage.reference': 'Reference {reference}',
  'invoices.manage.actionsFor': 'Actions for invoice {number}',
  'invoices.manage.recordTransfer': 'Record bank transfer',
  'invoices.manage.storno': 'Storno',
  'invoices.manage.recordTitle': 'Record a bank transfer?',
  'invoices.manage.recordBody':
    'Marks {amount} as received on invoice {number}. Only do this once the money is actually in your account — your client sees it as paid immediately.',
  'invoices.manage.recordConfirm': 'Mark as received',
  'invoices.manage.recordError': 'Could not record the payment.',
  'invoices.manage.stornoTitle': 'Storno invoice {number}?',
  'invoices.manage.stornoBody':
    'This issues a separate correction invoice that cancels this one out. Neither document can be deleted afterwards — that is what GoBD requires — so both stay in your records and in the DATEV export.',
  'invoices.manage.stornoConfirm': 'Issue Storno',
  'invoices.manage.stornoError': 'Could not issue the Storno.',
  'invoices.create.title': 'Issue an invoice',
  'invoices.create.profileIncomplete':
    'Your business details are incomplete, so the invoice would be rejected. Fill them in under Settings → Business details first — §14 UStG needs your name, address and either your Steuernummer or USt-IdNr.',
  'invoices.create.intro':
    'For {name}. Once issued, the invoice cannot be edited or deleted — only corrected with a Storno.',
  'invoices.create.lineItems': 'Line items',
  'invoices.create.description': 'Description',
  'invoices.create.descriptionPlaceholder': 'Wedding coverage',
  'invoices.create.defaultLine': 'Photo shoot',
  'invoices.create.quantity': 'Qty',
  'invoices.create.unitPrice': 'Unit price €',
  'invoices.create.tax': 'Tax',
  'invoices.create.tax.STANDARD': '19% VAT',
  'invoices.create.tax.REDUCED': '7% VAT',
  'invoices.create.tax.EXEMPT': '0% / exempt',
  'invoices.create.removeLine': 'Remove line',
  'invoices.create.addLine': 'Add line',
  'invoices.create.net': 'Net',
  'invoices.create.vat': 'VAT',
  'invoices.create.clientPays': 'Client pays',
  'invoices.create.smallBusiness': 'No VAT — you are registered as Kleinunternehmer (§19 UStG).',
  'invoices.create.agreedTotal': 'The agreed booking total is {amount}.',
  'invoices.create.address': 'Client address (optional)',
  'invoices.create.street': 'Street and number',
  'invoices.create.postalCode': 'Postal code',
  'invoices.create.city': 'City',
  'invoices.create.country': 'Country code',
  'invoices.create.paymentTerms': 'Payment terms',
  'invoices.create.errNoLines': 'Add at least one line with a description.',
  'invoices.create.errQuantity': 'Every line needs a quantity greater than zero.',
  'invoices.create.errIssue': 'Could not issue the invoice.',
  'invoices.create.submit': 'Issue invoice',
  'invoices.create.submitting': 'Issuing…',
} as const;

export type EnInvoices = typeof invoices;
