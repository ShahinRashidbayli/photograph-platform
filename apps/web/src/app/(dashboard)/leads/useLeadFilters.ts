'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Lead } from '@/types/api';
import type { LeadPipelineFilter, LeadScoreFilter } from './leadTypes';
import { type Inquiry, inquiryPipeline } from './inquiryTypes';

export type SourceFilter = 'all' | 'form' | 'customer';

export interface LeadFilters {
  sourceFilter: SourceFilter;
  setSourceFilter: (_v: SourceFilter) => void;
  filterScore: LeadScoreFilter;
  setFilterScore: (_v: LeadScoreFilter) => void;
  filterPipeline: LeadPipelineFilter;
  setFilterPipeline: (_v: LeadPipelineFilter) => void;
  searchTerm: string;
  setSearchTerm: (_v: string) => void;
  pipelineCounts: Record<LeadPipelineFilter, number>;
  filteredLeads: Lead[];
  filteredInquiries: Inquiry[];
}

/**
 * Owns the leads inbox filter state (source / score / pipeline / search) and
 * the lists derived from it. Extracted from the page so the component renders
 * from a single view-model rather than juggling filter state and five
 * interdependent memos inline.
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
    list = list.filter((l) => scoreMatches(l.score));
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter((l) => {
        const haystack =
          `${l.name} ${l.email ?? ''} ${l.eventType ?? ''} ${l.message ?? ''}`.toLowerCase();
        return haystack.includes(q);
      });
    }
    return list;
  }, [leads, showLeads, filterPipeline, scoreMatches, searchTerm]);

  const filteredInquiries = useMemo(() => {
    if (!showInquiries) return [] as Inquiry[];
    let list = inquiries;
    if (filterPipeline !== 'All') {
      list = list.filter((i) => inquiryPipeline(i.status) === filterPipeline);
    }
    list = list.filter((i) => scoreMatches(i.score));
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter((i) => {
        const haystack =
          `${i.customerName ?? ''} ${i.customerEmail ?? ''} ${i.eventType ?? ''} ${i.message ?? ''}`.toLowerCase();
        return haystack.includes(q);
      });
    }
    return list;
  }, [inquiries, showInquiries, filterPipeline, scoreMatches, searchTerm]);

  return {
    sourceFilter,
    setSourceFilter,
    filterScore,
    setFilterScore,
    filterPipeline,
    setFilterPipeline,
    searchTerm,
    setSearchTerm,
    pipelineCounts,
    filteredLeads,
    filteredInquiries,
  };
}
