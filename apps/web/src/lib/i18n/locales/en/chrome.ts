/**
 * Dashboard shell: sidebar nav, header, verification banners.
 *
 * English is the source of truth — these keys define the `Chrome` half of
 * `TranslationKey`, and every other locale is compile-checked against it.
 */
export const chrome = {
  // ── Dashboard chrome (sidebar, header, banners) ───────────────────────────
  'nav.section.content': 'Content',
  'nav.section.analytics': 'Analytics',
  'nav.overview': 'Overview',
  'nav.bookings': 'Bookings',
  'nav.leads': 'Leads',
  'nav.clients': 'Clients',
  'nav.portfolio': 'Portfolio',
  'nav.galleries': 'Galleries',
  'nav.reports': 'Reports',
  'nav.revenue': 'Revenue',
  'nav.myBookings': 'My Bookings',
  'nav.payments': 'Payments',
  'nav.aria.main': 'Main navigation',
  'nav.aria.badgeUnread': '{count} unread',
  'nav.aria.profile': 'Open settings — current account',
  'nav.plan': '{plan} plan',

  'chrome.loading': 'Loading dashboard…',
  'chrome.redirecting': 'Redirecting…',
  'chrome.openMenu': 'Open navigation menu',
  'chrome.closeMenu': 'Close navigation menu',
  'chrome.aria.account': 'User account',
  'chrome.accountMenu': 'Account menu',
  'chrome.settings': 'Settings',
  'chrome.signOut': 'Sign out',
  'chrome.notifications.none': 'No new notifications',
  'chrome.notifications.alert_one': '{count} unreplied lead',
  'chrome.notifications.alert_other': '{count} unreplied leads',
  'chrome.notifications.open_one': '{count} unreplied lead — open Leads',
  'chrome.notifications.open_other': '{count} unreplied leads — open Leads',

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
} as const;

export type EnChrome = typeof chrome;
