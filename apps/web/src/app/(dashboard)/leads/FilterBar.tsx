import React from 'react';
import type {
  ColorTokens,
  LeadPipelineFilter,
  LeadScoreFilter,
} from './leadTypes';

/**
 * Compact filter bar for the leads list panel.
 *
 * <p>Replaces the previous stack of: list title, subtitle, separate search
 * row, and two full-width tab rows. Lives as a single visual unit so it
 * doesn't dominate the panel — the actual list is the point of the page.
 *
 * <p>Layout: pipeline segmented control on row 1; score dropdown + search on
 * row 2 (or all in one row on wider rails). Score is intentionally a
 * dropdown, not tabs: it's secondary to pipeline and most of the time the
 * photographer wants "all scores within the current stage".
 */
export function FilterBar({
  c,
  filterPipeline,
  setFilterPipeline,
  filterScore,
  setFilterScore,
  searchTerm,
  setSearchTerm,
  pipelineCounts,
}: Readonly<{
  c: ColorTokens;
  filterPipeline: LeadPipelineFilter;
  setFilterPipeline: (_p: LeadPipelineFilter) => void;
  filterScore: LeadScoreFilter;
  setFilterScore: (_s: LeadScoreFilter) => void;
  searchTerm: string;
  setSearchTerm: (_q: string) => void;
  pipelineCounts: Record<LeadPipelineFilter, number>;
}>) {
  const segmented: React.CSSProperties = {
    display: 'inline-flex',
    padding: '3px',
    borderRadius: '10px',
    background: c.surfaceAlt,
    border: `1px solid ${c.border}`,
    gap: '2px',
    width: '100%',
  };
  const segmentBtn = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '7px 10px',
    border: 'none',
    borderRadius: '7px',
    background: active ? c.surface : 'transparent',
    color: active ? c.text : c.textMuted,
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: active ? `0 1px 2px rgba(15, 23, 42, 0.06)` : 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
  });
  const select: React.CSSProperties = {
    padding: '7px 10px',
    border: `1px solid ${c.border}`,
    borderRadius: '8px',
    background: c.surface,
    color: c.text,
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    outline: 'none',
  };
  const search: React.CSSProperties = {
    flex: 1,
    padding: '8px 10px 8px 32px',
    border: `1px solid ${c.border}`,
    borderRadius: '8px',
    background: c.surface,
    color: c.text,
    fontSize: '0.85rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };

  return (
    <div
      style={{
        padding: '16px 16px 12px',
        borderBottom: `1px solid ${c.divider}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      {/* Pipeline segmented control. Macro-OS-style: subtle filled active
          state inside a single container, not a row of outlined buttons. */}
      <div style={segmented} role="tablist" aria-label="Pipeline filter">
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
              {stage}
              <span
                aria-hidden
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: '999px',
                  background: active ? c.primaryBg : 'transparent',
                  color: active ? c.primaryText : c.textMuted,
                }}
              >
                {pipelineCounts[stage]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Score + search inline. Score is a dropdown (secondary axis) so it
          doesn't compete visually with the pipeline tabs above. */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <label style={{ position: 'relative', flex: 1 }}>
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: c.textMuted,
              display: 'inline-flex',
              pointerEvents: 'none',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search name, email, type…"
            style={search}
            aria-label="Search leads"
          />
        </label>
        <select
          value={filterScore}
          onChange={(e) => setFilterScore(e.target.value as LeadScoreFilter)}
          style={select}
          aria-label="Filter by score"
        >
          <option value="All">All scores</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>
    </div>
  );
}
