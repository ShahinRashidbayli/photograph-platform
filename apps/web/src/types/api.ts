export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  message: string;
  eventDate: string;
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
  internalNotes?: string;
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
