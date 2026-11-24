/**
 * Dashboard shell: sidebar nav, header, verification banners.
 *
 * English is the source of truth — these keys define the `Chrome` half of
 * `TranslationKey`, and every other locale is compile-checked against it.
 */
export const chrome = {
  // ── Dashboard chrome (sidebar, header, banners) ───────────────────────────
  'nav.section.content': 'Content',
  // The two halves of the sidebar. Deliberately not "Studio" for the first
  // one, which is what the design sketch said: STUDIO is also the top plan
  // tier, badged on rows a few pixels below this control, and one word cannot
  // mean both "the half of the app that is yours" and "the tier you are on".
  'nav.mode.workspace': 'Workspace',
  'nav.mode.community': 'Community',
  'nav.mode.aria': 'Which half of the product to navigate',
  'nav.section.analytics': 'Analytics',
  'nav.overview': 'Overview',
  'nav.bookings': 'Bookings',
  'nav.leads': 'Leads',
  'nav.instagram': 'Instagram',
  'nav.clients': 'Clients',
  'nav.portfolio': 'Portfolio',
  'nav.galleries': 'Galleries',
  // The owned halves: a space you rent out, the coaching and workshops you
  // sell. Named from the studio's side, which is what separates them from
  // Studios and Learning below.
  'nav.space': 'My space',
  'nav.offerings': 'My offerings',
  // Community — other photographers' things.
  'nav.locations': 'Locations',
  'nav.studios': 'Studios',
  'nav.learning': 'Learning',
  'nav.gear': 'Gear guide',
  'nav.documents': 'Documents',
  'nav.reports': 'Reports',
  'nav.revenue': 'Invoiced & Collected',
  'nav.payments': 'Payments',
  'nav.aria.main': 'Main navigation',
  'nav.aria.badgeUnread': '{count} unread',
  'nav.aria.profile': 'Open settings — current account',
  'nav.plan': '{plan} plan',

  'chrome.loading': 'Loading dashboard…',
  'chrome.redirecting': 'Redirecting…',
  'chrome.accessDenied.title': 'This page is for photographers',
  'chrome.accessDenied.body':
    "You're signed in as {email}, a client account. Sign in with your photographer account to open this page.",
  'chrome.accessDenied.switch': 'Sign in as photographer',
  'chrome.accessDenied.myBookings': 'Go to my bookings',
  'chrome.openMenu': 'Open navigation menu',
  'chrome.closeMenu': 'Close navigation menu',
  'chrome.aria.account': 'User account',
  'chrome.accountMenu': 'Account menu',
  'chrome.settings': 'Settings',
  'chrome.signOut': 'Sign out',
  'chrome.notifications.title': 'Needs attention',
  'chrome.notifications.loading': 'Checking…',
  'chrome.notifications.markRead': 'Mark replied',
  'chrome.notifications.review': 'Review',
  'chrome.notifications.viewAll': 'View all leads',
  'chrome.notifications.allDone': 'Mark all replied',
  'chrome.notifications.overdue': 'Overdue',
  'chrome.notifications.fresh': 'New',
  'chrome.notifications.unnamedInquiry': 'Inquiry without a name',
  'chrome.notifications.unnamed': 'No name',
  'chrome.notifications.contactForm': 'Contact form',
  'chrome.notifications.none': 'No new notifications',
  'chrome.notifications.alert_one': '{count} item needs attention',
  'chrome.notifications.alert_other': '{count} items need attention',
  'chrome.notifications.open_one': '{count} item needs attention',
  'chrome.notifications.open_other': '{count} items need attention',
  'chrome.notifications.leads_one': '{count} unreplied lead',
  'chrome.notifications.leads_other': '{count} unreplied leads',
  'chrome.notifications.bookings_one': '{count} new booking request',
  'chrome.notifications.bookings_other': '{count} new booking requests',

  'verify.bannerTitle': 'Confirm your email.',
  'verify.bannerBody':
    'We sent a verification link to {email}. Some features will stay locked until you confirm.',
  'verify.bannerSent': 'We sent a fresh verification link to {email}. It expires in 24 hours.',
  'verify.bannerError': 'Could not send verification email. Please try again later.',
  'verify.resend': 'Resend email',
  'verify.sending': 'Sending…',
  'verify.sent': 'Email sent',
  'verify.toastTitle': 'Verify your email',
  'verify.toastDefault': 'Please verify your email before performing this action.',
  'verify.dismiss': 'Dismiss',

  // Read-only lock / trial countdown, shown in the dashboard shell.
  'account.locked.fallback':
    'Your account is read-only. Choose a plan to continue creating bookings, galleries and invoices.',
  'account.trialEndingSoon':
    'Your free trial ends in {days} days ({date}). Choose a plan to keep creating bookings, galleries and invoices.',
  'account.choosePlan': 'Choose a plan',
} as const;

export type EnChrome = typeof chrome;
