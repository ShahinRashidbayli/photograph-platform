'use client';

import { type Dispatch, type SetStateAction, useCallback, useEffect, useState } from 'react';
import { fetchAllPages } from '@/lib/paging';
import type { Lead } from '@/types/api';
import type { Inquiry } from './inquiryTypes';

export interface LeadsInbox {
  leads: Lead[];
  setLeads: Dispatch<SetStateAction<Lead[]>>;
  inquiries: Inquiry[];
  setInquiries: Dispatch<SetStateAction<Inquiry[]>>;
  loading: boolean;
  loadFailed: boolean;
  reload: () => void;
}

/**
 * Loads the two inbox sources together — anonymous-form leads and authenticated
 * customer inquiries — and exposes them plus their setters so callers can patch
 * a single row in place after a mutation instead of re-fetching the whole list.
 *
 * <p>Inquiries are best-effort: a failure there must not blank the leads inbox,
 * so only a leads failure trips {@link LeadsInbox.loadFailed}. {@code loadFailed}
 * is a flag, not a message, so the copy follows a language switch and the loader
 * stays independent of the i18n hook.
 */
export function useLeadsInbox(): LeadsInbox {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    setLoadFailed(false);
    // Both lists are fetched page by page: `/api/leads` defaults to 20 rows
    // when no size is given, and this screen has no pagination control, so the
    // inbox silently stopped at the 20 most recent leads — every older lead was
    // unreachable, not just unlisted.
    Promise.allSettled([
      fetchAllPages<Lead>('/api/leads'),
      fetchAllPages<Inquiry>('/api/inquiries'),
    ])
      .then(([leadsRes, inqRes]) => {
        if (leadsRes.status === 'fulfilled') {
          setLeads(leadsRes.value);
        } else {
          setLoadFailed(true);
        }
        setInquiries(inqRes.status === 'fulfilled' ? inqRes.value : []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { leads, setLeads, inquiries, setInquiries, loading, loadFailed, reload };
}
