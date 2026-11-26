/**
 * Contracts and electronic signature.
 *
 * <p>Two audiences share this namespace: the photographer drafting and sending
 * (`contracts.*`), and the customer reading and signing (`contracts.sign.*`).
 * They are kept together because the same nouns have to mean the same thing on
 * both sides — a status the photographer reads as "Sent" and the customer reads
 * as something else would be two vocabularies for one document.
 *
 * <p>The legal terms of art stay German in both locales, as elsewhere in this
 * dictionary: the contracts are German-law documents and "einfache
 * elektronische Signatur" is the name of a specific legal instrument, not a
 * phrase to translate loosely.
 */
export const contracts = {
  'contracts.title': 'Contracts',
  'contracts.heading': 'Contract',
  'contracts.new': 'Draft contract',
  'contracts.none': 'No contract for this booking yet.',
  'contracts.loading': 'Loading contracts…',
  'contracts.loadError': 'Could not load contracts.',

  'contracts.status.DRAFT': 'Draft',
  'contracts.status.SENT': 'Awaiting signature',
  'contracts.status.SIGNED': 'Signed',
  'contracts.status.CANCELLED': 'Withdrawn',

  'contracts.action.edit': 'Edit',
  'contracts.action.send': 'Send to client',
  'contracts.action.resend': 'Send again',
  'contracts.action.cancel': 'Withdraw',
  'contracts.action.download': 'Download PDF',
  'contracts.action.save': 'Save',
  'contracts.action.saving': 'Saving…',
  'contracts.action.close': 'Close',

  'contracts.field.title': 'Title',
  'contracts.field.body': 'Contract text',

  'contracts.sentTo': 'Sent to {name}',
  'contracts.signedOn': 'Signed {date}',

  // Shown before the photographer sends. It is the one moment they can still
  // read the text as their client will, and the platform is not their lawyer.
  'contracts.disclaimer':
    'This draft is a starting point, not legal advice. Read it before sending — you are the party bound by it.',
  'contracts.sendConfirmTitle': 'Send this contract?',
  'contracts.sendConfirmBody':
    '{name} gets an email with a link to sign it. Once sent, the text is frozen and your client can sign it. You cannot edit it afterwards — you can only withdraw it and draft a new one.',
  'contracts.resendTitle': 'Send this contract again?',
  'contracts.resendBody':
    '{name} gets the email with the signing link once more. The contract itself does not change.',
  'contracts.sendError': 'Could not send the contract. Please try again.',
  'contracts.cancelConfirmTitle': 'Withdraw this contract?',
  'contracts.cancelConfirmBody':
    'Your client will no longer be able to sign it. The record is kept rather than deleted.',

  // Tamper evidence. Surfaced rather than kept in the database, because a
  // document that no longer matches its signature is exactly the thing the
  // person relying on it needs told.
  'contracts.tampered': 'Warning: this text no longer matches what was signed.',

  // ── the customer's side ───────────────────────────────────────────────────
  'contracts.sign.title': 'Documents',
  'contracts.sign.subtitle': 'Contracts your photographer has sent you.',
  'contracts.sign.emptyTitle': 'Nothing to sign',
  'contracts.sign.emptyBody':
    'When your photographer sends you a contract, it appears here for you to read and sign.',
  'contracts.sign.open': 'Read and sign',
  'contracts.sign.view': 'View',
  'contracts.sign.heading': 'Sign this contract',
  'contracts.sign.nameLabel': 'Type your full name to sign',
  'contracts.sign.namePlaceholder': 'Your full name',
  'contracts.sign.agree': 'I have read this contract and agree to be bound by it.',
  'contracts.sign.submit': 'Sign contract',
  'contracts.sign.submitting': 'Signing…',
  'contracts.sign.error': 'Could not sign this contract. Please try again.',
  'contracts.sign.done': 'Signed. A copy is available below.',
  'contracts.sign.legalNote':
    'Typing your name and confirming counts as an einfache elektronische Signatur (Art. 3 No. 10 eIDAS). Your name, the time and your IP address are recorded as evidence of the signature.',
  'contracts.sign.from': 'From {name}',
  'contracts.sign.withdrawn': 'Your photographer withdrew this contract. There is nothing to sign.',

  'contracts.pageSubtitle': 'Every contract in your studio. Start one from a booking.',
  'contracts.emptyTitle': 'No contracts yet',
  'contracts.emptyBody':
    'Contracts are drafted from a booking, so open the booking you want one for.',
  'contracts.goToBookings': 'Go to bookings',
  'contracts.filterAll': 'All',
  'contracts.openBooking': 'Open booking',
  'nav.contracts': 'Contracts',
} as const;

export type EnContracts = typeof contracts;
