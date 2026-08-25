import React, { useEffect, useRef, useState } from 'react';
import { useTranslation, type TranslationKey } from '@/lib/i18n';
import type { ColorTokens, LeadPipelineFilter, LeadScoreFilter } from './leadTypes';
import type { LeadSortOrder, SourceFilter } from './useLeadFilters';

const PIPELINE_LABEL_KEY: Record<LeadPipelineFilter, TranslationKey> = {
  Active: 'leads.pipeline.Active',
  Booked: 'leads.pipeline.Booked',
  Rejected: 'leads.pipeline.Rejected',
  All: 'leads.pipeline.All',
};

const SCORE_OPTIONS: ReadonlyArray<[LeadScoreFilter, TranslationKey]> = [
  ['All', 'leads.score.all'],
  ['High', 'leadScore.HIGH'],
  ['Medium', 'leadScore.MED'],
  ['Low', 'leadScore.LOW'],
];

const SOURCE_OPTIONS: ReadonlyArray<[SourceFilter, TranslationKey]> = [
  ['all', 'leads.source.all'],
  ['form', 'leads.source.form'],
  ['customer', 'leads.source.customer'],
];

function SearchIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function FunnelIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 5h18l-7 8v6l-4 2v-8z" />
    </svg>
  );
}

/**
 * Compact filter bar for the leads list panel.
 *
 * <p>Three stacked rows, in decreasing order of importance:
 * pipeline segmented control → search + Filter button → results strip.
 *
 * <p>The secondary axes (score, source) used to sit in the bar itself — a
 * dropdown next to the search box and a segmented control above it. Both are
 * now behind one "Filter" button carrying a count badge, which keeps the bar
 * to a single line of chrome and, more importantly, makes an applied filter
 * *visible*: whatever is active comes back as a removable chip in the strip
 * below, so a photographer wondering "where are my leads?" can see the reason
 * and clear it in one click rather than re-opening a dropdown to check.
 */
