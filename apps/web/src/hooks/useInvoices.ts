import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { yearSummaryKey } from '@/hooks/useAnalytics';
import type {
  BillingProfile,
  Invoice,
  InvoicePaymentSummary,
  Payment,
  PaymentMethod,
  TaxCategory,
} from '@/types/api';

/**
 * Invoice + payment data for both audiences.
 *
 * <p>The two sides read from different endpoints on purpose: the photographer
 * asks by booking id, while the client has no booking id to ask with (that
 * whole surface is closed to CUSTOMER tokens) and instead gets the invoices
 * addressed to their own email from `/api/customer/invoices`.
 */

export function bookingInvoicesKey(bookingId: string) {
  return ['invoices', 'booking', bookingId] as const;
}

export function customerInvoicesKey() {
  return ['invoices', 'customer'] as const;
}

export function paymentSummaryKey(invoiceId: string) {
  return ['payments', invoiceId] as const;
}

/**
 * Exported because the settings screen writes this profile while the invoice
 * form reads it. When the key lived only inside `useBillingProfile`, saving a
 * new tax mode in Settings left the invoice form quoting the old one — and
 * `taxMode` decides whether 19% VAT is added to every line of a document that
 * cannot be edited once issued.
 */
export function billingProfileKey() {
  return ['billing-profile'] as const;
}

/** Photographer view: every invoice issued against one booking, newest first. */
export function useBookingInvoices(bookingId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: bookingInvoicesKey(bookingId ?? ''),
    enabled: Boolean(bookingId) && enabled,
    queryFn: async () => {
      const res = await api.get<Invoice[]>(`/api/bookings/${bookingId}/invoices`);
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

/** Client view: every invoice addressed to the signed-in customer. */
export function useCustomerInvoices(enabled = true) {
  return useQuery({
    queryKey: customerInvoicesKey(),
    enabled,
    queryFn: async () => {
      const res = await api.get<Invoice[]>('/api/customer/invoices');
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

/**
 * Paid / outstanding for one invoice, plus its full attempt history. Reachable
 * by both roles — the backend scopes a CUSTOMER caller to their own booking.
 */
export function usePaymentSummary(invoiceId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: paymentSummaryKey(invoiceId ?? ''),
    enabled: Boolean(invoiceId) && enabled,
    queryFn: async () => {
      const res = await api.get<InvoicePaymentSummary>(`/api/invoices/${invoiceId}/payments`);
      return res.data;
    },
  });
}

/**
 * The tenant's own invoicing identity. Read on the invoice form because two of
 * its fields change what gets issued, not just how it looks: `taxMode` decides
 * whether VAT is added to every line, and `complete` decides whether the server
 * will accept the invoice at all (§14 UStG).
 */
export function useBillingProfile(enabled = true) {
  return useQuery({
    queryKey: billingProfileKey(),
    enabled,
    queryFn: async () => {
      const res = await api.get<BillingProfile>('/api/settings/billing-profile');
      return res.data;
    },
  });
}

/** What the profile is saved with: the profile minus the server's verdict. */
export type BillingProfileInput = Omit<BillingProfile, 'complete'>;

/**
 * Writes the saved profile straight into the cache the invoice form reads.
 * Otherwise a photographer who switches to Regelbesteuerung in Settings and
 * immediately issues an invoice gets one billed under the old tax mode — on a
 * document that is immutable the moment it exists.
 */
export function useSaveBillingProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BillingProfileInput) =>
      (await api.put<BillingProfile>('/api/settings/billing-profile', input)).data,
    onSuccess: (saved) => qc.setQueryData(billingProfileKey(), saved),
  });
}

export interface CreateInvoiceLineItemInput {
  description: string;
  quantity: number;
  unitPriceCents: number;
  taxCategory: TaxCategory;
}

export interface CreateInvoiceInput {
  lineItems: CreateInvoiceLineItemInput[];
  buyerAddressLine1?: string | null;
  buyerAddressLine2?: string | null;
  buyerPostalCode?: string | null;
  buyerCity?: string | null;
  buyerCountry?: string | null;
  buyerReference?: string | null;
  paymentTerms?: string | null;
}

/**
 * Issuing is irreversible — the row is GoBD-immutable the moment it exists and
 * consumes a gap-free sequence number, so there is no draft state to go back
 * to. Every cache that shows money is invalidated on success: the booking's
 * `paymentState`/`amountPaidCents` are derived server-side from these rows.
 */
export function useIssueInvoice(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateInvoiceInput) => {
      const res = await api.post<Invoice>(`/api/bookings/${bookingId}/invoices`, input);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingInvoicesKey(bookingId) });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: yearSummaryKey() });
    },
  });
}

/** GoBD correction: never an edit or a delete, always a new negated invoice. */
export function useStornoInvoice(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await api.post<Invoice>(`/api/invoices/${invoiceId}/storno`, {});
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingInvoicesKey(bookingId) });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: yearSummaryKey() });
    },
  });
}

/** The photographer confirming a bank transfer landed. Immediately SUCCEEDED. */
export function useRecordManualPayment(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      invoiceId,
      amountCents,
    }: {
      invoiceId: string;
      amountCents: number | null;
    }) => {
      const res = await api.post<Payment>(`/api/invoices/${invoiceId}/payments/manual`, {
        amountCents,
      });
      return res.data;
    },
    onSuccess: (_payment, variables) => {
      queryClient.invalidateQueries({ queryKey: paymentSummaryKey(variables.invoiceId) });
      queryClient.invalidateQueries({ queryKey: bookingInvoicesKey(bookingId) });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: yearSummaryKey() });
    },
  });
}

/**
 * Starts (or resumes) a card/SEPA payment. Returns the client secret plus the
 * publishable key and connected account Stripe.js needs — the charge is a
 * direct charge on the photographer's own Stripe account, so the platform key
 * alone cannot resolve it.
 */
export async function createPaymentIntent(
  invoiceId: string,
  method: Extract<PaymentMethod, 'CARD' | 'SEPA'>
): Promise<Payment> {
  const res = await api.post<Payment>(`/api/invoices/${invoiceId}/payments/intent`, { method });
  return res.data;
}
