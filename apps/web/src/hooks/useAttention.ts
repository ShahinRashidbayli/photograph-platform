'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchAllPages } from '@/lib/paging';

/**
 * One thing waiting on the photographer, as the bell panel shows it.
 *
 * <p>There is no notifications table behind this: "unread" is derived from the
 * two states that mean nobody has dealt with the thing yet — a lead still
 * {@code NEW} and an inquiry still {@code PENDING}. That is also why marking
 * one read is a real transition rather than a local flag; see the panel.
 */
export type AttentionItem = {
  kind: 'LEAD' | 'INQUIRY';
  id: string;
  /** Blank when the form was submitted without one — the panel says so. */
  name: string | null;
  email: string | null;
  eventType: string | null;
  /** The shoot's date, not the enquiry's. Null until someone has proposed one. */
  eventDate: string | null;
  /** Where a lead came in from, shown when there is nothing else to say. */
  source: string | null;
  createdAt: string;
};

type LeadRow = {
  id: string;
  name?: string | null;
  email?: string | null;
  status: string;
  eventType?: string | null;
  eventDate?: string | null;
  source?: string | null;
  createdAt: string;
};

type InquiryRow = {
  id: string;
  customerName?: string | null;
  customerEmail?: string | null;
  status: string;
  eventType?: string | null;
  proposedDate?: string | null;
  createdAt: string;
};

/**
 * Everything new that landed in the leads inbox and still needs the
 * photographer — un-replied form leads (status NEW) plus un-triaged customer
 * inquiries (status PENDING). Both surface on /leads, so a single list drives
 * the bell and the sidebar's Leads badge.
 *
 * <p>Polled every 60s — cheap and "good enough" without a websocket; failures
 * are silent so an outage doesn't make the badge flicker. {@code refresh}
 * re-runs it immediately, for when the photographer clears an item from the
 * panel and should not have to wait out the poll with a row they just handled.
 *
 * @param enabled false for a customer session, which has no such inbox and
 *                must not call the photographer endpoints at all
 */
export function useAttention(enabled: boolean) {
  const [items, setItems] = useState<AttentionItem[] | null>(null);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const fetchItems = () => {
      // Paged, not a bare GET: `/api/leads` caps at 20 by default, so the
      // badge stopped counting new leads once the 20 most recent rows were
      // no longer all NEW — i.e. it under-reported exactly when there was a
      // backlog to flag.
      //
      // Filtered server-side, because paging alone made this the most
      // expensive thing the app does. This runs in the dashboard *layout*, so
      // it is live on every screen, in every open tab, every 60 seconds — and
      // it was walking the studio's entire lead and inquiry history, a page of
      // 100 per round trip, to end up displaying the handful of rows that are
      // still waiting. A studio with 800 leads and 400 inquiries paid twelve
      // sequential requests a minute for a list that is almost always short.
      //
      // The API already answers the narrower question (`?status=`, see
      // LeadController and InquiryController), and the un-triaged set is
      // bounded by how fast the photographer works rather than by how long
      // they have been in business. The client-side status filter below is
      // kept as well: it costs nothing over an already-filtered list, and it
      // means a server that ignored the parameter would still render the right
      // panel rather than a bell claiming every lead ever received.
      Promise.all([
        fetchAllPages<LeadRow>('/api/leads', { status: 'NEW' }).catch(() => null),
        fetchAllPages<InquiryRow>('/api/inquiries', { status: 'PENDING' }).catch(() => null),
      ]).then(([leads, inquiries]) => {
        if (cancelled) return;
        // If both calls failed, leave the previous list untouched.
        if (leads === null && inquiries === null) return;
        const next: AttentionItem[] = [
          ...(Array.isArray(leads) ? leads : [])
            .filter((l) => l.status === 'NEW')
            .map((l) => ({
              kind: 'LEAD' as const,
              id: l.id,
              name: l.name ?? null,
              email: l.email ?? null,
              eventType: l.eventType ?? null,
              eventDate: l.eventDate ?? null,
              source: l.source ?? null,
              createdAt: l.createdAt,
            })),
          ...(Array.isArray(inquiries) ? inquiries : [])
            .filter((i) => i.status === 'PENDING')
            .map((i) => ({
              kind: 'INQUIRY' as const,
              id: i.id,
              name: i.customerName ?? null,
              email: i.customerEmail ?? null,
              eventType: i.eventType ?? null,
              eventDate: i.proposedDate ?? null,
              source: null,
              createdAt: i.createdAt,
            })),
        ];
        // Newest first, so the panel reads like an inbox rather than like two
        // lists stapled together.
        next.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        setItems(next);
      });
    };
    fetchItems();
    const id = window.setInterval(fetchItems, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, nonce]);

  return {
    items,
    /**
     * Null until the first fetch lands, so the bell shows nothing rather than
     * a confident zero it has not checked.
     */
    count: items === null ? null : items.length,
    refresh,
  };
}
