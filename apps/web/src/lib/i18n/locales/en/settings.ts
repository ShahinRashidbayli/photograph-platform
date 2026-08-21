/**
 * Account, studio, packages and billing settings.
 *
 * <p>The billing half carries German tax vocabulary that must not be
 * translated loosely — Steuernummer, USt-IdNr., Kleinunternehmer and
 * Regelbesteuerung are statutory terms, so they stay identical in both
 * locales.
 */
export const settings = {
  'settings.title': 'Settings',
  'settings.subtitle.photographer': 'Manage your account, studio and billing preferences.',
  'settings.subtitle.client': 'Manage your account.',

  'settings.account.title.photographer': 'Account & Studio',
  'settings.account.title.client': 'Account',
  'settings.account.subtitle.photographer': 'Your personal information and studio details.',
  'settings.account.subtitle.client': 'Your personal information.',
  'settings.account.fullName': 'Full name',
  'settings.account.email': 'Email address',
  'settings.account.subdomain': 'Studio name / subdomain',
  'settings.account.publicAddress': 'Your public address:',
  'settings.account.changePhoto': 'Change photo',
  'settings.account.uploading': 'Uploading…',
  'settings.account.avatarTooLarge': 'File must be smaller than 5 MB.',
  'settings.account.storageUnavailable': 'Storage not configured. Please contact support.',
  'settings.account.uploadFailed': 'Upload to storage failed',
  'settings.account.avatarError': 'Could not upload photo. Please try again.',
  'settings.account.saveError': 'Could not save your changes. Please try again.',
  'settings.account.save': 'Save changes',
  'settings.account.saving': 'Saving…',
  'settings.account.saved': 'Saved ✓',

  'settings.plan.title': 'Plan & Billing',
  'settings.plan.subtitle': 'Your current subscription and payment settings.',
  'settings.plan.current': 'Current plan',
  'settings.plan.upgrade': 'Upgrade plan',
  'settings.plan.note':
    'This is your own subscription to the platform. Invoices you send to clients live on each booking; what you can charge them for is set under Online payments below.',

  'settings.danger.title': 'Danger zone',
  'settings.danger.subtitle': 'Irreversible actions. Please proceed with caution.',
  'settings.danger.deleteAccount': 'Delete account',

  // ── Packages ──────────────────────────────────────────────────────────
  'settings.packages.title': 'Packages',
  'settings.packages.subtitle':
    'Pricing packages your clients can be booked into. Choosing one on a booking auto-fills its price.',
  'settings.packages.loading': 'Loading packages…',
  'settings.packages.loadError': 'Could not load packages.',
  'settings.packages.empty': 'No packages yet',
  'settings.packages.emptyBody':
    'Add a pricing package to start using auto-pricing on bookings. Clients will see these on your public page.',
  'settings.packages.name': 'Package name *',
  'settings.packages.namePlaceholder': 'e.g. Standard Wedding',
  'settings.packages.price': 'Price (€) *',
  'settings.packages.pricePlaceholder': 'e.g. 1800',
  'settings.packages.duration': 'Duration (hours)',
  'settings.packages.durationPlaceholder': 'e.g. 8',
  'settings.packages.includedPhotos': 'Included photos',
  'settings.packages.includedPhotosPlaceholder': 'e.g. 300',
  'settings.packages.sortOrder': 'Sort order',
  'settings.packages.active': 'Active',
  'settings.packages.inactive': 'Inactive',
  'settings.packages.status': 'Status',
  'settings.packages.photos': 'Photos',
  'settings.packages.actions': 'Actions',
  'settings.packages.cancel': 'Cancel',
  'settings.packages.delete': 'Delete',
  'settings.packages.deleteConfirm': 'Delete this package?',
  'settings.packages.create': 'Create package',
  'settings.packages.save': 'Save changes',
  'settings.packages.submitting': 'Saving…',
  'settings.packages.nameRequired': 'Name is required.',
  'settings.packages.priceInvalid': 'Price must be a positive number of euros.',
  'settings.packages.saveError': 'Could not save the package.',
  'settings.packages.deleteError': 'Could not delete the package.',

  // ── Business details (§14 UStG) ───────────────────────────────────────
  'settings.billing.title': 'Business details',
  'settings.billing.subtitle':
    "Printed on every invoice you issue. German law (§14 UStG) requires all of it, so invoicing stays locked until it's filled in.",
  'settings.billing.incomplete': "Incomplete — you can't issue invoices yet.",
  'settings.billing.loading': 'Loading…',
  'settings.billing.loadFailed':
    "We couldn't load your current details, so the form is hidden — editing from blank values would overwrite them. Please reload the page.",
  'settings.billing.businessName': 'Business name',
  'settings.billing.street': 'Street and number',
  'settings.billing.addressLine2': 'Address line 2 (optional)',
  'settings.billing.postalCode': 'PLZ',
  'settings.billing.city': 'City',
  'settings.billing.country': 'Country',
  'settings.billing.taxId': 'Steuernummer',
  'settings.billing.vatId': 'USt-IdNr.',
  'settings.billing.taxIdHint': 'One of the two is enough — whichever your Finanzamt gave you.',
  'settings.billing.taxMode': 'Tax treatment',
  'settings.billing.taxModeKleinunternehmer': 'Kleinunternehmer (§19 UStG — no VAT)',
  'settings.billing.taxModeRegelbesteuerung': 'Regelbesteuerung (VAT charged)',
  'settings.billing.taxModeHint':
    'Decides whether your invoices show VAT. Changing it does not touch invoices you have already issued — those are fixed by law.',
  'settings.billing.save': 'Save business details',
  'settings.billing.saving': 'Saving…',
  'settings.billing.saved': 'Saved',
  'settings.billing.loadError': 'Could not load your business details.',
  'settings.billing.saveError': 'Could not save your business details.',

  // ── Stripe Connect ────────────────────────────────────────────────────
  'settings.stripe.title': 'Online payments',
  'settings.stripe.subtitle':
    'Clients pay your invoices by card or SEPA Direct Debit. The money goes straight to your own Stripe account — it never sits with us.',
  'settings.stripe.loading': 'Loading…',
  'settings.stripe.unavailable': 'Unavailable',
  'settings.stripe.unavailableDetail':
    'Online payments are not enabled on this deployment. Bank transfer still works.',
  'settings.stripe.ready': 'Ready',
  'settings.stripe.readyDetail':
    'You can accept card and SEPA payments, and Stripe pays out to your bank.',
  'settings.stripe.readyNoPayouts':
    'You can accept payments. Stripe is still verifying your bank details before paying out.',
  'settings.stripe.inReview': 'In review',
  'settings.stripe.inReviewDetail':
    'Stripe is reviewing your details. This usually takes a few minutes.',
  'settings.stripe.incomplete': 'Incomplete',
  'settings.stripe.incompleteDetail':
    'You started onboarding but did not finish it — Stripe still needs a few details.',
  'settings.stripe.notConnected': 'Not connected',
  'settings.stripe.notConnectedDetail':
    'Connect Stripe so clients can pay your invoices by card or SEPA Direct Debit.',
  'settings.stripe.commission':
    'On the {plan} plan we take {percent} of each payment collected here. Bank transfers you record yourself are free.',
  'settings.stripe.noCommission':
    'On the {plan} plan you keep 100% of every payment — no commission.',
  'settings.stripe.connect': 'Connect Stripe',
  'settings.stripe.finishSetup': 'Finish setup',
  'settings.stripe.manage': 'Manage on Stripe',
  'settings.stripe.opening': 'Opening Stripe…',
  'settings.stripe.refresh': 'Refresh status',
  'settings.stripe.statusError': 'Could not load your payout status.',
  'settings.stripe.onboardingError': 'Could not open Stripe onboarding.',
  'settings.datev.title': 'DATEV export',
  'settings.datev.description':
    'Hand your tax advisor a DATEV Buchungsstapel (EXTF) of every invoice you issued in a fiscal year. Cancelled invoices and their storno documents are both included, as GoBD requires.',
  'settings.datev.year': 'Fiscal year',
  'settings.datev.download': 'Download CSV',
  'settings.datev.accountsNotice':
    'The export uses SKR03 standard accounts (debtor 10000, revenue 8400 / 8337 for Kleinunternehmer). Have your tax advisor confirm these match your chart of accounts before importing — the structure is correct, but the account mapping is their call.',
} as const;

export type EnSettings = typeof settings;
