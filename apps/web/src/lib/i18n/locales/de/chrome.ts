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
  'nav.mode.workspace': 'Arbeitsbereich',
  'nav.mode.community': 'Community',
  'nav.mode.aria': 'Welche Hälfte des Produkts navigiert wird',
  'nav.section.analytics': 'Auswertungen',
  'nav.overview': 'Übersicht',
  'nav.bookings': 'Buchungen',
  'nav.leads': 'Leads',
  'nav.instagram': 'Instagram',
  'nav.clients': 'Kunden',
  'nav.portfolio': 'Portfolio',
  'nav.galleries': 'Galerien',
  'nav.space': 'Mein Raum',
  'nav.offerings': 'Mein Angebot',
  // "Locations" ist im deutschen Fotografen-Sprachgebrauch der übliche
  // Begriff — "Orte" liest sich hier wie eine Übersetzung, nicht wie das Wort,
  // das in der Branche benutzt wird.
  'nav.locations': 'Locations',
  'nav.studios': 'Studios',
  'nav.learning': 'Lernen',
  'nav.gear': 'Ausrüstung',
  'nav.documents': 'Dokumente',
  'nav.reports': 'Berichte',
  'nav.revenue': 'Umsatz',
  'nav.payments': 'Zahlungen',
  'nav.aria.main': 'Hauptnavigation',
  'nav.aria.badgeUnread': '{count} ungelesen',
  'nav.aria.profile': 'Einstellungen öffnen — aktuelles Konto',
  'nav.plan': 'Tarif {plan}',

  'chrome.loading': 'Dashboard wird geladen…',
  'chrome.redirecting': 'Weiterleitung…',
  'chrome.accessDenied.title': 'Diese Seite ist für Fotograf:innen',
  'chrome.accessDenied.body':
    'Sie sind als {email} angemeldet – ein Kundenkonto. Melden Sie sich mit Ihrem Fotografen-Konto an, um diese Seite zu öffnen.',
  'chrome.accessDenied.switch': 'Als Fotograf:in anmelden',
  'chrome.accessDenied.myBookings': 'Zu meinen Buchungen',
  'chrome.openMenu': 'Navigationsmenü öffnen',
  'chrome.closeMenu': 'Navigationsmenü schließen',
  'chrome.aria.account': 'Benutzerkonto',
  'chrome.accountMenu': 'Kontomenü',
  'chrome.settings': 'Einstellungen',
  'chrome.signOut': 'Abmelden',
  'chrome.notifications.title': 'Braucht Aufmerksamkeit',
  'chrome.notifications.loading': 'Wird geprüft…',
  'chrome.notifications.markRead': 'Als beantwortet markieren',
  'chrome.notifications.review': 'Ansehen',
  'chrome.notifications.viewAll': 'Alle Leads ansehen',
  'chrome.notifications.allDone': 'Alle erledigt',
  'chrome.notifications.overdue': 'Überfällig',
  'chrome.notifications.fresh': 'Neu',
  'chrome.notifications.unnamedInquiry': 'Anfrage ohne Namen',
  'chrome.notifications.unnamed': 'Ohne Namen',
  'chrome.notifications.contactForm': 'Kontaktformular',
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

  // Nur-Lesen-Sperre / Ende der Testphase, im Dashboard-Rahmen.
  'account.locked.fallback':
    'Dein Konto ist im Nur-Lesen-Modus. Wähle einen Tarif, um wieder Buchungen, Galerien und Rechnungen anzulegen.',
  'account.trialEndingSoon':
    'Deine Testphase endet in {days} Tagen ({date}). Wähle einen Tarif, um weiter Buchungen, Galerien und Rechnungen anzulegen.',
  'account.choosePlan': 'Tarif wählen',
};
