import type { AppColors } from '@/lib/design-tokens';
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

type InvoiceTone = 'neutral' | 'danger' | 'warning' | 'success';

export const INVOICE_STATUS: Record<
  InvoiceStatus,
  { labelKey: TranslationKey; tone: InvoiceTone }
> = {
  storno: { labelKey: 'invoices.manage.status.storno', tone: 'neutral' },
  cancelled: { labelKey: 'invoices.manage.status.cancelled', tone: 'neutral' },
  overdue: { labelKey: 'invoices.manage.status.overdue', tone: 'danger' },
  open: { labelKey: 'invoices.manage.status.open', tone: 'warning' },
  paid: { labelKey: 'invoices.manage.status.paid', tone: 'success' },
};

/** The pill's text and fill for a tone — shared so every screen colours a status alike. */
export function invoiceToneColors(tone: InvoiceTone, c: AppColors): { fg: string; bg: string } {
  return {
    neutral: { fg: c.neutralText, bg: c.neutralBg },
    danger: { fg: c.dangerText, bg: c.dangerBg },
    warning: { fg: c.warningText, bg: c.warningBg },
    success: { fg: c.successText, bg: c.successBg },
  }[tone];
}
