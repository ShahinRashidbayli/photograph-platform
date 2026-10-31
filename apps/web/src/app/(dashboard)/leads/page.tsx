'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useThemeStore } from '@/store/themeStore';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useTranslation } from '@/lib/i18n';
import { asyncErrorText } from '@/lib/async-error';
import { useInquiries, useLeads } from '@/hooks/useLeads';
import type { Lead } from '@/types/api';
import { getLeadsColors, getLeadsStyles, type LeadsTheme } from './leads.styles';
import { FilterBar } from './FilterBar';
import { LeadListItem } from './LeadListItem';
import { LeadDetail } from './LeadDetail';
import { LeadListSkeleton } from './LeadListSkeleton';
import { AddLeadModal } from './AddLeadModal';
import { ConvertLeadModal } from './ConvertLeadModal';
import { EditNoteModal } from './EditNoteModal';
import { InquiryRow } from './InquiryRow';
import { InquiryDetail } from './InquiryDetail';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { MobilePaneBack } from '@/components/MobilePaneBack';
import { useLeadFilters } from './useLeadFilters';
import { useLeadActions } from './useLeadActions';
import type { Inquiry } from './inquiryTypes';

type Selection = { kind: 'lead' | 'inquiry'; id: string };

/** Stable while a query has no data, so the filters below do not recompute every render. */
const NO_LEADS: Lead[] = [];
const NO_INQUIRIES: Inquiry[] = [];

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

function LeadsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useThemeStore();
  const { t, tPlural } = useTranslation();
  const themeKey: LeadsTheme = theme === 'dark' ? 'dark' : 'light';
  const s = useMemo(() => getLeadsStyles(themeKey), [themeKey]);
  const c = useMemo(() => getLeadsColors(themeKey), [themeKey]);

  // Data, filtering and mutations each live in a focused hook; the component
  // below is render + selection only.
  const leadsQuery = useLeads();
  // Best-effort: a failure here reads as "no inquiries" (see useInquiries), so
  // only the leads can fail the inbox.
  const inquiriesQuery = useInquiries();
  const leads = leadsQuery.data ?? NO_LEADS;
  const inquiries = inquiriesQuery.data ?? NO_INQUIRIES;
  const loading = leadsQuery.isLoading || inquiriesQuery.isLoading;
  const loadFailed = leadsQuery.isError && !leadsQuery.data;
  const reload = () => {
    void leadsQuery.refetch();
    void inquiriesQuery.refetch();
  };
  const {
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
  } = useLeadFilters(leads, inquiries);

  const [selected, setSelected] = useState<Selection | null>(null);

  // Below this width the 380px master column plus a detail pane leaves neither
  // usable, so the two become separate views with a back affordance — the same
  // treatment Bookings already had. This screen is the reason it matters most:
  // ROADMAP §4.5 has the photographer triaging Instagram leads on a phone.
  const isNarrow = useMediaQuery('(max-width: 900px)');
  const [mobilePane, setMobilePane] = useState<'list' | 'detail'>('list');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Deep-link (?selected=<leadId>) still targets a lead — existing links from
  // the dashboard point at lead ids.
  useEffect(() => {
    const sel = searchParams.get('selected');
    if (sel) setSelected({ kind: 'lead', id: sel });
  }, [searchParams]);

  // Effective selection with fallback to the first visible row — whichever
  // source that row happens to come from, since the inbox is one date-ordered
  // list. Keeps the detail panel in sync when a filter hides the
  // previously-selected item.
  const effectiveSelected = useMemo<Selection | null>(() => {
    if (selected && inboxItems.some((i) => i.kind === selected.kind && i.id === selected.id)) {
      return selected;
    }
    const first = inboxItems[0];
    return first ? { kind: first.kind, id: first.id } : null;
  }, [selected, inboxItems]);

  const selectedLead = useMemo(
    () =>
      effectiveSelected?.kind === 'lead'
        ? (leads.find((l) => l.id === effectiveSelected.id) ?? null)
        : null,
    [effectiveSelected, leads]
  );
  const selectedInquiry = useMemo(
    () =>
      effectiveSelected?.kind === 'inquiry'
        ? (inquiries.find((i) => i.id === effectiveSelected.id) ?? null)
        : null,
    [effectiveSelected, inquiries]
  );

  const {
    convertingLead,
    startConvert,
    cancelConvert,
    applyConverted,
    convertSuccess,
    dismissConvertSuccess,
    addOpen,
    openAdd,
    closeAdd,
    notingLead,
    startNote,
    cancelNote,
    rejectingLead,
    startReject,
    cancelReject,
    rejectBusy,
    confirmReject,
    inquiryBusyId,
    triageInquiry,
    markSelectedReplied,
    actionError,
    dismissActionError,
  } = useLeadActions({ selectedLead, selectedInquiry });

  // "Awaiting reply" counts unanswered items across both sources: NEW leads and
  // PENDING inquiries are the two "hasn't been triaged yet" states.
  const stats = useMemo(() => {
    const needsReply =
      leads.filter((l) => l.status === 'NEW').length +
      inquiries.filter((i) => i.status === 'PENDING').length;
    return { needsReply };
  }, [leads, inquiries]);

  return (
    <div style={s.pageWrapper}>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>

      {actionError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '12px 16px',
            marginBottom: '16px',
            borderRadius: '12px',
            background: c.dangerBg,
            color: c.dangerText,
            border: `1px solid ${c.dangerBorder}`,
            fontSize: '0.9rem',
            fontWeight: 600,
          }}
        >
          <span>{asyncErrorText(actionError, t)}</span>
          <button
            type="button"
            aria-label={t('common.close')}
            onClick={dismissActionError}
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
        </div>
      )}

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
              onClick={dismissConvertSuccess}
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
          onClose={cancelConvert}
          onConverted={applyConverted}
        />
      )}

      {addOpen && (
        <AddLeadModal
          c={c}
          onClose={closeAdd}
          onCreated={(created) => {
            closeAdd();
            // Select the new lead so the photographer sees it in the detail
            // panel without hunting through the list — useCreateLead has
            // already re-read the inbox it lands in.
            setSelected({ kind: 'lead', id: created.id });
          }}
        />
      )}

      {notingLead && (
        <EditNoteModal lead={notingLead} c={c} onClose={cancelNote} onSaved={cancelNote} />
      )}

      <ConfirmDialog
        open={!!rejectingLead}
        theme={themeKey === 'dark' ? 'dark' : 'light'}
        title={t('leads.reject.title')}
        message={rejectingLead ? t('leads.reject.message', { name: rejectingLead.name }) : ''}
        confirmLabel={t('leads.reject.confirm')}
        tone="danger"
        busy={rejectBusy}
        onCancel={() => !rejectBusy && cancelReject()}
        onConfirm={confirmReject}
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
            onClick={openAdd}
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
              '{leads}',
              tPlural('leads.leadCount', stats.needsReply)
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
            <button type="button" style={s.retryButton} onClick={reload}>
              {t('common.tryAgain')}
            </button>
          </div>
        </div>
      ) : (
        <div style={s.container}>
          <div
            style={{
              ...s.listPanel,
              ...(isNarrow && mobilePane === 'detail' ? { display: 'none' } : {}),
            }}
          >
            {/* Compact filter bar — pipeline tabs, search + Filter popover, and a
                results strip showing what is applied. Source (form vs customer)
                used to be its own segmented control here; it moved into the
                popover so the panel opens on the list rather than on two rows
                of filter chrome. */}
            <FilterBar
              c={c}
              filterPipeline={filterPipeline}
              setFilterPipeline={setFilterPipeline}
              filterScore={filterScore}
              setFilterScore={setFilterScore}
              sourceFilter={sourceFilter}
              setSourceFilter={setSourceFilter}
              showSourceFilter={inquiries.length > 0}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              pipelineCounts={pipelineCounts}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              resultCount={inboxItems.length}
              loading={loading}
            />

            <div style={s.listScroll}>
              {loading ? (
                <LeadListSkeleton s={s} />
              ) : leads.length === 0 && inquiries.length === 0 ? (
                <div style={s.emptyState}>
                  <div style={{ color: c.text, fontWeight: 600 }}>{t('leads.empty.noneTitle')}</div>
                  <div>{t('leads.empty.noneBody')}</div>
                </div>
              ) : inboxItems.length === 0 ? (
                <div style={s.emptyState}>
                  <div style={{ color: c.text, fontWeight: 600 }}>
                    {t('leads.empty.noMatchTitle')}
                  </div>
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
                inboxItems.map((item) => {
                  const isActive =
                    effectiveSelected?.kind === item.kind && effectiveSelected.id === item.id;
                  const onSelect = () => {
                    setSelected({ kind: item.kind, id: item.id });
                    if (isNarrow) setMobilePane('detail');
                  };
                  const onHover = (hov: boolean) => setHoveredId(hov ? item.id : null);
                  return item.kind === 'inquiry' ? (
                    <InquiryRow
                      key={`inq-${item.id}`}
                      inquiry={item.inquiry}
                      isActive={isActive}
                      isHovered={hoveredId === item.id}
                      onSelect={onSelect}
                      onHover={onHover}
                      s={s}
                      c={c}
                    />
                  ) : (
                    <LeadListItem
                      key={`lead-${item.id}`}
                      lead={item.lead}
                      isActive={isActive}
                      isHovered={hoveredId === item.id}
                      onSelect={onSelect}
                      onHover={onHover}
                      s={s}
                      c={c}
                    />
                  );
                })
              )}
            </div>
          </div>

          <div
            style={{
              ...s.detailPanel,
              ...(isNarrow && mobilePane === 'list' ? { display: 'none' } : {}),
            }}
          >
            {isNarrow && (
              <div style={{ padding: '16px 20px 0' }}>
                <MobilePaneBack
                  label={t('leads.backToList')}
                  style={s.backButton}
                  onClick={() => setMobilePane('list')}
                />
              </div>
            )}
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
                onConvert={() => selectedLead && startConvert(selectedLead)}
                onViewBooking={() => router.push('/bookings')}
                onReject={() => selectedLead && startReject(selectedLead)}
                onAddNote={() => selectedLead && startNote(selectedLead)}
                onMarkReplied={markSelectedReplied}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * `useSearchParams` needs a Suspense boundary in the app router — without one
 * the whole route bails out of prerendering and the build fails.
 */
export default function LeadsPage() {
  return (
    <Suspense fallback={null}>
      <LeadsView />
    </Suspense>
  );
}
