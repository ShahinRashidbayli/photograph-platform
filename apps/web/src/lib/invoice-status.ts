import type { TranslationKey } from '@/lib/i18n';
import type { Invoice } from '@/types/api';

/**
 * What an invoice's status pill says, read off the server's Settlement flags
 * carried on the invoice (ADR-004) — never worked out on the client. Working
 * them out here is how the screens and the server came to disagree. The
 * Storno flag only picks the label of an invoice that is no longer live.
 */
export type InvoiceStatus = 'storno' | 'cancelled' | 'overdue' | 'open' | 'paid';

export function invoiceStatus(
  invoice: Pick<Invoice, 'live' | 'stornoOfId' | 'overdue' | 'collectable'>
): InvoiceStatus {
  if (!invoice.live) return invoice.stornoOfId !== null ? 'storno' : 'cancelled';
  if (invoice.overdue) return 'overdue';
  return invoice.collectable ? 'open' : 'paid';
}

export const INVOICE_STATUS: Record<
  InvoiceStatus,
  { labelKey: TranslationKey; tone: 'neutral' | 'danger' | 'warning' | 'success' }
> = {
  storno: { labelKey: 'invoices.manage.status.storno', tone: 'neutral' },
  cancelled: { labelKey: 'invoices.manage.status.cancelled', tone: 'neutral' },
  overdue: { labelKey: 'invoices.manage.status.overdue', tone: 'danger' },
  open: { labelKey: 'invoices.manage.status.open', tone: 'warning' },
  paid: { labelKey: 'invoices.manage.status.paid', tone: 'success' },
};
