/**
 * Erasing a person's data from the studio (Art. 17 GDPR) — Settings → Privacy.
 *
 * Written for a photographer answering a client's request, not for a lawyer:
 * every line says what happens to which records, and anything that survives
 * says why, because "we kept some of it" is not an answer they can pass on.
 */
export const privacy = {
  'privacy.title': "Erase a person's data",
  'privacy.description':
    'When a client asks you to delete their data, enter their email address. You will see exactly what would be erased, and what the law requires you to keep, before anything happens.',
  'privacy.emailLabel': "The person's email address",
  'privacy.emailPlaceholder': 'name@example.com',
  'privacy.preview': 'Show what would be erased',
  'privacy.previewing': 'Checking…',
  'privacy.previewHeading': 'If you erase {email}',
  'privacy.doneHeading': 'Erased {email}',
  'privacy.nothingFound': 'Your studio holds nothing under this address.',
  'privacy.erase': 'Erase permanently',
  'privacy.erasing': 'Erasing…',
  'privacy.another': 'Erase someone else',
  'privacy.confirmTitle': 'Erase this person for good?',
  'privacy.confirmMessage':
    'Deleted records and photos cannot be restored. Anonymised bookings stay in your books without their name, address or notes.',
  'privacy.confirmPhotos_one': '{count} delivered photo will be deleted from storage.',
  'privacy.confirmPhotos_other': '{count} delivered photos will be deleted from storage.',
  'privacy.doneNote':
    'Let the person know it is done, and what was kept and why — the reasons are listed above.',
  'privacy.ownerOnly': 'Only the owner of the studio can erase data.',
  'privacy.previewError': 'Could not check this address. Please try again.',
  'privacy.eraseError': 'Nothing was erased — the request failed. Please try again.',

  'privacy.category.customerAccounts': 'Client portal account',
  'privacy.category.clients': 'Client directory',
  'privacy.category.leads': 'Leads',
  'privacy.category.inquiries': 'Inquiries',
  'privacy.category.bookings': 'Bookings',
  'privacy.category.galleries': 'Galleries',
  'privacy.category.galleryPhotos': 'Delivered photos',
  'privacy.category.contracts': 'Contracts',
  'privacy.category.invoices': 'Invoices',
  'privacy.category.auditEntries': 'Activity log',
  'privacy.category.queuedEmails': 'Unsent emails',

  'privacy.hint.bookings': 'Date, package, amounts and status stay for your books.',
  'privacy.hint.auditEntries': 'The address written into the log is removed; the entry stays.',

  'privacy.will.deleted_one': '{count} will be deleted',
  'privacy.will.deleted_other': '{count} will be deleted',
  'privacy.will.anonymized_one': '{count} will be anonymised',
  'privacy.will.anonymized_other': '{count} will be anonymised',
  'privacy.will.retained_one': '{count} will be kept',
  'privacy.will.retained_other': '{count} will be kept',
  'privacy.did.deleted_one': '{count} deleted',
  'privacy.did.deleted_other': '{count} deleted',
  'privacy.did.anonymized_one': '{count} anonymised',
  'privacy.did.anonymized_other': '{count} anonymised',
  'privacy.did.retained_one': '{count} kept',
  'privacy.did.retained_other': '{count} kept',

  'privacy.basis.TAX_RECORDS':
    'Kept because invoices must be retained for ten years (§147 AO, §14b UStG).',
  'privacy.basis.LEGAL_CLAIMS':
    'Kept because a signed contract is your proof of what was agreed (Art. 17(3)(e) GDPR).',
} as const;

export type EnPrivacy = typeof privacy;
