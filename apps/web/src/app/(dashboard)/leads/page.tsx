'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useThemeStore } from '@/store/themeStore';
import api from '@/lib/api';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useTranslation } from '@/lib/i18n';
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
import { InquiryRow } from './InquiryRow';
import { InquiryDetail } from './InquiryDetail';
import { type Inquiry, inquiryPipeline } from './inquiryTypes';

type SourceFilter = 'all' | 'form' | 'customer';
type Selection = { kind: 'lead' | 'inquiry'; id: string };

/**
 * Renders a translated sentence with one segment in bold. The template carries
 * a placeholder (e.g. "Converted {name} to a booking.") which we split on, so
 * each language keeps its own word order — German puts the name first.
 */
function bold(template: string, placeholder: string, value: string) {
  const [before, after] = template.split(placeholder);
  return (
    <>
      {before}
      <strong>{value}</strong>
      {after}
    </>
  );
}

export default function LeadsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useThemeStore();
  const { t, tPlural } = useTranslation();
  const themeKey: LeadsTheme = theme === 'dark' ? 'dark' : 'light';
  const s = useMemo(() => getLeadsStyles(themeKey), [themeKey]);
  const c = useMemo(() => getLeadsColors(themeKey), [themeKey]);

  const [leads, setLeads] = useState<Lead[]>([]);
  // Customer inquiries share this inbox: same "someone wants to book me" job as
  // a lead, just from an authenticated customer rather than the anonymous form.
  // Kept as a separate list (different shape/actions) and merged only at render.
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [inquiryBusyId, setInquiryBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // A flag, not a message: the text is resolved at render so it follows a
  // language switch, and `loadLeads` stays independent of `t`.
  const [loadFailed, setLoadFailed] = useState(false);
  const [selected, setSelected] = useState<Selection | null>(null);
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
    setLoadFailed(false);
    // Both sources load together; the inbox needs them merged. Inquiries are
    // best-effort — a failure there shouldn't blank the whole leads inbox, so
    // only a leads failure trips the error panel.
    Promise.allSettled([
      api.get<Lead[]>('/api/leads'),
      api.get<Inquiry[]>('/api/inquiries?size=100'),
    ])
      .then(([leadsRes, inqRes]) => {
        if (leadsRes.status === 'fulfilled' && Array.isArray(leadsRes.value.data)) {
          setLeads(leadsRes.value.data);
        } else {
          setLoadFailed(true);
        }
        setInquiries(
          inqRes.status === 'fulfilled' && Array.isArray(inqRes.value.data) ? inqRes.value.data : [],
        );
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  // Deep-link (?selected=<leadId>) still targets a lead — existing links from
  // the dashboard point at lead ids.
  useEffect(() => {
    const sel = searchParams.get('selected');
    if (sel) setSelected({ kind: 'lead', id: sel });
  }, [searchParams]);

  // Counts for the pipeline tabs. Computed off the unfiltered list so the
  // numbers reflect the photographer's total pipeline, not the currently
  // visible subset — otherwise switching tabs would shuffle the counts and
  // hide useful information.
  const showLeads = sourceFilter !== 'customer';
  const showInquiries = sourceFilter !== 'form';

  // Pipeline counts span whichever sources are visible, so the tab numbers
  // match the merged inbox rather than leads alone.
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
      filterScore === 'All'
      || (filterScore === 'High' && score === 'HIGH')
      || (filterScore === 'Medium' && score === 'MED')
      || (filterScore === 'Low' && score === 'LOW'),
    [filterScore],
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
        const haystack = `${l.name} ${l.email ?? ''} ${l.eventType ?? ''} ${l.message ?? ''}`.toLowerCase();
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
        const haystack = `${i.customerName ?? ''} ${i.customerEmail ?? ''} ${i.eventType ?? ''} ${i.message ?? ''}`.toLowerCase();
        return haystack.includes(q);
      });
    }
    return list;
  }, [inquiries, showInquiries, filterPipeline, scoreMatches, searchTerm]);

  // Effective selection with fallback to the first visible row — customer
  // inquiries render first, so they win the default. Keeps the detail panel in
  // sync when a filter hides the previously-selected item.
  const effectiveSelected = useMemo<Selection | null>(() => {
    const visible: Selection[] = [
      ...filteredInquiries.map((i) => ({ kind: 'inquiry' as const, id: i.id })),
      ...filteredLeads.map((l) => ({ kind: 'lead' as const, id: l.id })),
    ];
    if (selected && visible.some((v) => v.kind === selected.kind && v.id === selected.id)) {
      return selected;
    }
    return visible[0] ?? null;
  }, [selected, filteredLeads, filteredInquiries]);

  const selectedLead = useMemo(
    () => (effectiveSelected?.kind === 'lead' ? leads.find((l) => l.id === effectiveSelected.id) ?? null : null),
    [effectiveSelected, leads],
  );
  const selectedInquiry = useMemo(
    () => (effectiveSelected?.kind === 'inquiry' ? inquiries.find((i) => i.id === effectiveSelected.id) ?? null : null),
    [effectiveSelected, inquiries],
  );

  const triageInquiry = useCallback(
    async (status: 'ACCEPTED' | 'REJECTED') => {
      if (!selectedInquiry) return;
      setInquiryBusyId(selectedInquiry.id);
      try {
        const { data } = await api.patch<Inquiry>(
          `/api/inquiries/${selectedInquiry.id}/status`,
          { status },
        );
        setInquiries((prev) => prev.map((i) => (i.id === data.id ? data : i)));
      } catch {
        // Stays silent on this surface — the user can re-click. Matches the
        // lead status handlers' error posture.
      } finally {
        setInquiryBusyId(null);
      }
    },
    [selectedInquiry],
  );

  // "Awaiting reply" counts unanswered items across both sources: NEW leads and
  // PENDING inquiries are the two "hasn't been triaged yet" states.
  const stats = useMemo(() => {
    const needsReply =
      leads.filter((l) => l.status === 'NEW').length
      + inquiries.filter((i) => i.status === 'PENDING').length;
    return { needsReply };
  }, [leads, inquiries]);

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
          <span>{bold(t('leads.converted'), '{name}', convertSuccess.leadName)}</span>
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
              {t('leads.viewInBookings')} →
            </button>
            <button
              type="button"
              aria-label={t('common.close')}
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
            setSelected({ kind: 'lead', id: created.id });
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
        title={t('leads.reject.title')}
        message={
          rejectingLead ? t('leads.reject.message', { name: rejectingLead.name }) : ''
        }
        confirmLabel={t('leads.reject.confirm')}
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
          <h1 style={s.pageTitle}>{t('leads.title')}</h1>
          <p style={s.pageSubtitle}>{t('leads.subtitle')}</p>
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
            aria-label={t('leads.exportAria')}
          >
            {t('leads.exportCsv')}
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
            + {t('leads.newLead')}
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
            {bold(
              t('leads.awaitingReply'),
              '{enquiries}',
              tPlural('leads.enquiryCount', stats.needsReply),
            )}
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
              {t('leads.review')} →
            </button>
          )}
        </div>
      )}

      {loadFailed ? (
        <div style={{ ...s.listPanel, maxHeight: 'none' }}>
          <div style={s.errorPanel}>
            <div style={s.errorPanelTitle}>{t('leads.errorTitle')}</div>
            <div style={s.errorPanelText}>{t('leads.errorLoad')}</div>
            <button type="button" style={s.retryButton} onClick={loadLeads}>
              {t('common.tryAgain')}
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
            {/* Source axis: leads (anonymous form) vs customer inquiries. Only
                shown when both sources actually have entries — a photographer
                with no inquiries yet shouldn't see an empty toggle. */}
            {inquiries.length > 0 && (
              <div style={{ display: 'inline-flex', gap: 2, padding: 2, borderRadius: 10, border: `1px solid ${c.border}`, background: c.surface, marginBottom: 10 }}>
                {(['all', 'form', 'customer'] as const).map((sf) => {
                  const active = sourceFilter === sf;
                  return (
                    <button
                      key={sf}
                      type="button"
                      onClick={() => setSourceFilter(sf)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 8,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background: active ? c.primaryBg : 'transparent',
                        color: active ? c.primaryText : c.textMuted,
                      }}
                    >
                      {sf === 'all'
                        ? t('leads.source.all')
                        : sf === 'form'
                          ? t('leads.source.form')
                          : t('leads.source.customer')}
                    </button>
                  );
                })}
              </div>
            )}

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
              ) : leads.length === 0 && inquiries.length === 0 ? (
                <div style={s.emptyState}>
                  <div style={{ color: c.text, fontWeight: 600 }}>{t('leads.empty.noneTitle')}</div>
                  <div>{t('leads.empty.noneBody')}</div>
                </div>
              ) : filteredLeads.length === 0 && filteredInquiries.length === 0 ? (
                <div style={s.emptyState}>
                  <div style={{ color: c.text, fontWeight: 600 }}>{t('leads.empty.noMatchTitle')}</div>
                  {/* If the Active view is empty but there ARE resolved leads
                      sitting in Booked/Rejected, surface that explicitly —
                      otherwise the photographer wonders "where did my leads
                      go?" after the first conversion. */}
                  {filterPipeline === 'Active' &&
                  pipelineCounts.Booked + pipelineCounts.Rejected > 0 ? (
                    <div>
                      {pipelineCounts.Rejected > 0
                        ? t('leads.empty.allResolvedBoth', {
                            booked: String(pipelineCounts.Booked),
                            rejected: String(pipelineCounts.Rejected),
                          })
                        : t('leads.empty.allResolvedBooked', {
                            booked: String(pipelineCounts.Booked),
                          })}
                    </div>
                  ) : (
                    <div>{t('common.tryOtherFilter')}</div>
                  )}
                </div>
              ) : (
                <>
                  {filteredInquiries.map((inq) => (
                    <InquiryRow
                      key={`inq-${inq.id}`}
                      inquiry={inq}
                      isActive={effectiveSelected?.kind === 'inquiry' && effectiveSelected.id === inq.id}
                      isHovered={hoveredId === inq.id}
                      onSelect={() => setSelected({ kind: 'inquiry', id: inq.id })}
                      onHover={(hov) => setHoveredId(hov ? inq.id : null)}
                      s={s}
                      c={c}
                    />
                  ))}
                  {filteredLeads.map((lead) => (
                    <LeadListItem
                      key={lead.id}
                      lead={lead}
                      isActive={effectiveSelected?.kind === 'lead' && effectiveSelected.id === lead.id}
                      isHovered={hoveredId === lead.id}
                      onSelect={() => setSelected({ kind: 'lead', id: lead.id })}
                      onHover={(hov) => setHoveredId(hov ? lead.id : null)}
                      s={s}
                      c={c}
                    />
                  ))}
                </>
              )}
            </div>
          </div>

          <div style={s.detailPanel}>
            {loading ? (
              <div style={s.emptyState}>{t('leads.loadingDetails')}</div>
            ) : selectedInquiry ? (
              <InquiryDetail
                inquiry={selectedInquiry}
                c={c}
                busy={inquiryBusyId === selectedInquiry.id}
                onTriage={triageInquiry}
              />
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
