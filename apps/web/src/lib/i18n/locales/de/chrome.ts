import type { EnChrome } from '../en/chrome';

/**
 * Dashboard shell: sidebar nav, header, verification banners.
 *
 * Typed against the English namespace: a missing or misspelled key fails the
 * build here, pointing at this file rather than one giant dictionary.
 */
export const chrome: Record<keyof EnChrome, string> = {
  // ── Dashboard chrome (sidebar, header, banners) ───────────────────────────
  'nav.section.content': 'Inhalte',
  'nav.section.analytics': 'Auswertungen',
  'nav.overview': 'Übersicht',
  'nav.bookings': 'Buchungen',
  'nav.leads': 'Leads',
  'nav.clients': 'Kunden',
  'nav.portfolio': 'Portfolio',
  'nav.galleries': 'Galerien',
  'nav.reports': 'Berichte',
  'nav.revenue': 'Umsatz',
  'nav.myBookings': 'Meine Buchungen',
  'nav.payments': 'Zahlungen',
  'nav.aria.main': 'Hauptnavigation',
  'nav.aria.badgeUnread': '{count} ungelesen',
  'nav.aria.profile': 'Einstellungen öffnen — aktuelles Konto',
  'nav.plan': 'Tarif {plan}',

  'chrome.loading': 'Dashboard wird geladen…',
  'chrome.redirecting': 'Weiterleitung…',
  'chrome.accessDenied.title': 'Diese Seite ist für Fotograf:innen',
  'chrome.accessDenied.body': 'Sie sind als {email} angemeldet – ein Kundenkonto. Melden Sie sich mit Ihrem Fotografen-Konto an, um diese Seite zu öffnen.',
  'chrome.accessDenied.switch': 'Als Fotograf:in anmelden',
  'chrome.accessDenied.myBookings': 'Zu meinen Buchungen',
  'chrome.openMenu': 'Navigationsmenü öffnen',
  'chrome.closeMenu': 'Navigationsmenü schließen',
  'chrome.aria.account': 'Benutzerkonto',
  'chrome.accountMenu': 'Kontomenü',
  'chrome.settings': 'Einstellungen',
  'chrome.signOut': 'Abmelden',
  'chrome.notifications.none': 'Keine neuen Benachrichtigungen',
  'chrome.notifications.alert_one': '{count} Element braucht Aufmerksamkeit',
  'chrome.notifications.alert_other': '{count} Elemente brauchen Aufmerksamkeit',
  'chrome.notifications.open_one': '{count} Element braucht Aufmerksamkeit',
  'chrome.notifications.open_other': '{count} Elemente brauchen Aufmerksamkeit',
  'chrome.notifications.leads_one': '{count} unbeantworteter Lead',
  'chrome.notifications.leads_other': '{count} unbeantwortete Leads',
  'chrome.notifications.bookings_one': '{count} neue Buchungsanfrage',
  'chrome.notifications.bookings_other': '{count} neue Buchungsanfragen',

  'verify.bannerTitle': 'Bestätigen Sie Ihre E-Mail-Adresse.',
  'verify.bannerBody':
    'Wir haben einen Bestätigungslink an {email} gesendet. Einige Funktionen bleiben gesperrt, bis Sie bestätigen.',
  'verify.bannerSent':
    'Wir haben einen neuen Bestätigungslink an {email} gesendet. Er läuft in 24 Stunden ab.',
  'verify.bannerError':
    'Bestätigungs-E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es später erneut.',
  'verify.resend': 'E-Mail erneut senden',
  'verify.sending': 'Wird gesendet…',
  'verify.sent': 'E-Mail gesendet',
  'verify.toastTitle': 'E-Mail-Adresse bestätigen',
  'verify.toastDefault':
    'Bitte bestätigen Sie Ihre E-Mail-Adresse, bevor Sie diese Aktion ausführen.',
  'verify.dismiss': 'Schließen',
};
