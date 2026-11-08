'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTriageInquiry, useUpdateLeadStatus } from '@/hooks/useLeads';
import type { PendingStatus } from './leads.inbox';

/** How long a reply or a decline can be taken back before the server hears of it. */
export const UNDO_WINDOW_MS = 6000;

/**
 * Status changes with an undo window.
 *
 * <p>Replying and declining open a draft in the photographer's mail app and
 * move the request along in one click — but the server cannot take either
 * back (a REPLIED lead never returns to NEW; see `LeadStatus` on the API). So
 * the change is held here for {@link UNDO_WINDOW_MS}: the inbox already shows
 * it, "Undo" simply drops it, and only then is it sent. Leaving the page
 * sends whatever is still held rather than losing it.
 *
 * <p>Accepting a client's request is not routed through here: it creates the
 * booking on the server, which is a decision worth making on the spot.
 */
export function useDeferredStatus(onError: (_error: unknown, _change: PendingStatus) => void) {
  const { mutate: mutateLead } = useUpdateLeadStatus();
  const { mutate: mutateInquiry } = useTriageInquiry();
  const [pending, setPending] = useState<PendingStatus[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const held = useRef(new Map<string, PendingStatus>());
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const key = (p: { kind: string; id: string }) => `${p.kind}:${p.id}`;
  const drop = useCallback((k: string) => {
    held.current.delete(k);
    setPending((list) => list.filter((p) => key(p) !== k));
  }, []);

  const send = useCallback(
    (change: PendingStatus) => {
      const k = key(change);
      timers.current.delete(k);
      // Stays "pending" until the server answers, so the row does not jump
      // back to where it was for the moment before the cache catches up.
      const settle = { onSettled: () => drop(k) };
      const fail = (err: unknown) => onErrorRef.current(err, change);
      if (change.kind === 'lead') {
        mutateLead({ id: change.id, status: change.status }, { ...settle, onError: fail });
      } else {
        // An inquiry is only ever declined through here.
        mutateInquiry({ id: change.id, status: 'REJECTED' }, { ...settle, onError: fail });
      }
    },
    [mutateLead, mutateInquiry, drop]
  );

  const schedule = useCallback(
    (change: PendingStatus) => {
      const k = key(change);
      const existing = timers.current.get(k);
      if (existing) clearTimeout(existing);
      held.current.set(k, change);
      setPending((list) => [...list.filter((p) => key(p) !== k), change]);
      timers.current.set(
        k,
        setTimeout(() => send(change), UNDO_WINDOW_MS)
      );
    },
    [send]
  );

  const undo = useCallback(
    (change: { kind: string; id: string }) => {
      const k = key(change);
      const timer = timers.current.get(k);
      if (!timer) return; // already sent
      clearTimeout(timer);
      timers.current.delete(k);
      drop(k);
    },
    [drop]
  );

  // Leaving the page sends what is still held — an undo window is a grace
  // period, not a way to lose the photographer's reply.
  useEffect(() => {
    const t = timers.current;
    const h = held.current;
    return () => {
      for (const [k, timer] of t) {
        clearTimeout(timer);
        const change = h.get(k);
        if (change) send(change);
      }
      t.clear();
    };
  }, [send]);

  return { pending, schedule, undo };
}
