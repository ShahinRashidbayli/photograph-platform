import React from 'react';
import { getInitials, pickAvatarColor } from '@/lib/avatar';
import { useTranslation } from '@/lib/i18n';
import {
  translateOr,
  SCORE_SHORT_KEY,
  type ColorTokens,
  type Styles,
} from './leadTypes';
import {
  type Inquiry,
  INQUIRY_EVENT_LABEL_KEY,
  INQUIRY_BUDGET_LABEL_KEY,
  inquiryDisplayName,
} from './inquiryTypes';
import { getScoreVisual } from './leadVisuals';

/**
 * List row for a customer inquiry. Visually a sibling of {@link LeadListItem}
 * (same avatar + score badge + subtitle) so the merged inbox reads as one
 * list, distinguished only by the "Customer" source chip.
 */
export function InquiryRow({
  inquiry,
  isActive,
  isHovered,
  onSelect,
  onHover,
  s,
  c,
}: Readonly<{
  inquiry: Inquiry;
  isActive: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onHover: (_hov: boolean) => void;
  s: Styles;
  c: ColorTokens;
}>) {
  const { t, format } = useTranslation();
  const scoreVisual = getScoreVisual(inquiry.score, c);
  const name = inquiryDisplayName(inquiry);
  const avatar = pickAvatarColor(inquiry.id || name, c.isDark);

  let itemStyle: React.CSSProperties = { ...s.listItem };
  if (isActive) itemStyle = { ...itemStyle, ...s.listItemActive };
  else if (isHovered) itemStyle = { ...itemStyle, ...s.listItemHover };

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
        {getInitials(name)}
      </span>
      <div style={s.listItemContent}>
        <div style={s.listItemTopRow}>
          <span style={s.listItemName}>{name}</span>
          <span style={{ ...s.badgeSm, background: scoreVisual.bg, color: scoreVisual.color }}>
            <span style={{ ...s.badgeDot, background: scoreVisual.dot }} />
            {t(SCORE_SHORT_KEY[inquiry.score])}
          </span>
        </div>

        <div style={{ ...s.listItemBottomRow, color: c.textMuted, fontSize: '0.78rem' }}>
          <span>
            {translateOr(t, INQUIRY_EVENT_LABEL_KEY[inquiry.eventType], inquiry.eventType)} ·{' '}
            {translateOr(t, INQUIRY_BUDGET_LABEL_KEY[inquiry.budgetRange], inquiry.budgetRange)}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
          <span style={{ ...chip, background: c.primaryBg, color: c.primaryText }}>
            {t('leads.source.badge.customer')}
          </span>
          {inquiry.proposedDate && (
            <span style={chip}>{format.monthDayYear(inquiry.proposedDate)}</span>
          )}
        </div>
      </div>
    </button>
  );
}
