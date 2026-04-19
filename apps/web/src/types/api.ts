export type EventType = 'WEDDING' | 'PORTRAIT' | 'FAMILY' | 'ENGAGEMENT';
export type LeadScore = 'HIGH' | 'MED' | 'LOW';
export type LeadStatus = 'NEW' | 'REPLIED' | 'BOOKED' | 'REJECTED';
export type BudgetRange = 'UNDER_200' | '200_500' | '500_1000' | 'OVER_1000';
export type BookingStatus = 'DEPOSIT' | 'CONFIRMED' | 'COMPLETED';

export interface Lead {
  id: string;
  name: string;
  email: string;
  eventDate: string; // ISO 8601
  eventType: EventType;
  budgetRange: BudgetRange;
  score: LeadScore;
  status: LeadStatus;
  createdAt: string;
}

export interface Booking {
  id: string;
  clientName: string;
  clientEmail: string;
  eventDate: string;
  packageId: string;
  depositAmount: number;
  totalAmount: number;
  depositPercent: number;
  status: BookingStatus;
  notes?: string;
  createdAt: string;
}

export interface Gallery {
  id: string;
  clientName: string;
  eventType: EventType;
  photoCount: number;
  isPublished: boolean;
  expiresAt: string;
  createdAt: string;
}

export interface DashboardOverview {
  revenueApr: number;
  revenueMarChange: number; // percentage
  activeBookingsCount: number;
  newLeadsCount: number;
  leadsNeedingReply: number;
  openGalleriesCount: number;
  expiredGalleriesCount: number;
}

export interface RevenueData {
  month: string;
  amount: number;
}

export interface DashboardData {
  overview: DashboardOverview;
  leads: Lead[];
  bookings: Booking[];
  galleries: Gallery[];
  revenueHistory: RevenueData[];
}

export interface CreateBookingRequest {
  clientName: string;
  clientEmail: string;
  eventDate: string;
  packageId: string;
  depositPercent: number;
  notes?: string;
}

export interface CreateLeadRequest {
  name: string;
  email: string;
  eventDate: string;
  eventType: EventType;
  budgetRange: BudgetRange;
}