export function FilterBar({
  c,
  filterPipeline,
  setFilterPipeline,
  filterScore,
  setFilterScore,
  sourceFilter,
  setSourceFilter,
  showSourceFilter,
  searchTerm,
  setSearchTerm,
  pipelineCounts,
  sortOrder,
  setSortOrder,
  resultCount,
  loading,
}: Readonly<{
  c: ColorTokens;
  filterPipeline: LeadPipelineFilter;
  setFilterPipeline: (_p: LeadPipelineFilter) => void;
  filterScore: LeadScoreFilter;
  setFilterScore: (_s: LeadScoreFilter) => void;
  sourceFilter: SourceFilter;
  setSourceFilter: (_v: SourceFilter) => void;
  showSourceFilter: boolean;
  searchTerm: string;
  setSearchTerm: (_q: string) => void;
  pipelineCounts: Record<LeadPipelineFilter, number>;
  sortOrder: LeadSortOrder;
  setSortOrder: (_o: LeadSortOrder) => void;
  resultCount: number;
  /** While the inbox is still loading every count is 0 — which is a claim, not
   *  a placeholder. The bar renders without numbers until the data lands. */
  loading?: boolean;
}>) {
  const { t, tPlural } = useTranslation();
  const [searchFocused, setSearchFocused] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Only the popover's axes count towards the badge — the search term gets its
  // own chip and is already visible in the input, so counting it would make the
  // badge tick up for something the photographer can plainly see.
  const activeFilters = (filterScore !== 'All' ? 1 : 0) + (sourceFilter !== 'all' ? 1 : 0);

  // Dismiss on outside click / Escape. The ref wraps button + popover so a
  // click on the button itself doesn't count as "outside" and immediately
  // re-close what the click just opened.
  //
  // `role="dialog"` is a promise that this is where you are now, so opening
  // moves focus into the panel and Escape hands it back to the trigger.
  // Focusing the container rather than the first option keeps a mouse user
  // from getting a focus ring on a score they did not pick, while still giving
  // a keyboard user somewhere to Tab from.
  useEffect(() => {
    if (!filterOpen) return;
    popoverRef.current?.focus();
    const onPointerDown = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setFilterOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [filterOpen]);

  const segmented: React.CSSProperties = {
    display: 'inline-flex',
    padding: '4px',
    borderRadius: '12px',
    background: c.surfaceAlt,
    border: `1px solid ${c.border}`,
    gap: '2px',
    width: '100%',
  };
  const segmentBtn = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '8px 8px',
    border: `1px solid ${active ? c.border : 'transparent'}`,
    borderRadius: '9px',
    background: active ? c.surface : 'transparent',
    color: active ? c.text : c.textMuted,
    fontSize: '0.82rem',
    fontWeight: active ? 700 : 600,
    cursor: 'pointer',
    boxShadow: active ? c.overlayShadow : 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    whiteSpace: 'nowrap',
  });
  const controlHeight = 42;
  const search: React.CSSProperties = {
    height: `${controlHeight}px`,
    padding: searchTerm ? '0 34px 0 36px' : '0 12px 0 36px',
    border: `1px solid ${searchFocused ? c.primaryBorder : c.border}`,
    borderRadius: '10px',
    background: c.surfaceAlt,
    color: c.text,
    fontSize: '0.88rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    boxShadow: searchFocused ? `0 0 0 3px ${c.primaryBg}` : 'none',
    transition: 'border-color 120ms ease, box-shadow 120ms ease',
  };
  const filterBtn: React.CSSProperties = {
    height: `${controlHeight}px`,
    padding: '0 14px',
    border: `1px solid ${filterOpen || activeFilters > 0 ? c.primaryBorder : c.border}`,
    borderRadius: '10px',
    background: activeFilters > 0 ? c.primaryBg : c.surfaceAlt,
    color: activeFilters > 0 ? c.primaryText : c.text,
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };
  const optionBtn = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    width: '100%',
    padding: '7px 9px',
    border: 'none',
    borderRadius: '8px',
    background: active ? c.primaryBg : 'transparent',
    color: active ? c.primaryText : c.text,
    fontSize: '0.83rem',
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    textAlign: 'left',
  });
  const popoverLabel: React.CSSProperties = {
    fontSize: '0.68rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: c.textSubtle,
    padding: '0 9px 4px',
  };
  const chip: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 4px 3px 9px',
    borderRadius: '999px',
    background: c.primaryBg,
    border: `1px solid ${c.primaryBorder}`,
    color: c.primaryText,
    fontSize: '0.75rem',
    fontWeight: 600,
    maxWidth: '100%',
  };
  const chipClose: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    borderRadius: '999px',
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    fontSize: '0.85rem',
    lineHeight: 1,
    padding: 0,
  };

  const scoreLabelKey = SCORE_OPTIONS.find(([v]) => v === filterScore)?.[1];
  const sourceLabelKey = SOURCE_OPTIONS.find(([v]) => v === sourceFilter)?.[1];
  const hasChips = searchTerm.trim() !== '' || filterScore !== 'All' || sourceFilter !== 'all';

  return (
    <div style={{ borderBottom: `1px solid ${c.divider}` }}>
      <div
        style={{
          padding: '16px 16px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {/* Pipeline segmented control. Macro-OS-style: subtle filled active
            state inside a single container, not a row of outlined buttons. */}
        <div style={segmented} role="tablist" aria-label={t('leads.filter.aria')}>
          {(['Active', 'Booked', 'Rejected', 'All'] as LeadPipelineFilter[]).map((stage) => {
            const active = filterPipeline === stage;
            return (
              <button
                key={stage}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilterPipeline(stage)}
                style={segmentBtn(active)}
              >
                {t(PIPELINE_LABEL_KEY[stage])}
                {/* Not aria-hidden: the count is half the answer to "which tab
                    do I want", and hiding it left a screen-reader user with
                    four indistinguishable stage names. */}
                {!loading && (
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      color: active ? c.textMuted : c.textSubtle,
                    }}
                  >
                    {pipelineCounts[stage]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search carries the row; everything else is one button away. */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <span
              aria-hidden
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: searchFocused ? c.primaryText : c.textSubtle,
                display: 'inline-flex',
                pointerEvents: 'none',
              }}
            >
              <SearchIcon />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder={t('leads.search.placeholder')}
              style={search}
              aria-label={t('leads.search.aria')}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label={t('leads.search.clear')}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '20px',
                  height: '20px',
                  borderRadius: '999px',
                  border: 'none',
                  background: c.neutralBg,
                  color: c.textMuted,
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  lineHeight: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
              >
                ×
              </button>
            )}
          </label>

          <div ref={filterRef} style={{ position: 'relative' }}>
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setFilterOpen((open) => !open)}
              style={filterBtn}
              aria-haspopup="dialog"
              aria-expanded={filterOpen}
              aria-label={t('leads.filter.openAria')}
            >
              <FunnelIcon />
              {t('leads.filter.button')}
              {activeFilters > 0 && (
                <span
                  aria-hidden
                  style={{
                    minWidth: '18px',
                    height: '18px',
                    padding: '0 5px',
                    borderRadius: '999px',
                    background: c.primarySolid,
                    color: '#fff',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxSizing: 'border-box',
                  }}
                >
                  {activeFilters}
                </span>
              )}
            </button>

            {filterOpen && (
              <div
                ref={popoverRef}
                role="dialog"
                aria-label={t('leads.filter.openAria')}
                tabIndex={-1}
                style={{
                  outline: 'none',
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  zIndex: 30,
                  width: '208px',
                  padding: '10px 4px 4px',
                  borderRadius: '12px',
                  background: c.surface,
                  border: `1px solid ${c.border}`,
                  boxShadow: c.elevatedShadow,
                }}
              >
                <div style={popoverLabel}>{t('leads.filter.score')}</div>
                {SCORE_OPTIONS.map(([value, key]) => {
                  const active = filterScore === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilterScore(value)}
                      style={optionBtn(active)}
                    >
                      {t(key)}
                      {active && <span aria-hidden>✓</span>}
                    </button>
                  );
                })}

                {/* Source only matters once customer inquiries actually exist —
                    otherwise every lead has the same source and the choice is
                    noise. */}
                {showSourceFilter && (
                  <>
                    <div style={{ ...popoverLabel, paddingTop: '10px' }}>
                      {t('leads.filter.source')}
                    </div>
                    {SOURCE_OPTIONS.map(([value, key]) => {
                      const active = sourceFilter === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setSourceFilter(value)}
                          style={optionBtn(active)}
                        >
                          {t(key)}
                          {active && <span aria-hidden>✓</span>}
                        </button>
                      );
                    })}
                  </>
                )}

                {activeFilters > 0 && (
                  <div style={{ borderTop: `1px solid ${c.divider}`, marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterScore('All');
                        setSourceFilter('all');
                      }}
                      style={{
                        ...optionBtn(false),
                        justifyContent: 'center',
                        marginTop: '4px',
                        color: c.textMuted,
                        fontWeight: 600,
                      }}
                    >
                      {t('leads.filter.clearAll')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Results strip: what the filters produced, and why. Chips make an
          applied filter removable in one click; the count + sort control sit
          opposite so the list below always states its own size. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: hasChips ? 'space-between' : 'flex-end',
          gap: '10px',
          flexWrap: 'wrap',
          padding: '8px 16px',
          background: c.surfaceAlt,
          borderTop: `1px solid ${c.divider}`,
        }}
      >
        {hasChips && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', minWidth: 0 }}>
            {filterScore !== 'All' && scoreLabelKey && (
              <span style={chip}>
                {t('leads.chip.score', { value: t(scoreLabelKey) })}
                <button
                  type="button"
                  onClick={() => setFilterScore('All')}
                  aria-label={t('leads.chip.remove')}
                  style={chipClose}
                >
                  ×
                </button>
              </span>
            )}
            {sourceFilter !== 'all' && sourceLabelKey && (
              <span style={chip}>
                {t('leads.chip.source', { value: t(sourceLabelKey) })}
                <button
                  type="button"
                  onClick={() => setSourceFilter('all')}
                  aria-label={t('leads.chip.remove')}
                  style={chipClose}
                >
                  ×
                </button>
              </span>
            )}
            {searchTerm.trim() !== '' && (
              <span style={chip}>
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '140px',
                  }}
                >
                  {t('leads.chip.search', { value: searchTerm.trim() })}
                </span>
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  aria-label={t('leads.chip.remove')}
                  style={chipClose}
                >
                  ×
                </button>
              </span>
            )}
          </div>
        )}

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.78rem',
            color: c.textMuted,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {!loading && (
            <>
              <span>{tPlural('leads.enquiryCount', resultCount)}</span>
              <span aria-hidden style={{ color: c.textSubtle }}>
                ·
              </span>
            </>
          )}
          <button
            type="button"
            onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
            aria-label={t(
              sortOrder === 'newest' ? 'leads.sort.newestAria' : 'leads.sort.oldestAria'
            )}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              border: 'none',
              background: 'transparent',
              padding: 0,
              color: c.primaryText,
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {t('leads.sort.date')}
            <span aria-hidden>{sortOrder === 'newest' ? '↓' : '↑'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
