export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  message: string;
  /**
   * Nullable, because `leads.event_date` is: someone can ask "what does this
   * cost?" without naming a date, and the public form does not require one.
   * This was typed as a plain `string`, which is why nothing caught the
   * urgency chip calling `.getTime()` on it.
   */
  eventDate: string | null;
  eventType: 'WEDDING' | 'ENGAGEMENT' | 'PORTRAIT' | 'FAMILY' | 'NEWBORN' | 'CORPORATE';
  budgetRange: 'UNDER_200' | '200_500' | '500_1000' | 'OVER_1000';
  score: 'HIGH' | 'MED' | 'LOW';
  // Component scores 0-100 computed by the backend (see LeadService.scoreBreakdown).
  // Optional because older responses or non-lead endpoints may omit them.
  budgetScore?: number;
  typeScore?: number;
  timeScore?: number;
  status: 'NEW' | 'REPLIED' | 'BOOKED' | 'REJECTED';
  internalNotes?: string;
  createdAt: string;
}

/**
 * Audit-log entry as exposed by GET /api/leads/{id}/activity. Mirrors the
 * backend AuditLogResponse record.
 */
export interface LeadActivity {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: string | null;
  newValue?: string | null;
  actorId?: string | null;
  createdAt: string;
}

export interface Client {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  notes?: string;
  totalBookings: number;
  totalSpentCents: number;
  upcomingBookings: number;
  lastBookingDate?: string;
  createdAt: string;
}

export interface Package {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  durationHours?: number;
  includedPhotos?: number;
  active: boolean;
  sortOrder: number;
}

export interface Booking {
  id: string;
  clientName: string;
  clientEmail: string;
  eventDate: string;
  eventTime?: string;
  eventType?: string;
  location?: string;
  packageId?: string;
  totalAmountCents: number;
  depositAmountCents: number;
  status: 'ENQUIRY' | 'CONFIRMED' | 'POSTPONED' | 'COMPLETED' | 'DECLINED' | 'CANCELLED';
  /** Derived server-side from real invoice/payment rows — never guessed client-side. */
  paymentState?: 'NOT_INVOICED' | 'OPEN' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
  amountPaidCents?: number;
  /**
   * Money Collected for this booking beyond what its Live invoices ask for,
   * e.g. a payment on an invoice that was later Storniert with no replacement.
   * The studio holds it until a new invoice uses it or it is paid back.
   * Derived server-side like `paymentState`. Staff responses only; a
   * Customer's booking omits it.
   */
  creditCents?: number;
  /**
   * Uncollected: what the quote has still to bring in, derived server-side:
   * zero unless the booking is Billable. Staff responses only; a Customer's
   * booking omits it.
   */
  uncollectedCents?: number;
  internalNotes?: string;
  /**
   * The photographer shooting it, or absent while nobody has been assigned.
   * The name rides along so a list does not resolve every id against the team.
   */
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  /** Rooms and kit this shoot holds, so the edit form can restore the selection. */
  resourceIds?: string[];
  createdAt: string;
}

export interface Gallery {
  id: string;
  bookingId: string;
  accessToken: string;
  expiresAt: string;
  downloadEnabled: boolean;
  watermarkEnabled: boolean;
  viewCount: number;
}

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
}

export interface DashboardData {
  overview: {
    revenueApr: number;
    revenueMarChange: number;
    activeBookingsCount: number;
    newLeadsCount: number;
    leadsNeedingReply: number;
    openGalleriesCount: number;
    expiredGalleriesCount: number;
  };
  leads: Lead[];
  bookings: Booking[];
  galleries: Gallery[];
  revenueHistory: Array<{ month: string; amount: number }>;
}

// ── Invoicing & payments ─────────────────────────────────────────────────────
// Mirrors the API records one-for-one. Money is always integer cents, never a
// float: `totalCents` etc. are what the backend stores and what Stripe charges,
// and rounding a euro amount through a JS number is how a €1,200.00 deposit
// becomes €1,199.99 on someone's invoice.

export type TaxCategory = 'STANDARD' | 'REDUCED' | 'EXEMPT';
export type TaxMode = 'KLEINUNTERNEHMER' | 'REGELBESTEUERUNG';

export interface InvoiceLineItem {
  description: string;
  /** Decimal — serialized as a JSON number by Jackson (e.g. 1, 2.5). */
  quantity: number;
  unitPriceCents: number;
  taxCategory: TaxCategory;
  taxRatePercent: number;
  lineTotalCents: number;
}

export interface Invoice {
  id: string;
  bookingId: string | null;
  invoiceNumber: string;
  status: 'ISSUED' | 'STORNIERT';
  taxMode: TaxMode;
  buyerName: string;
  buyerEmail: string;
  currency: string;
  subtotalCents: number;
  taxCents: number;
  /** Negative on a Storno — it is designed to net the original to zero. */
  totalCents: number;
  /**
   * Settlement figures, served with the invoice itself rather than fetched per
   * row from the payment-summary endpoint — the latter cost one HTTP request
   * per invoice on every list that showed them.
   */
  paidCents: number;
  /** Zero unless the invoice is Live. */
  outstandingCents: number;
  /**
   * `YYYY-MM-DD`; null unless the invoice is Live. This and the three flags
   * below are the server's Settlement (ADR-004): render them, never work out
   * Live, Collectable or Overdue from the other fields.
   */
  dueDate: string | null;
  /** Neither a Storno nor Storniert: the only kind a Customer can owe money on. */
  live: boolean;
  /** Live with something Outstanding: the only kind a pay action belongs on. */
  collectable: boolean;
  /** Collectable with its Due date passed. */
  overdue: boolean;
  /** Bank-transfer reference, e.g. `RE-2026-0001`. */
  verwendungszweck: string;
  /** Set on a Storno, pointing at the invoice it corrects. */
  stornoOfId: string | null;
  /** Pre-signed R2 GET, refreshed on every read — do not cache it. */
  pdfDownloadUrl: string | null;
  issuedAt: string;
  lineItems: InvoiceLineItem[];
}

export type PaymentMethod = 'CARD' | 'SEPA' | 'UEBERWEISUNG';

export interface Payment {
  id: string;
  invoiceId: string;
  method: PaymentMethod;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
  amountCents: number;
  currency: string;
  /** Only on a freshly created/reused intent — never on history rows. */
  clientSecret: string | null;
  /**
   * Returned with the client secret. Charges are DIRECT charges on the
   * photographer's connected account, so Stripe.js must be loaded with the
   * publishable key AND `stripeAccount` — the platform key alone cannot
   * resolve the secret.
   */
  publishableKey: string | null;
  stripeAccountId: string | null;
  applicationFeeCents: number;
  createdAt: string;
  confirmedAt: string | null;
}

export interface InvoicePaymentSummary {
  totalCents: number;
  paidCents: number;
  outstandingCents: number;
  /** Reference the client puts on a bank transfer so it can be matched. */
  verwendungszweck: string;
  payments: Payment[];
}

// ── Tenant settings ──────────────────────────────────────────────────────────

export interface BillingProfile {
  businessName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  taxId: string | null;
  vatId: string | null;
  taxMode: TaxMode;
  /** Server's verdict on §14 UStG completeness — the gate on issuing at all. */
  complete: boolean;
}

export interface StripeConnectStatus {
  /** False when the deployment has no Stripe credentials at all. */
  platformConfigured: boolean;
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  onboardedAt: string | null;
  plan: string;
  /** Platform commission on this plan, in basis points (200 = 2%). */
  commissionBps: number;
}
