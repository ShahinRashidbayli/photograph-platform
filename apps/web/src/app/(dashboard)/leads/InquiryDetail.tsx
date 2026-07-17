import React from 'react';
import { useTranslation } from '@/lib/i18n';
import {
  translateOr,
  SCORE_SHORT_KEY,
  type ColorTokens,
} from './leadTypes';
import {
  type Inquiry,
  type InquiryStatus,
  INQUIRY_EVENT_LABEL_KEY,
  INQUIRY_BUDGET_LABEL_KEY,
  INQUIRY_STATUS_LABEL_KEY,
  inquiryDisplayName,
} from './inquiryTypes';
import { getScoreVisual } from './leadVisuals';

/**
 * Detail panel for a customer inquiry — the counterpart to {@link LeadDetail}
 * for the other source in the merged inbox. Simpler than a lead: an inquiry has
 * no activity log, notes or convert flow yet, so the actions are accept/decline
 * on a pending request.
 */
export function InquiryDetail({
  inquiry,
  c,
  busy,
  onTriage,
}: Readonly<{
  inquiry: Inquiry;
  c: ColorTokens;
  busy: boolean;
  onTriage: (_status: 'ACCEPTED' | 'REJECTED') => void;
}>) {
  const { t, format } = useTranslation();
  const scoreVisual = getScoreVisual(inquiry.score, c);
  const name = inquiryDisplayName(inquiry);

  const statusVisual: Record<InquiryStatus, { bg: string; color: string }> = {
    PENDING: { bg: c.primaryBg, color: c.primaryText },
    ACCEPTED: { bg: c.successBg, color: c.successText },
    BOOKING_CREATED: { bg: c.successBg, color: c.successText },
    REJECTED: { bg: c.dangerBg, color: c.dangerText },
  };

  const pill = (v: { bg: string; color: string }): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '3px 10px',
    borderRadius: 999,
    fontSize: '0.72rem',
    fontWeight: 700,
    background: v.bg,
    color: v.color,
    whiteSpace: 'nowrap',
  });

  const label: React.CSSProperties = {
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: c.textSubtle,
    marginBottom: 4,
  };

  return (
    <div style={{ padding: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: c.text }}>{name}</h2>
          <div style={{ fontSize: '0.78rem', color: c.textSubtle, marginTop: 4 }}>
            {t('inquiries.detail.received', { date: format.dayMonthYearLong(inquiry.createdAt) })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={pill({ bg: scoreVisual.bg, color: scoreVisual.color })}>{t(SCORE_SHORT_KEY[inquiry.score])}</span>
          <span style={pill(statusVisual[inquiry.status])}>{t(INQUIRY_STATUS_LABEL_KEY[inquiry.status])}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 18px' }}>
        <Field label={t('inquiries.detail.event')} value={translateOr(t, INQUIRY_EVENT_LABEL_KEY[inquiry.eventType], inquiry.eventType)} labelStyle={label} c={c} />
        <Field label={t('inquiries.detail.budget')} value={translateOr(t, INQUIRY_BUDGET_LABEL_KEY[inquiry.budgetRange], inquiry.budgetRange)} labelStyle={label} c={c} />
        <Field label={t('inquiries.detail.date')} value={inquiry.proposedDate ? format.dayMonthYearLong(inquiry.proposedDate) : '—'} labelStyle={label} c={c} />
        <Field label={t('inquiries.detail.location')} value={inquiry.location || '—'} labelStyle={label} c={c} />
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={label}>{t('inquiries.detail.message')}</div>
        <p style={{ fontSize: '0.9rem', lineHeight: 1.55, color: inquiry.message ? c.text : c.textSubtle, whiteSpace: 'pre-wrap' }}>
          {inquiry.message || t('inquiries.detail.noMessage')}
        </p>
      </div>

      {inquiry.customerEmail && (
        <div style={{ marginTop: 16 }}>
          <div style={label}>{t('inquiries.detail.contact')}</div>
          <a href={`mailto:${inquiry.customerEmail}`} style={{ fontSize: '0.9rem', color: c.primaryText, textDecoration: 'none', overflowWrap: 'anywhere' }}>
            {inquiry.customerEmail}
          </a>
        </div>
      )}

      {inquiry.status === 'PENDING' && (
        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button
            type="button"
            disabled={busy}
            onClick={() => onTriage('ACCEPTED')}
            style={{ flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none', background: c.primarySolid, color: '#fff', fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}
          >
            {busy ? t('inquiries.action.accepting') : t('inquiries.action.accept')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onTriage('REJECTED')}
            style={{ flex: 1, padding: '10px 16px', borderRadius: 10, border: `1px solid ${c.border}`, background: 'transparent', color: c.text, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}
          >
            {busy ? t('inquiries.action.rejecting') : t('inquiries.action.reject')}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, labelStyle, c }: { label: string; value: string; labelStyle: React.CSSProperties; c: ColorTokens }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontSize: '0.9rem', color: c.text, overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  );
}
