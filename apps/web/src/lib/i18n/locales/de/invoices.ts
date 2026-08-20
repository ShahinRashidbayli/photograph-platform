import type { EnInvoices } from '../en/invoices';

/** Rechnungen und Zahlungen — siehe die englische Datei für den Zuschnitt. */
export const invoices: Record<keyof EnInvoices, string> = {
  'invoices.title': 'Rechnungen',
  'invoices.loading': 'Rechnungen werden geladen…',
  'invoices.error': 'Deine Rechnungen konnten gerade nicht geladen werden.',
  'invoices.empty': 'Noch keine Rechnungen.',
  'invoices.emptyForBooking':
    'Dein Fotograf hat für dieses Shooting noch keine Rechnung gestellt. Der Betrag oben ist das Vereinbarte — fällig wird nichts, bevor eine Rechnung da ist.',
  'invoices.number': 'Rechnung {number}',
  'invoices.outstanding': 'offen',
  'invoices.paid': 'Bezahlt',
  'invoices.partiallyPaid': '{amount} bezahlt',
  'invoices.pay': '{amount} bezahlen',
  'invoices.downloadPdf': 'PDF herunterladen',
  'invoices.bankTransferHint':
    'Lieber überweisen? Gib als Verwendungszweck {reference} an, damit dein Fotograf die Zahlung zuordnen kann.',

  // ── Stripe-Zahlungsdialog ─────────────────────────────────────────────────
  'invoices.payDialog.title': '{amount} bezahlen',
  'invoices.payDialog.methodCard': 'Karte',
  'invoices.payDialog.methodSepa': 'SEPA-Lastschrift',
  'invoices.payDialog.preparing': 'Sichere Zahlung wird vorbereitet…',
  'invoices.payDialog.unavailable': 'Online-Zahlung ist für diese Rechnung derzeit nicht möglich.',
  'invoices.payDialog.startFailed':
    'Die Zahlung konnte nicht gestartet werden. Bitte versuche es erneut.',
  'invoices.payDialog.confirmFailed': 'Die Zahlung konnte nicht abgeschlossen werden.',
  'invoices.payDialog.processing': 'Wird verarbeitet…',
  'invoices.payDialog.succeededTitle': 'Zahlung eingegangen',
  'invoices.payDialog.succeededBody': 'Vielen Dank — dein Fotograf wurde benachrichtigt.',
  'invoices.payDialog.pendingTitle': 'Zahlung übermittelt',
  'invoices.payDialog.pendingBody':
    'Deine Bank verarbeitet die Lastschrift. Diese Seite aktualisiert sich, sobald sie gebucht ist.',
  'invoices.payDialog.done': 'Fertig',
  'invoices.payDialog.close': 'Schließen',
  'invoices.payDialog.methodGroup': 'Zahlungsart',
  'invoices.payDialog.security':
    'Zahlungen werden von Stripe abgewickelt und gehen direkt an deinen Fotografen. Kartendaten erreichen diese Seite nie.',
};
