import React from 'react';
import { Lead } from '@/types/api';
import { getInitials, pickAvatarColor } from '@/lib/avatar';
import { useTranslation } from '@/lib/i18n';
import {
  translateOr,
  BUDGET_LABEL_KEYS,
  EVENT_LABEL_KEYS,
  SCORE_SHORT_KEY,
  STATUS_LABEL_KEY,
  type ColorTokens,
  type LeadScore,
  type LeadStatus,
  type Styles,
} from './leadTypes';
import { ICONS } from './leadIcons';
import {
  daysUntilEvent,
  getScoreVisual,
  getUrgencyVisual,
  statusBadgeVisual,
} from './leadVisuals';

export function LeadListItem({
  lead,
  isActive,
  isHovered,
  onSelect,
  onHover,
  s,
  c,
}: Readonly<{
  lead: Lead;
  isActive: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onHover: (_hov: boolean) => void;
  s: Styles;
  c: ColorTokens;
}>) {
  const { t, format } = useTranslation();
  const score = lead.score as LeadScore;
  const scoreVisual = getScoreVisual(score, c);
  // Days-until tells the photographer "how soon do I need to act?" — far
  // more useful than a date alone in the list. Negative values become "past"
  // so old leads (probably no-shows or stale data) read distinctly.
  const daysUntil = daysUntilEvent(lead.eventDate);
  const urgency = getUrgencyVisual(daysUntil, c);
  const avatar = pickAvatarColor(lead.id || lead.name, c.isDark);
  const eventDateShort = format.monthDayYear(lead.eventDate);

  let itemStyle: React.CSSProperties = { ...s.listItem };
  if (isActive) itemStyle = { ...itemStyle, ...s.listItemActive };
  else if (isHovered) itemStyle = { ...itemStyle, ...s.listItemHover };

  // Chip style shared across the bottom row (date / type / days). All three
  // are quick scan signals — keeping their visual treatment uniform lets the
  // eye treat them as a single information cluster, while a *content*
  // difference (urgency colour on the days chip) still surfaces what's
  // actionable.
  const chip: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    borderRadius: '999px',
    background: c.surfaceAlt,
    color: c.textMuted,
    fontSize: '0.7rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  };

  return (
    <button
      type="button"
      style={itemStyle}
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      {/* Avatar replaces the previous month/day date stack — date now lives in
          the chip row below, removing the duplication and matching the detail
          panel's header treatment for visual continuity when the user clicks
          through. */}
      <span
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.78rem',
          fontWeight: 700,
          background: avatar.bg,
          color: avatar.fg,
          flexShrink: 0,
        }}
        aria-hidden
      >
        {getInitials(lead.name)}
      </span>
      <div style={s.listItemContent}>
        <div style={s.listItemTopRow}>
          <span style={s.listItemName}>{lead.name}</span>
          {/* One badge maximum per row. Two competing semantic colors next to
              the name (status + score) was reading as visual noise on the
              All tab. The rule that fixes it cleanly:
                - Terminal states (BOOKED, REJECTED) → status is the primary
                  signal because the lifecycle stage is what the photographer
                  cares about for these leads.
                - Non-terminal (NEW, REPLIED) → score is the primary signal,
                  because priority is what matters inside the active pipeline.
              That collapses every row to exactly one indicator. */}
          {(() => {
            const isTerminal = lead.status === 'BOOKED' || lead.status === 'REJECTED';
            if (isTerminal) {
              const sv = statusBadgeVisual(lead.status, c);
              return (
                <span
                  style={{
                    ...s.badgeSm,
                    background: sv.bg,
                    color: sv.color,
                    border: `1px solid ${sv.border}`,
                  }}
                >
                  {translateOr(t, STATUS_LABEL_KEY[lead.status as LeadStatus], lead.status)}
                </span>
              );
            }
            return (
              <span
                style={{
                  ...s.badgeSm,
                  background: scoreVisual.bg,
                  color: scoreVisual.color,
                }}
              >
                <span style={{ ...s.badgeDot, background: scoreVisual.dot }} />
                {t(SCORE_SHORT_KEY[score])}
              </span>
            );
          })()}
        </div>

        {/* Subtitle row: event type · budget. */}
        <div style={{ ...s.listItemBottomRow, color: c.textMuted, fontSize: '0.78rem' }}>
          <span>
            {translateOr(t, EVENT_LABEL_KEYS[lead.eventType], lead.eventType)} ·{' '}
            {translateOr(t, BUDGET_LABEL_KEYS[lead.budgetRange], lead.budgetRange)}
          </span>
          {lead.internalNotes ? (
            <span style={s.listItemNoteDot} title={t('leadList.hasNotes')}>
              {ICONS.document}
            </span>
          ) : null}
        </div>

        {/* Chip row: date + days-until. The previous "type" chip was deleted
            — it duplicated the event type shown in the subtitle above and
            made the row top-heavy. Date is factual context; days-until is
            actionable (urgency colour cuts through). */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
          {/* Source badge, symmetric with the "Customer" chip on inquiry rows,
              so every row in the merged inbox states where it came from. */}
          <span style={chip}>{t('leads.source.badge.form')}</span>
          <span style={chip}>{eventDateShort}</span>
          <span
            style={{
              ...chip,
              background: urgency.bg,
              color: urgency.color,
            }}
            title={t('leadUrgency.title', { count: String(daysUntil) })}
          >
            {t(urgency.labelKey, { count: String(daysUntil) })}
          </span>
        </div>
      </div>
    </button>
  );
}
