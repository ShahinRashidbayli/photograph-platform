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
  status: 'NEW' | 'REPLIED' | 'BOOKED' | 'REJECTED';
  internalNotes?: string;
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
  status: 'ENQUIRY' | 'CONFIRMED' | 'DEPOSIT_PAID' | 'FULLY_PAID' | 'COMPLETED' | 'CANCELLED';
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
