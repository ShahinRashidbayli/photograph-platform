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

  'common.close': 'Close',
  'common.cancel': 'Cancel',
  'common.soon': 'Soon',
  'common.comingSoon': 'Coming soon',

  'common.tryAgain': 'Try again',
  'common.saving': 'Saving…',
  'common.confirm': 'Confirm',
  'common.working': 'Working…',

  'common.tryOtherFilter': 'Try a different filter or search term.',

  // ── Contact actions (leads + clients) ─────────────────────────────────────
  'contact.whatsapp': 'WhatsApp',
  'contact.whatsappTitle': 'Open WhatsApp chat',
  'contact.noPhone': 'No phone number on file',
  'contact.email': 'Email',
  'contact.emailTitle': 'Email {email}',
  'contact.noEmail': 'No email on file',
} as const;

export type EnCommon = typeof common;
