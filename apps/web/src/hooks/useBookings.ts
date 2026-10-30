import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { insertSortedByDate } from '@/lib/helpers';
import type { Booking } from '@/types/api';

// Pull the whole booking list in pages rather than a single capped request.
// A flat `?size=50` silently dropped booking #51+, and the revenue/active stat
// cards are summed over this list — a truncated list meant wrong totals.
const PAGE_SIZE = 100;
const MAX_PAGES = 25;

// NOTE: every field here must match the API's real shape. `eventTime` is a
// LocalTime ("15:00"), never a range — a range string made the calendar's
// `${eventDate}T${eventTime}` unparseable, and FullCalendar drops events it
// cannot parse *silently*, so the calendar rendered empty while the stat
// strip counted the same bookings.
//
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
    eventTime: '15:00',
    eventType: 'Family shoot',
    location: 'Nordpark, Düsseldorf',
    totalAmountCents: 115000,
    depositAmountCents: 45000,
    status: 'CONFIRMED',
    paymentState: 'PARTIALLY_PAID',
    amountPaidCents: 45000,
    createdAt: daysFromNow(-16),
  },
  {
    id: 'dummy-2',
    clientName: 'Mia & Jonas Weber',
    clientEmail: 'mia.weber@example.com',
    eventDate: daysFromNow(28),
    eventTime: '11:00',
    eventType: 'Couple shoot',
    location: 'Cologne Old Town',
    totalAmountCents: 85000,
    depositAmountCents: 0,
    status: 'ENQUIRY',
    paymentState: 'NOT_INVOICED',
    amountPaidCents: 0,
    createdAt: daysFromNow(-2),
  },
  {
    id: 'dummy-3',
    clientName: 'Thomas Müller',
    clientEmail: 'thomas.mueller@example.com',
    eventDate: daysFromNow(-31),
    eventTime: '10:00',
    eventType: 'Birthday shoot',
    location: 'Studio Berlin',
    totalAmountCents: 65000,
    depositAmountCents: 65000,
    status: 'COMPLETED',
    paymentState: 'PAID',
    amountPaidCents: 65000,
    internalNotes: '48 photos delivered via gallery link.',
    createdAt: daysFromNow(-62),
  },
  {
    id: 'dummy-4',
    clientName: 'Anna Schneider',
    clientEmail: 'anna.schneider@example.com',
    eventDate: daysFromNow(45),
    eventTime: '14:00',
    eventType: 'Portrait',
    location: 'Hamburg Harbour',
    totalAmountCents: 49000,
    depositAmountCents: 15000,
    status: 'CONFIRMED',
    paymentState: 'PARTIALLY_PAID',
    amountPaidCents: 15000,
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

/** The fields a booking is created or edited with — see `CreateBookingRequest` / `UpdateBookingRequest`. */
export interface BookingPayload {
  clientName: string;
  clientEmail: string;
  eventDate: string;
  eventTime: string | null;
  eventType: string | null;
  location: string | null;
  packageId: string | null;
  totalAmountCents: number | null;
  depositAmountCents: number;
  internalNotes: string | null;
  assignedUserId: string | null;
  resourceIds: string[];
}

/**
 * Creates a booking, or edits one when `id` is given, and files the result
 * into the photographer's cached list at its date — so it appears at once,
 * without a refetch. Removed and re-inserted rather than mapped, since an edit
 * may have moved the date.
 */
export function useSaveBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; payload: BookingPayload }) =>
      (input.id
        ? await api.patch<Booking>(`/api/bookings/${input.id}`, input.payload)
        : await api.post<Booking>('/api/bookings', input.payload)
      ).data,
    onSuccess: (saved) =>
      qc.setQueryData<Booking[]>(bookingsQueryKey(true), (old = []) =>
        insertSortedByDate(
          old.filter((b) => b.id !== saved.id),
          saved
        )
      ),
  });
}

/**
 * A status change, applied optimistically.
 *
 * <p>The new state is painted immediately and reconciled with the server's
 * response; a failure puts back the status it had — only that field on only
 * that booking, so a change that landed meanwhile on another one survives.
 */
export function useUpdateBookingStatus() {
  const qc = useQueryClient();
  const key = bookingsQueryKey(true);
  const setStatus = (id: string, status: Booking['status']) =>
    qc.setQueryData<Booking[]>(key, (old = []) =>
      old.map((b) => (b.id === id ? { ...b, status } : b))
    );
  return useMutation({
    mutationFn: async (input: { id: string; from: Booking['status']; to: Booking['status'] }) =>
      (await api.patch<Booking>(`/api/bookings/${input.id}/status`, { status: input.to })).data,
    onMutate: async (input) => {
      // So a refetch already in flight cannot land after this and repaint the old status.
      await qc.cancelQueries({ queryKey: key });
      setStatus(input.id, input.to);
    },
    onSuccess: (saved) =>
      qc.setQueryData<Booking[]>(key, (old = []) =>
        old.map((b) => (b.id === saved.id ? saved : b))
      ),
    onError: (_err, input) => setStatus(input.id, input.from),
  });
}

export interface BookingConflicts {
  conflicts: { id: string; clientName: string; eventTime: string | null; status: string }[];
  resourceClashes: { resourceName: string; clientName: string; eventTime: string | null }[];
}

export interface ConflictQuery {
  eventDate: string;
  assignedUserId: string | null;
  resourceIds: string[];
  /** So editing a booking does not report it clashing with itself. */
  excludeBookingId?: string;
}

const NO_CONFLICTS: BookingConflicts = { conflicts: [], resourceClashes: [] };

/**
 * Whether the chosen photographer or resources are already booked that day.
 * `null` asks nothing: a date is the one thing both halves need, and either a
 * photographer or a resource is enough to have something to ask about.
 *
 * <p>Never an error: a warning that cannot load must not stop anyone booking
 * work, so a failure reads as "no clashes". The previous answer stays on
 * screen while the next one loads, instead of the warning blinking out and
 * back on every change.
 */
export function useBookingConflicts(query: ConflictQuery | null) {
  return useQuery({
    queryKey: ['bookings', 'conflicts', query] as const,
    enabled: query !== null,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<BookingConflicts> => {
      if (!query) return NO_CONFLICTS;
      try {
        const { data } = await api.get<Partial<BookingConflicts>>('/api/bookings/conflicts', {
          params: {
            assignedUserId: query.assignedUserId || undefined,
            eventDate: query.eventDate,
            excludeBookingId: query.excludeBookingId,
            resourceIds: query.resourceIds.length > 0 ? query.resourceIds : undefined,
          },
          // Repeated `resourceIds=` rather than a comma-joined value, which is
          // what Spring binds a List<UUID> from.
          paramsSerializer: { indexes: null },
        });
        return {
          conflicts: data?.conflicts ?? [],
          resourceClashes: data?.resourceClashes ?? [],
        };
      } catch {
        return NO_CONFLICTS;
      }
    },
  });
}
