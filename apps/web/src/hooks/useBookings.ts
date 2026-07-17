import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Booking } from '@/types/api';

// Pull the whole booking list in pages rather than a single capped request.
// A flat `?size=50` silently dropped booking #51+, and the revenue/active stat
// cards are summed over this list — a truncated list meant wrong totals.
const PAGE_SIZE = 100;
const MAX_PAGES = 25;

// Demo data is a *local preview* aid only. In production an empty list must
// render the real empty state and a failed request the real error — never fake
// bookings, which would hide outages and mislead the user.
const SHOW_DEMO_DATA = process.env.NODE_ENV === 'development';

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const DUMMY_BOOKINGS: Booking[] = [
  {
    id: 'dummy-1',
    clientName: 'Sophie & Luca Bauer',
    clientEmail: 'sophie.bauer@example.com',
    eventDate: daysFromNow(11),
    eventTime: '15:00–17:00',
    eventType: 'Family shoot',
    location: 'Nordpark, Düsseldorf',
    totalAmountCents: 115000,
    depositAmountCents: 45000,
    status: 'CONFIRMED',
    createdAt: daysFromNow(-16),
  },
  {
    id: 'dummy-2',
    clientName: 'Mia & Jonas Weber',
    clientEmail: 'mia.weber@example.com',
    eventDate: daysFromNow(28),
    eventTime: '11:00–13:00',
    eventType: 'Couple shoot',
    location: 'Cologne Old Town',
    totalAmountCents: 85000,
    depositAmountCents: 0,
    status: 'ENQUIRY',
    createdAt: daysFromNow(-2),
  },
  {
    id: 'dummy-3',
    clientName: 'Thomas Müller',
    clientEmail: 'thomas.mueller@example.com',
    eventDate: daysFromNow(-31),
    eventTime: '10:00–12:00',
    eventType: 'Birthday shoot',
    location: 'Studio Berlin',
    totalAmountCents: 65000,
    depositAmountCents: 65000,
    status: 'COMPLETED',
    internalNotes: '48 photos delivered via gallery link.',
    createdAt: daysFromNow(-62),
  },
  {
    id: 'dummy-4',
    clientName: 'Anna Schneider',
    clientEmail: 'anna.schneider@example.com',
    eventDate: daysFromNow(45),
    eventTime: '14:00–16:00',
    eventType: 'Portrait',
    location: 'Hamburg Harbour',
    totalAmountCents: 49000,
    depositAmountCents: 15000,
    status: 'DEPOSIT_PAID',
    createdAt: daysFromNow(-7),
  },
];

/** Cache key — separate entries per audience since the endpoints differ. */
export function bookingsQueryKey(isPhotographer: boolean) {
  return ['bookings', isPhotographer ? 'photographer' : 'customer'] as const;
}

async function fetchBookings(isPhotographer: boolean): Promise<Booking[]> {
  const base = isPhotographer ? '/api/photographerBookings' : '/api/customerBookings';
  try {
    const all: Booking[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await api.get<Booking[]>(`${base}?page=${page}&size=${PAGE_SIZE}`);
      const chunk = Array.isArray(res.data) ? res.data : [];
      all.push(...chunk);
      if (chunk.length < PAGE_SIZE) break;
    }
    // Dev-only preview fallback when the account genuinely has no bookings.
    return all.length === 0 && SHOW_DEMO_DATA ? DUMMY_BOOKINGS : all;
  } catch (err) {
    // In dev, show demo data instead of an error screen; in prod, surface it.
    if (SHOW_DEMO_DATA) return DUMMY_BOOKINGS;
    throw err;
  }
}

/**
 * Bookings for the current audience, cached & deduped by React Query. Navigating
 * away and back within the stale window serves the cache instantly (no refetch),
 * and multiple mounts share a single in-flight request.
 */
export function useBookings(isPhotographer: boolean) {
  return useQuery({
    queryKey: bookingsQueryKey(isPhotographer),
    queryFn: () => fetchBookings(isPhotographer),
  });
}
