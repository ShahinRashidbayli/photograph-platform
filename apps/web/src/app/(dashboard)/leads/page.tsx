'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useThemeStore } from '@/store/themeStore';
import api from '@/lib/api';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Lead } from '@/types/api';
import {
  getLeadsColors,
  getLeadsStyles,
  type LeadsTheme,
} from './leads.styles';
import type { LeadPipelineFilter, LeadScoreFilter } from './leadTypes';
import { FilterBar } from './FilterBar';
import { LeadListItem } from './LeadListItem';
import { LeadDetail } from './LeadDetail';
import { LeadListSkeleton } from './LeadListSkeleton';
import { AddLeadModal } from './AddLeadModal';
import { ConvertLeadModal } from './ConvertLeadModal';
import { EditNoteModal } from './EditNoteModal';

export default function LeadsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useThemeStore();
  const themeKey: LeadsTheme = theme === 'dark' ? 'dark' : 'light';
  const s = useMemo(() => getLeadsStyles(themeKey), [themeKey]);
  const c = useMemo(() => getLeadsColors(themeKey), [themeKey]);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [filterScore, setFilterScore] = useState<LeadScoreFilter>('All');
  // Default to Active so the inbox shows only enquiries the photographer can
  // still act on (NEW + REPLIED). Converted and rejected leads are one click
  // away via the pipeline tabs, but they don't clutter the daily working view.
  const [filterPipeline, setFilterPipeline] = useState<LeadPipelineFilter>('Active');
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // Conversion modal state — keeping the whole Lead (not just the id) means
  // the modal keeps rendering its previous content for the brief moment
  // between submit success and reload, instead of flashing empty.
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  // Banner shown after a successful conversion. Auto-dismisses after 6s but
  // also offers a manual close + a deep-link into bookings.
  const [convertSuccess, setConvertSuccess] = useState<
    { bookingId: string; leadName: string } | null
  >(null);
  // Add-lead modal for off-platform enquiries (phone, WhatsApp, walk-in).
  const [addOpen, setAddOpen] = useState(false);
  // Reject confirmation: holding the whole Lead keeps the prompt text stable
  // while the request is in flight, even if the active selection moves.
  const [rejectingLead, setRejectingLead] = useState<Lead | null>(null);
  const [rejectBusy, setRejectBusy] = useState(false);
  // Add/edit-note modal — same holding-the-lead pattern as reject so the
  // prompt body stays correct while the PATCH is in flight.
  const [notingLead, setNotingLead] = useState<Lead | null>(null);

  const loadLeads = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get<Lead[]>('/api/leads')
      .then((res) => {
        setLeads(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        setError('We couldn’t load your leads. Please check your connection and try again.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    const selected = searchParams.get('selected');
    if (selected) {
      setSelectedLeadId(selected);
    } else if (!selectedLeadId && leads.length > 0) {
      setSelectedLeadId(leads[0]?.id || null);
    }
  }, [searchParams, selectedLeadId, leads]);

  // Counts for the pipeline tabs. Computed off the unfiltered list so the
  // numbers reflect the photographer's total pipeline, not the currently
  // visible subset — otherwise switching tabs would shuffle the counts and
  // hide useful information.
  const pipelineCounts = useMemo<Record<LeadPipelineFilter, number>>(() => {
    let active = 0;
    let booked = 0;
    let rejected = 0;
    for (const l of leads) {
      if (l.status === 'BOOKED') booked++;
      else if (l.status === 'REJECTED') rejected++;
      else active++; // NEW + REPLIED + any future "in-flight" status
    }
    return { Active: active, Booked: booked, Rejected: rejected, All: leads.length };
  }, [leads]);

  const filteredLeads = useMemo(() => {
    let list = leads;

    // Pipeline filter first (primary axis). "All" passes through.
    if (filterPipeline === 'Active') {
      list = list.filter((l) => l.status !== 'BOOKED' && l.status !== 'REJECTED');
    } else if (filterPipeline === 'Booked') {
      list = list.filter((l) => l.status === 'BOOKED');
    } else if (filterPipeline === 'Rejected') {
      list = list.filter((l) => l.status === 'REJECTED');
    }

    // Score filter (secondary axis within the current pipeline view).
    if (filterScore === 'High') list = list.filter((l) => l.score === 'HIGH');
    else if (filterScore === 'Medium') list = list.filter((l) => l.score === 'MED');
    else if (filterScore === 'Low') list = list.filter((l) => l.score === 'LOW');

    const q = searchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter((l) => {
        const haystack = `${l.name} ${l.email ?? ''} ${l.eventType ?? ''} ${l.message ?? ''}`.toLowerCase();
        return haystack.includes(q);
      });
    }
    return list;
  }, [leads, filterPipeline, filterScore, searchTerm]);

  const selectedLead = useMemo(
    () => filteredLeads.find((l) => l.id === selectedLeadId) || filteredLeads[0] || null,
    [filteredLeads, selectedLeadId],
  );

  const stats = useMemo(() => {
    const total = leads.length;
    const high = leads.filter((l) => l.score === 'HIGH').length;
    const needsReply = leads.filter((l) => l.status === 'NEW').length;
    const conversionRate = total > 0 ? Math.round((high / total) * 100) : 0;
    return { total, high, needsReply, conversionRate };
  }, [leads]);

  // Auto-dismiss the success banner after 6 seconds. Cleanup on unmount /
  // re-entry so we don't fire setState into a banner the user already closed.
  useEffect(() => {
    if (!convertSuccess) return;
    const t = setTimeout(() => setConvertSuccess(null), 6000);
    return () => clearTimeout(t);
  }, [convertSuccess]);

  return (
    <div style={s.pageWrapper}>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>

      {convertSuccess && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '12px 16px',
            marginBottom: '16px',
            borderRadius: '12px',
            background: c.successBg,
            color: c.successText,
            border: `1px solid ${c.successBorder}`,
            fontSize: '0.9rem',
            fontWeight: 600,
          }}
        >
          <span>
            Converted <strong>{convertSuccess.leadName}</strong> to a booking.
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={() => router.push('/bookings')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              View in Bookings →
            </button>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setConvertSuccess(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                fontSize: '1.1rem',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </span>
        </div>
      )}

      {convertingLead && (
        <ConvertLeadModal
          lead={convertingLead}
          c={c}
          onClose={() => setConvertingLead(null)}
          onConverted={(booking) => {
            const lead = convertingLead;
            setConvertingLead(null);
            setConvertSuccess({ bookingId: booking.id, leadName: lead.name });
            loadLeads();
          }}
        />
      )}

      {addOpen && (
        <AddLeadModal
          c={c}
          onClose={() => setAddOpen(false)}
          onCreated={(created) => {
            setAddOpen(false);
            // Reload + select the newly-created lead so the photographer
            // sees it in the detail panel without hunting through the list.
            loadLeads();
            setSelectedLeadId(created.id);
          }}
        />
      )}

      {notingLead && (
        <EditNoteModal
          lead={notingLead}
          c={c}
          onClose={() => setNotingLead(null)}
          onSaved={(updated) => {
            // Patch the lead in place so the detail panel reflects the new
            // note immediately (without a full list reload — which would
            // briefly flash a loading state for no good reason).
            setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
            setNotingLead(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!rejectingLead}
        theme={themeKey === 'dark' ? 'dark' : 'light'}
        title="Reject this lead?"
        message={
          rejectingLead
            ? `${rejectingLead.name}'s enquiry will be moved to Rejected. They won't be notified automatically. You can still see it in the Rejected tab.`
            : ''
        }
        confirmLabel="Reject lead"
        tone="danger"
        busy={rejectBusy}
        onCancel={() => !rejectBusy && setRejectingLead(null)}
        onConfirm={async () => {
          if (!rejectingLead) return;
          setRejectBusy(true);
          try {
            await api.patch<Lead>(
              `/api/leads/${rejectingLead.id}/status`,
              { status: 'REJECTED' },
            );
            setRejectingLead(null);
            loadLeads();
          } catch {
            // Errors surface in dev console; the dialog stays open so the
            // user can retry. A proper toast/error surface for this would
            // be a follow-up polish.
          } finally {
            setRejectBusy(false);
          }
        }}
      />

      <div
        style={{
          ...s.pageHeader,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1 style={s.pageTitle}>Leads</h1>
          <p style={s.pageSubtitle}>
            Qualify enquiries, track priorities, and convert prospects into bookings.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Export uses a plain anchor to /api/leads/export.csv — the
              browser sends the session cookie automatically, the backend
              sets Content-Disposition: attachment, and we get a real "Save
              file…" dialog without any blob/file-saver shim. */}
          <a
            href="/api/leads/export.csv"
            style={{
              padding: '8px 14px',
              border: `1px solid ${c.border}`,
              borderRadius: '8px',
              background: c.surface,
              color: c.text,
              fontSize: '0.85rem',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            aria-label="Export all leads as CSV"
          >
            Export CSV
          </a>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '8px',
              background: c.primarySolid,
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + New lead
          </button>
        </div>
      </div>

      {/* The full stats grid (Total / High priority / Needs action) lived
          here previously. It's been removed: "Total" duplicates the All
          pipeline tab count below, the score breakdown is one click away via
          the Score dropdown, and "Needs action" is now a contextual alert
          rendered only when the count is non-zero. The Overview page is the
          right home for at-a-glance metrics; this page is for working on
          leads, and recovering ~180px of vertical chrome puts the actual list
          and detail panel above the fold on a laptop. */}
      {stats.needsReply > 0 && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 16px',
            marginBottom: '16px',
            borderRadius: '10px',
            background: c.warningBg,
            color: c.warningText,
            border: `1px solid ${c.warningBorder}`,
            fontSize: '0.88rem',
            fontWeight: 600,
          }}
        >
          <span>
            <strong>
              {stats.needsReply === 1
                ? '1 enquiry'
                : `${stats.needsReply} enquiries`}
            </strong>{' '}
            awaiting your reply.
          </span>
          {/* Surface the action: jump them straight to the Active tab with
              search cleared so they can deal with it. */}
          {filterPipeline !== 'Active' && (
            <button
              type="button"
              onClick={() => {
                setFilterPipeline('Active');
                setSearchTerm('');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Review →
            </button>
          )}
        </div>
      )}

      {error ? (
        <div style={{ ...s.listPanel, maxHeight: 'none' }}>
          <div style={s.errorPanel}>
            <div style={s.errorPanelTitle}>Couldn&apos;t load leads</div>
            <div style={s.errorPanelText}>{error}</div>
            <button type="button" style={s.retryButton} onClick={loadLeads}>
              Try again
            </button>
          </div>
        </div>
      ) : (
        <div style={s.container}>
          <div style={s.listPanel}>
            {/* Compact filter bar — replaces the previous title + subtitle +
                separate search row + two filter rows (each adding 40px of
                fixed chrome). Pipeline is the primary axis (segmented
                control); score and search are inline next to it. Net effect:
                ~90px of vertical recovered, single visual unit. */}
            <FilterBar
              c={c}
              filterPipeline={filterPipeline}
              setFilterPipeline={setFilterPipeline}
              filterScore={filterScore}
              setFilterScore={setFilterScore}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              pipelineCounts={pipelineCounts}
            />

            <div style={s.listScroll}>
              {loading ? (
                <LeadListSkeleton s={s} />
              ) : leads.length === 0 ? (
                <div style={s.emptyState}>
                  <div style={{ color: c.text, fontWeight: 600 }}>No leads yet</div>
                  <div>New enquiries from your public booking page will appear here automatically.</div>
                </div>
              ) : filteredLeads.length === 0 ? (
                <div style={s.emptyState}>
                  <div style={{ color: c.text, fontWeight: 600 }}>No leads match</div>
                  {/* If the Active view is empty but there ARE resolved leads
                      sitting in Booked/Rejected, surface that explicitly —
                      otherwise the photographer wonders "where did my leads
                      go?" after the first conversion. */}
                  {filterPipeline === 'Active' &&
                  pipelineCounts.Booked + pipelineCounts.Rejected > 0 ? (
                    <div>
                      All your leads are in <strong>Booked</strong> ({pipelineCounts.Booked})
                      {pipelineCounts.Rejected > 0
                        ? <> or <strong>Rejected</strong> ({pipelineCounts.Rejected})</>
                        : null}
                      . Switch tabs to see them.
                    </div>
                  ) : (
                    <div>Try a different filter or search term.</div>
                  )}
                </div>
              ) : (
                filteredLeads.map((lead) => (
                  <LeadListItem
                    key={lead.id}
                    lead={lead}
                    isActive={selectedLead?.id === lead.id}
                    isHovered={hoveredId === lead.id}
                    onSelect={() => setSelectedLeadId(lead.id)}
                    onHover={(hov) => setHoveredId(hov ? lead.id : null)}
                    s={s}
                    c={c}
                  />
                ))
              )}
            </div>
          </div>

          <div style={s.detailPanel}>
            {loading ? (
              <div style={s.emptyState}>Loading lead details…</div>
            ) : (
              <LeadDetail
                lead={selectedLead}
                s={s}
                c={c}
                onConvert={() => selectedLead && setConvertingLead(selectedLead)}
                onViewBooking={() => router.push('/bookings')}
                onReject={() => selectedLead && setRejectingLead(selectedLead)}
                onAddNote={() => selectedLead && setNotingLead(selectedLead)}
                onMarkReplied={async () => {
                  if (!selectedLead) return;
                  try {
                    const res = await api.patch<Lead>(
                      `/api/leads/${selectedLead.id}/status`,
                      { status: 'REPLIED' },
                    );
                    // Patch the lead in place — full reload would briefly
                    // flash a loading state for a single-field flip.
                    setLeads((prev) => prev.map((l) => (l.id === res.data.id ? res.data : l)));
                  } catch {
                    // Failure stays silent on this surface — the user can
                    // re-click. A real toast/error surface would be polish
                    // worth doing later but isn't blocking the feature.
                  }
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
