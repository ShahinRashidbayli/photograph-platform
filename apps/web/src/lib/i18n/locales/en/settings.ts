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


  // Fotolio's own subscription. Kept verbally distinct from the Stripe Connect
  // ("payouts") strings above: those two are the easiest pair in the product to
  // confuse, and reading one as the other means either believing you can take
  // money when you cannot, or believing you are paying when you are not.
  'settings.subscription.title': 'Your Fotolio subscription',
  'settings.subscription.subtitle':
    'What you pay Fotolio. Separate from payouts above, which is how your clients pay you.',
  'settings.subscription.loading': 'Loading…',
  'settings.subscription.trial': 'Free trial',
  'settings.subscription.trialEndsOn': 'Your trial runs until {date}.',
  'settings.subscription.active': 'Active',
  'settings.subscription.renewsOn': 'Renews on {date}.',
  'settings.subscription.pastDue': 'Payment failed',
  'settings.subscription.pastDueDetail':
    'Your last payment did not go through. Your account keeps working while Stripe retries — update your card to avoid interruption.',
  'settings.subscription.locked': 'Read-only',
  'settings.subscription.lockedDetail':
    'Choose a plan to start creating bookings, galleries and invoices again. Everything you already have stays available.',
  'settings.subscription.manage': 'Manage billing',
  'settings.subscription.choose': 'Choose {plan}',
  'settings.subscription.currentPlan': '{plan} (current)',
  'settings.subscription.yearly': 'Pay yearly (2 months free)',
  'settings.subscription.switchTo': 'Switch to {plan}',
  'settings.subscription.devSwitchWarning':
    'This deployment has no Stripe billing configured, and is set to allow plan changes without payment. Nothing is charged and no subscription is created — this is a development setting.',
  'settings.subscription.unavailable':
    'Subscriptions are not enabled on this deployment yet. Your account keeps working; contact support to arrange billing.',
  'settings.subscription.loadError': 'Could not load your subscription.',
  'settings.subscription.checkoutError': 'Could not open the checkout. Please try again.',
  'settings.subscription.portalError': 'Could not open the billing portal. Please try again.',

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
  // ── Team / seats ──────────────────────────────────────────────────────────
  // Studio's "up to 3 photographers". Every photographer sees the section; the
  // controls appear only for the owner, decided by the server's `canManage`.
  'settings.branding.title': 'Your branding',
  'settings.branding.description':
    'Your logo and colour on the pages your clients see — the portfolio, the booking form and every gallery you deliver. Fotolio’s name comes off those pages too.',
  'settings.branding.loading': 'Loading your branding…',
  'settings.branding.loadError': 'Could not load your branding.',
  'settings.branding.saveError': 'Could not save your branding.',
  'settings.branding.uploadError': 'Could not upload that logo.',
  'settings.branding.logo': 'Logo',
  'settings.branding.noLogo': 'No logo',
  'settings.branding.uploadLogo': 'Upload logo',
  'settings.branding.replaceLogo': 'Replace',
  'settings.branding.removeLogo': 'Remove',
  'settings.branding.color': 'Brand colour',
  'settings.branding.colorHint': 'Used for buttons and highlights on your client-facing pages.',
  'settings.branding.save': 'Save',
  'settings.branding.saved': 'Branding saved.',
  'settings.branding.upgradeTitle': 'Put your own name on it',
  'settings.branding.upgradeBody':
    'With white-label branding your logo and colour appear on your portfolio, booking form and client galleries, and Fotolio’s name comes off them. It is included in the Studio plan.',
  'settings.resources.title': 'Rooms & equipment',
  'settings.resources.description':
    'The things a shoot needs besides you — a studio room, a lighting kit, a second body. Once they are listed, a booking can say which ones it uses, and you get warned when two shoots want the same one on the same day.',
  'settings.resources.loading': 'Loading…',
  'settings.resources.loadError': 'Could not load your rooms and equipment.',
  'settings.resources.addError': 'Could not add that.',
  'settings.resources.saveError': 'Could not save that change.',
  'settings.resources.rooms': 'Rooms',
  'settings.resources.equipment': 'Equipment',
  'settings.resources.kind': 'Type',
  'settings.resources.add': 'Add',
  'settings.resources.addLabel': 'Add a room or a piece of kit',
  'settings.resources.addPlaceholder': 'Studio A, Profoto B10…',
  'settings.resources.retire': 'Retire',
  'settings.resources.restore': 'Bring back',
  'settings.resources.emptyTitle': 'Nothing listed yet',
  'settings.resources.emptyBody':
    'Add the rooms and kit you book out. Retired items stay here — they still explain what shot your past work.',
  'settings.team.title': 'Team',
  'settings.team.description':
    'The photographers who work in this studio. Everyone here sees the same bookings, clients and galleries — only you can invite, remove, and change what the studio pays for.',
  'settings.team.loading': 'Loading your team…',
  'settings.team.loadError': 'Could not load your team.',
  'settings.team.seatsUsed': '{used} of {total} seats used',
  'settings.team.seatsFull': 'Full',
  'settings.team.seatsFullHelp':
    'Every seat on your plan is taken. Remove someone, withdraw a pending invitation, or move to a plan with more seats.',
  'settings.team.roleOwner': 'Owner',
  'settings.team.roleMember': 'Photographer',
  'settings.team.invite': 'Send invitation',
  'settings.team.inviteLabel': 'Invite a photographer',
  'settings.team.invitePlaceholder': 'name@studio.de',
  'settings.team.inviteSent': 'Invitation sent to {email}.',
  'settings.team.inviteError': 'Could not send that invitation.',
  'settings.team.invitedExpires': 'Invitation expires {date}',
  'settings.team.revoke': 'Withdraw',
  'settings.team.revokeError': 'Could not withdraw that invitation.',
  'settings.team.remove': 'Remove',
  'settings.team.removeTitle': 'Remove from studio?',
  'settings.team.removeBody':
    '{name} loses access to this studio immediately. Their bookings, clients and galleries stay — they belong to the studio, not to the account.',
  'settings.team.removeError': 'Could not remove that person.',
  'settings.team.emptyTitle': 'It is just you so far',
  'settings.team.emptyBody': 'Invite a photographer and they get their own login into this studio.',
  'settings.team.upgradeTitle': 'Work with other photographers',
  'settings.team.upgradeBody':
    'Your plan includes one seat. On a plan with more, you can invite photographers into this studio — they get their own login and see the same bookings, clients and galleries.',
  'settings.team.overLimit':
    'Your plan includes {seats} seat, and this studio has more people than that. Remove someone or withdraw a pending invitation to get back under the limit — nobody loses their work, and bookings stay with the studio.',
  'settings.team.leave': 'Leave this studio',
  'settings.team.leaveHelp':
    'Leaving removes your login from this studio. The bookings, clients and galleries you worked on stay — they belong to the studio. Your email becomes free again, so you can open a studio of your own with it.',
  'settings.team.leaveTitle': 'Leave this studio?',
  'settings.team.leaveBody':
    'You will be signed out and lose access immediately. This cannot be undone from here — the owner would have to invite you again.',
  'settings.team.leaveError': 'Could not leave the studio.',
  'settings.team.makeOwner': 'Make owner',
  'settings.team.handoverTitle': 'Hand the studio over?',
  'settings.team.handoverBody':
    '{name} becomes the owner and you become an ordinary photographer here. They take over billing, the plan, and who is in the studio — including the ability to remove you. Only they can hand it back.',
  'settings.team.handoverError': 'Could not hand the studio over.',
  'settings.team.pastInvites': 'Earlier invitations',
  'settings.team.statusPending': 'Pending',
  'settings.team.statusAccepted': 'Accepted',
  'settings.team.statusRevoked': 'Withdrawn',
  'settings.team.statusExpired': 'Expired',

  // Legal details. The statutory names stay German in both locales for the
  // same reason the tax vocabulary above does: Impressum, USt-IdNr. and
  // Handelsregister are what the law calls these things, and an English
  // photographer filling in a German Impressum is looking for the German word.
  'settings.legal.title': 'Legal details',
  'settings.legal.intro':
    'These details appear in the Impressum and privacy notice on your public page. You are legally required to publish them (§5 DDG, Art. 13 GDPR) — Fotolio’s own Impressum does not cover your page.',
  'settings.legal.loadError': 'Could not load your legal details.',
  'settings.legal.saveError': 'Could not save. Please try again.',
  'settings.legal.save': 'Save',
  'settings.legal.saving': 'Saving…',
  'settings.legal.saved': 'Saved ✓',
  'settings.legal.completeTitle': 'Required details complete.',
  'settings.legal.completeBody': 'Your public page shows a valid Impressum.',
  'settings.legal.view': 'View →',
  'settings.legal.incompleteTitle_one': '{count} required detail still missing.',
  'settings.legal.incompleteTitle_other': '{count} required details still missing.',
  'settings.legal.incompleteBody':
    'Until then your public page says openly that the Impressum and privacy notice are not published — but your request form keeps accepting enquiries. It is collecting personal data without the disclosures Art. 13 GDPR requires. The risk of a warning letter is yours, not Fotolio’s.',
  'settings.legal.fieldName': 'Provider / name',
  'settings.legal.fieldStreet': 'Street and number',
  'settings.legal.fieldPostalCode': 'Postcode',
  'settings.legal.fieldCity': 'City',
  'settings.legal.fieldCountry': 'Country',
  'settings.legal.fieldEmail': 'Email',
  'settings.legal.fieldPhone': 'Phone',
  'settings.legal.fieldVatId': 'USt-IdNr.',
  'settings.legal.hintVatId':
    'Only if you are VAT registered (§27a UStG). Kleinunternehmer under §19 UStG leave this blank.',
  'settings.legal.fieldRegister': 'Handelsregister',
  'settings.legal.hintRegister':
    'Only if registered, e.g. “Amtsgericht Berlin, HRB 12345”.',
  'settings.legal.fieldResponsible': 'Responsible party (§18 Abs. 2 MStV)',
  'settings.legal.hintResponsible': 'Leave blank if the same as the provider.',
  'settings.legal.fieldPrivacyContact': 'Data protection contact',
  'settings.legal.hintPrivacyContact': 'Leave blank if the same as the email above.',

  'settings.tab.aria': 'Settings sections',
  'settings.tab.account': 'Account',
  'settings.tab.studio': 'Studio',
  'settings.tab.business': 'Business & legal',
  'settings.tab.payments': 'Payments',
  'settings.tab.plan': 'Plan',
  'settings.tab.team': 'Team',
  'settings.business.overlapNote':
    'Both forms below ask for your business name and address — one for your invoices (§14 UStG), one for your Impressum (§5 DDG). They are stored separately, so keep them in agreement.',
  'settings.business.footnote':
    'Invoices use the details in the first form; your public Impressum and privacy notice use the second.',

  'settings.subscription.yourPlan': 'Your plan',
  'settings.subscription.perMonth': '/ month',
} as const;

export type EnSettings = typeof settings;
