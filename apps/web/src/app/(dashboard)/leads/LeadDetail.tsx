import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Lead, LeadActivity } from '@/types/api';
import { getInitials, pickAvatarColor } from '@/lib/avatar';
import {
  BUDGET_LABELS,
  EVENT_LABELS,
  SCORE_LABEL,
  type ColorTokens,
  type LeadScore,
  type Styles,
} from './leadTypes';
import { ICONS } from './leadIcons';
import { daysUntilEvent, getScoreVisual, getUrgencyVisual } from './leadVisuals';
import { FactCard } from './FactCard';
import { ScoreBreakdown } from './ScoreBreakdown';
import { ActivityTimeline } from './ActivityTimeline';

export function LeadDetail({
  lead,
  s,
  c,
  onConvert,
  onViewBooking,
  onReject,
  onAddNote,
  onMarkReplied,
}: Readonly<{
  lead: Lead | null;
  s: Styles;
  c: ColorTokens;
  onConvert: () => void;
  onViewBooking: () => void;
  onReject: () => void;
  onAddNote: () => void;
  onMarkReplied: () => void;
}>) {
  // Activity is fetched per-selected-lead. Loading state lets the timeline
  // section show a spinner instead of "no activity" while the request is in
  // flight (which would misleadingly suggest the lead has no history).
  const [activity, setActivity] = useState<LeadActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const leadId = lead?.id;
  useEffect(() => {
    if (!leadId) {
      setActivity([]);
      return;
    }
    let cancelled = false;
    setActivityLoading(true);
    api
      .get<LeadActivity[]>(`/api/leads/${leadId}/activity`)
      .then((res) => {
        if (!cancelled) setActivity(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        // Don't block the rest of the detail panel on an activity-fetch
        // failure — empty array surfaces "no activity recorded yet" which
        // is the same failure-tolerant degradation as the packages picker.
        if (!cancelled) setActivity([]);
      })
      .finally(() => {
        if (!cancelled) setActivityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  if (!lead) {
    return (
      <div style={s.emptyState}>
        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: c.text }}>No lead selected</div>
        <div>Pick a lead from the list to see details.</div>
      </div>
    );
  }

  const score = lead.score as LeadScore;
  const scoreVisual = getScoreVisual(score, c);
  const daysUntil = daysUntilEvent(lead.eventDate);
  const urgency = getUrgencyVisual(daysUntil, c);
  const formattedEventDate = new Date(lead.eventDate).toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const avatar = pickAvatarColor(lead.id || lead.name, c.isDark);
  const waHref = lead.phone
    ? `https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`
    : null;

  return (
    <>
      <div style={s.detailHeader}>
        <div style={s.detailHeaderLeft}>
          <span style={{ ...s.detailAvatar, background: avatar.bg, color: avatar.fg }}>
            {getInitials(lead.name)}
          </span>
          <div style={s.detailHeaderText}>
            <div style={s.detailTitleRow}>
              <span style={s.detailTitle}>{lead.name}</span>
              <span
                style={{
                  ...s.badge,
                  background: scoreVisual.bg,
                  color: scoreVisual.color,
                }}
              >
                <span style={{ ...s.badgeDot, background: scoreVisual.dot }} />
                {SCORE_LABEL[score]}
              </span>
            </div>
            <span style={s.detailSubtitle}>
              {EVENT_LABELS[lead.eventType] ?? lead.eventType} · {formattedEventDate}
            </span>
          </div>
        </div>
        <div style={s.detailActions}>
          <a
            href={waHref ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!waHref}
            title={waHref ? 'Open WhatsApp chat' : 'No phone number on file'}
            style={{
              ...s.secondaryButton,
              textDecoration: 'none',
              ...(waHref ? {} : { opacity: 0.5, pointerEvents: 'none' }),
            }}
          >
            {ICONS.whatsapp} WhatsApp
          </a>
          <a
            href={lead.email ? `mailto:${lead.email}` : undefined}
            aria-disabled={!lead.email}
            title={lead.email ? `Email ${lead.email}` : 'No email on file'}
            style={{
              ...s.secondaryButton,
              textDecoration: 'none',
              ...(lead.email ? {} : { opacity: 0.5, pointerEvents: 'none' }),
            }}
          >
            {ICONS.email} Email
          </a>
          {lead.status === 'BOOKED' ? (
            // Already converted — replace the Convert button with a clear
            // confirmation pill + a deep link to bookings. This kills the
            // 409 round-trip that happens when the photographer clicks
            // Convert on a lead that's already been booked.
            <>
              <span
                aria-label="Lead already converted to a booking"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '999px',
                  background: c.successBg,
                  color: c.successText,
                  border: `1px solid ${c.successBorder}`,
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                Booked ✓
              </span>
              <button
                type="button"
                style={s.invertedPrimaryButton}
                onClick={onViewBooking}
              >
                View in Bookings →
              </button>
            </>
          ) : (
            <button type="button" style={s.invertedPrimaryButton} onClick={onConvert}>
              {ICONS.plus} Convert to booking
            </button>
          )}
        </div>
      </div>

      <div style={s.detailBody}>
        {/* Previously: a full-width Priority Signal card with the score badge
            and an English summary of why the score was what it was. Removed
            because it triple-encoded the same information: the header badge
            already shows "High priority", and the Score breakdown bars below
            already explain the *why* with actual per-dimension numbers
            (Budget=90, Type=85, Lead time=95) — strictly more useful than an
            italic summary in a coloured box. The card recovered ~100px of
            vertical chrome that wasn't earning its space. */}

        {/* Lead facts — mini-card grid. Each fact gets its own bordered tile
            instead of sharing one big container with vertical label-rows.
            Trade-off: slightly more horizontal real estate per fact, but each
            value is far more scannable and the email/budget can carry their
            own visual treatment (highlighted, chip, etc.) without fighting
            the row alongside them. */}
        <div style={s.section}>
          <span style={s.sectionTitle}>Lead facts</span>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '10px',
              marginTop: '10px',
            }}
          >
            <FactCard
              c={c}
              label="Email"
              value={lead.email || '—'}
              valueColor={lead.email ? c.primaryText : c.textMuted}
            />
            <FactCard
              c={c}
              label="Phone"
              value={lead.phone || '—'}
              valueColor={lead.phone ? c.text : c.textMuted}
            />
            <FactCard c={c} label="Event date" value={formattedEventDate} />
            <FactCard
              c={c}
              label="Time to event"
              chip={{ bg: urgency.bg, color: urgency.color, dot: urgency.dot, label: urgency.label }}
            />
            <FactCard
              c={c}
              label="Event type"
              value={EVENT_LABELS[lead.eventType] ?? lead.eventType}
            />
            <FactCard
              c={c}
              label="Budget range"
              value={BUDGET_LABELS[lead.budgetRange] ?? lead.budgetRange}
              // Highlight high budgets in success-green so the most important
              // qualifier on a lead (can they actually pay?) reads first.
              valueColor={
                lead.budgetRange === '500_1000' || lead.budgetRange === 'OVER_1000'
                  ? c.successText
                  : c.text
              }
              emphasised={
                lead.budgetRange === '500_1000' || lead.budgetRange === 'OVER_1000'
              }
            />
          </div>
        </div>

        {/* Score breakdown — shown when the backend exposes component scores.
            Tells the photographer *why* a lead is rated HIGH/MED/LOW instead
            of forcing them to trust the rollup label. */}
        {(lead.budgetScore != null
          || lead.typeScore != null
          || lead.timeScore != null) && (
          <div style={s.section}>
            <span style={s.sectionTitle}>Score breakdown</span>
            <ScoreBreakdown
              c={c}
              budgetScore={lead.budgetScore}
              typeScore={lead.typeScore}
              timeScore={lead.timeScore}
            />
          </div>
        )}

        {/* Client message */}
        {lead.message ? (
          <div style={s.section}>
            <span style={s.sectionTitle}>Client message</span>
            <div style={s.messageQuote}>&ldquo;{lead.message}&rdquo;</div>
          </div>
        ) : null}

        {/* Activity timeline */}
        <div style={s.section}>
          <span style={s.sectionTitle}>Activity</span>
          <ActivityTimeline activity={activity} loading={activityLoading} c={c} />
        </div>

        {/* Internal notes */}
        <div style={s.section}>
          <span style={s.sectionTitle}>Internal notes</span>
          <div style={s.notesReadonly}>
            {lead.internalNotes?.trim()
              ? lead.internalNotes
              : 'No internal notes on this lead yet.'}
          </div>
          <span style={s.notesHint}>Use the &quot;Add note&quot; button below to edit this note.</span>
        </div>
      </div>

      {/* Sticky actions footer.
            left  → destructive (Reject)
            right → progress    (Mark replied / Add note / Convert)
          Hidden when the lead is in a terminal state (BOOKED or REJECTED).
          The Archive button that previously sat next to Reject was removed:
          permanently-disabled buttons signal "broken product" rather than
          "coming soon", and REJECTED already covers the terminal-no path. */}
      {lead.status !== 'BOOKED' && lead.status !== 'REJECTED' && (
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            padding: '12px 24px',
            background: c.surface,
            borderTop: `1px solid ${c.divider}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            zIndex: 1,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onReject}
              style={{
                padding: '8px 14px',
                border: `1px solid ${c.dangerBorder}`,
                borderRadius: '8px',
                background: c.dangerBg,
                color: c.dangerText,
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              × Reject
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {/* Mark as replied: only shown for NEW leads. Once a lead is
                REPLIED the button hides — the badge / status filter already
                tell you it's been replied to, repeating the affordance would
                be visual noise. This is the action that finally lets the
                "N enquiries awaiting your reply" alert in the header clear. */}
            {lead.status === 'NEW' && (
              <button
                type="button"
                onClick={onMarkReplied}
                style={{
                  padding: '8px 14px',
                  border: `1px solid ${c.successBorder}`,
                  borderRadius: '8px',
                  background: c.successBg,
                  color: c.successText,
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                title="Move this enquiry out of 'Needs reply' — you've responded off-platform."
              >
                ✓ Mark replied
              </button>
            )}
            <button
              type="button"
              onClick={onAddNote}
              style={{
                padding: '8px 14px',
                border: `1px solid ${c.border}`,
                borderRadius: '8px',
                background: 'transparent',
                color: c.text,
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {lead.internalNotes ? 'Edit note' : 'Add note'}
            </button>
            <button
              type="button"
              onClick={onConvert}
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
              + Convert to booking
            </button>
          </div>
        </div>
      )}
    </>
  );
}
