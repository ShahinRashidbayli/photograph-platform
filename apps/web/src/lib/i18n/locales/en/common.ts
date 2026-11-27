/**
 * Shared chrome, contact actions and generic UI verbs.
 *
 * English is the source of truth — these keys define the `Common` half of
 * `TranslationKey`, and every other locale is compile-checked against it.
 */
export const common = {
  // ── Common chrome ─────────────────────────────────────────────────────────
  'theme.switchToDark': 'Switch to dark theme',
  'theme.switchToLight': 'Switch to light theme',
  'auth.emailPlaceholder': 'you@example.com',
  'auth.showPassword': 'Show password',
  'auth.hidePassword': 'Hide password',

  // ── Waiting out a rate limit / lockout ────────────────────────────────────
  // Interpolated into the messages that report a 429, so a refusal says how
  // long to wait instead of leaving the user to guess and retry immediately.
  'auth.retrySeconds_one': '{count} second',
  'auth.retrySeconds_other': '{count} seconds',
  'auth.retryMinutes_one': '{count} minute',
  'auth.retryMinutes_other': '{count} minutes',

  'common.close': 'Close',
  'dateField.open': 'Choose date',
  'common.cancel': 'Cancel',
  'common.soon': 'Soon',
  'common.comingSoon': 'Coming soon',

  'common.tryAgain': 'Try again',
  'common.saving': 'Saving…',
  'common.confirm': 'Confirm',
  'common.working': 'Working…',

  // ── Personal note (send dialogs for Customer messages) ────────────────────
  'personalNote.label': 'Personal note (optional)',
  'personalNote.hint': 'Shown to your client as plain text in the email.',
  'personalNote.placeholder': 'A few words in your own voice…',
  'personalNote.counter': '{count} / {max}',
  'personalNote.sending': 'Sending…',

  'common.tryOtherFilter': 'Try a different filter or search term.',

  // ── Contact actions (leads + clients) ─────────────────────────────────────
  'contact.whatsapp': 'WhatsApp',
  'contact.whatsappTitle': 'Open WhatsApp chat',
  'contact.noPhone': 'No phone number on file',
  'contact.email': 'Email',
  'contact.emailTitle': 'Email {email}',

  // ── Plan gates ────────────────────────────────────────────────────────────
  // One vocabulary for "your plan does not include this", wherever it is said.
  'upgrade.cta': 'See plans',
  'upgrade.ctaNamed': 'Upgrade to {plan}',
  'upgrade.seePlans': 'See plans',
  'upgrade.notNow': 'Not now',
  'upgrade.dialogTitle': 'This needs a bigger plan',
  'upgrade.dialogBody': 'This feature is not included in your current plan.',
  'upgrade.dialogPlanLine': 'Available from {plan} upwards.',
  'upgrade.navLocked': 'Included from {plan}',
  'upgrade.contractsTitle': 'Contracts & e-sign',
  'upgrade.contractsBody':
    'Send a shoot agreement from this booking and collect a legally binding signature, without the email back-and-forth.',
} as const;

export type EnCommon = typeof common;
