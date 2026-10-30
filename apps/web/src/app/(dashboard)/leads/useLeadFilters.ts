'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Lead } from '@/types/api';
import type { LeadPipelineFilter, LeadScoreFilter } from './leadTypes';
import { type Inquiry, inquiryPipeline } from './inquiryTypes';

export type SourceFilter = 'all' | 'form' | 'customer';
/** Newest-first is the inbox default; oldest-first surfaces what has been waiting longest. */
export type LeadSortOrder = 'newest' | 'oldest';

/**
 * One row of the inbox.
 *
 * <p>Leads and customer inquiries stay separate types — their enums, statuses
 * and action sets genuinely differ — but they share a single chronological
 * list, so the sort has to be applied to the merged sequence. Sorting each
 * source on its own and concatenating them (which is what this hook used to
 * hand the page) put every inquiry above every lead regardless of date: with
 * "newest first" selected, a lead from August still rendered below an inquiry
 * from January. Returning one ordered list instead of two is what makes that
 * unrepresentable.
 */
export type InboxItem =
  | { kind: 'lead'; id: string; createdAt: string; lead: Lead }
  | { kind: 'inquiry'; id: string; createdAt: string; inquiry: Inquiry };

export interface LeadFilters {
  sourceFilter: SourceFilter;
  setSourceFilter: (_v: SourceFilter) => void;
  filterScore: LeadScoreFilter;
  setFilterScore: (_v: LeadScoreFilter) => void;
  filterPipeline: LeadPipelineFilter;
  setFilterPipeline: (_v: LeadPipelineFilter) => void;
  searchTerm: string;
  setSearchTerm: (_v: string) => void;
  sortOrder: LeadSortOrder;
  setSortOrder: (_v: LeadSortOrder) => void;
  pipelineCounts: Record<LeadPipelineFilter, number>;
  /** Both sources, filtered and merged into one list in the chosen order. */
  inboxItems: InboxItem[];
}

/**
 * Owns the leads inbox filter state (source / score / pipeline / search / sort)
 * and the single ordered list derived from it. Extracted from the page so the
 * component renders from one view-model rather than juggling filter state and
 * five interdependent memos inline.
 *
 * <p>Customer inquiries share the inbox with anonymous-form leads, so every
 * derivation spans both sources and the pipeline counts sum whichever sources
 * the source filter leaves visible.
 */
export function useLeadFilters(leads: Lead[], inquiries: Inquiry[]): LeadFilters {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [filterScore, setFilterScore] = useState<LeadScoreFilter>('All');
  // Default to Active so the inbox shows only enquiries the photographer can
  // still act on (NEW + REPLIED). Converted and rejected leads are one click
  // away via the pipeline tabs, but they don't clutter the daily working view.
  const [filterPipeline, setFilterPipeline] = useState<LeadPipelineFilter>('Active');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<LeadSortOrder>('newest');

  const showLeads = sourceFilter !== 'customer';
  const showInquiries = sourceFilter !== 'form';

  // Computed off the unfiltered lists so the tab numbers reflect the total
  // pipeline (across visible sources), not the currently-filtered subset —
  // otherwise switching tabs would shuffle the counts.
  const pipelineCounts = useMemo<Record<LeadPipelineFilter, number>>(() => {
    let active = 0;
    let booked = 0;
    let rejected = 0;
    if (showLeads) {
      for (const l of leads) {
        if (l.status === 'BOOKED') booked++;
        else if (l.status === 'REJECTED') rejected++;
        else active++;
      }
    }
    if (showInquiries) {
      for (const i of inquiries) {
        const bucket = inquiryPipeline(i.status);
        if (bucket === 'Booked') booked++;
        else if (bucket === 'Rejected') rejected++;
        else active++;
      }
    }
    return { Active: active, Booked: booked, Rejected: rejected, All: active + booked + rejected };
  }, [leads, inquiries, showLeads, showInquiries]);

  const scoreMatches = useCallback(
    (score: 'HIGH' | 'MED' | 'LOW') =>
      filterScore === 'All' ||
      (filterScore === 'High' && score === 'HIGH') ||
      (filterScore === 'Medium' && score === 'MED') ||
      (filterScore === 'Low' && score === 'LOW'),
    [filterScore]
  );

  const matchesSearch = useCallback(
    (haystack: string) => {
      const q = searchTerm.trim().toLowerCase();
      return q === '' || haystack.toLowerCase().includes(q);
    },
    [searchTerm]
  );

  const filteredLeads = useMemo(() => {
    if (!showLeads) return [] as Lead[];
    let list = leads;
    if (filterPipeline === 'Active') {
      list = list.filter((l) => l.status !== 'BOOKED' && l.status !== 'REJECTED');
    } else if (filterPipeline === 'Booked') {
      list = list.filter((l) => l.status === 'BOOKED');
    } else if (filterPipeline === 'Rejected') {
      list = list.filter((l) => l.status === 'REJECTED');
    }
    return list
      .filter((l) => scoreMatches(l.score))
      .filter((l) =>
        matchesSearch(`${l.name} ${l.email ?? ''} ${l.eventType ?? ''} ${l.message ?? ''}`)
      );
  }, [leads, showLeads, filterPipeline, scoreMatches, matchesSearch]);

  const filteredInquiries = useMemo(() => {
    if (!showInquiries) return [] as Inquiry[];
    let list = inquiries;
    if (filterPipeline !== 'All') {
      list = list.filter((i) => inquiryPipeline(i.status) === filterPipeline);
    }
    return list
      .filter((i) => scoreMatches(i.score))
      .filter((i) =>
        matchesSearch(
          `${i.customerName ?? ''} ${i.customerEmail ?? ''} ${i.eventType ?? ''} ${i.message ?? ''}`
        )
      );
  }, [inquiries, showInquiries, filterPipeline, scoreMatches, matchesSearch]);

  // The one place the order is decided. Sorting a fresh array rather than in
  // place: the sources are the arrays held in the inbox hook's state, and
  // sorting those would mutate state React believes it owns.
  const inboxItems = useMemo<InboxItem[]>(() => {
    const items: InboxItem[] = [
      ...filteredInquiries.map(
        (inquiry): InboxItem => ({
          kind: 'inquiry',
          id: inquiry.id,
          createdAt: inquiry.createdAt,
          inquiry,
        })
      ),
      ...filteredLeads.map(
        (lead): InboxItem => ({ kind: 'lead', id: lead.id, createdAt: lead.createdAt, lead })
      ),
    ];
    const direction = sortOrder === 'newest' ? -1 : 1;
    return items.sort((a, b) => direction * (Date.parse(a.createdAt) - Date.parse(b.createdAt)));
  }, [filteredInquiries, filteredLeads, sortOrder]);

  return {
    sourceFilter,
    setSourceFilter,
    filterScore,
    setFilterScore,
    filterPipeline,
    setFilterPipeline,
    searchTerm,
    setSearchTerm,
    sortOrder,
    setSortOrder,
    pipelineCounts,
    inboxItems,
  };
}
