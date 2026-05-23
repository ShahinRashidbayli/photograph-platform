'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useThemeStore } from '@/store/themeStore';
import api from '@/lib/api';
import { Lead } from '@/types/api';
import { getInitials, pickAvatarColor } from '@/lib/avatar';
import {
  getLeadsColors,
  getLeadsStyles,
  type LeadsTheme,
} from './leads.styles';

type LeadScore = 'HIGH' | 'MED' | 'LOW';
type LeadFilter = 'All' | 'High' | 'Medium' | 'Low';

const EVENT_LABELS: Record<string, string> = {
  WEDDING: 'Wedding',
  ENGAGEMENT: 'Engagement',
  PORTRAIT: 'Portrait',
  FAMILY: 'Family',
  NEWBORN: 'Newborn',
  CORPORATE: 'Corporate',
};

const BUDGET_LABELS: Record<string, string> = {
  UNDER_200: 'under €200',
  '200_500': '€200–499',
  '500_1000': '€500+',
  OVER_1000: '€1,000+',
};

const SCORE_REASON: Record<LeadScore, string> = {
  HIGH: 'Budget ≥ €500, premium event type, ample lead time.',
  MED: 'Mid-range budget or event 30–60 days out — worth a follow-up.',
  LOW: 'Tight budget or event under 30 days — qualify carefully.',
};

const SCORE_LABEL: Record<LeadScore, string> = {
  HIGH: 'High priority',
  MED: 'Medium priority',
  LOW: 'Low priority',
};

const SCORE_SHORT: Record<LeadScore, string> = {
  HIGH: 'High',
  MED: 'Med',
  LOW: 'Low',
};

const ICONS = {
  search: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  ),
  plus: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  whatsapp: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.6 6.32A7.85 7.85 0 0 0 12.05 4a7.94 7.94 0 0 0-6.88 11.91L4 20l4.2-1.1a7.93 7.93 0 0 0 3.84.98h.01a7.94 7.94 0 0 0 5.55-13.56Zm-5.55 12.21h-.01a6.6 6.6 0 0 1-3.36-.92l-.24-.14-2.5.65.67-2.43-.16-.25a6.6 6.6 0 0 1 10.3-8.13 6.55 6.55 0 0 1 1.94 4.69 6.6 6.6 0 0 1-6.64 6.53Zm3.61-4.94c-.2-.1-1.18-.58-1.36-.65s-.31-.1-.45.1c-.13.2-.5.65-.62.78-.11.13-.23.15-.43.05a5.42 5.42 0 0 1-1.6-.99 6 6 0 0 1-1.1-1.38c-.12-.2 0-.31.09-.41.09-.09.2-.23.3-.34.1-.12.13-.2.2-.33.07-.13.03-.25-.02-.35-.05-.1-.45-1.08-.61-1.48-.16-.39-.32-.34-.45-.34h-.38a.74.74 0 0 0-.53.25 2.21 2.21 0 0 0-.7 1.65c0 .97.71 1.91.81 2.05.1.13 1.4 2.13 3.39 2.99.47.2.85.32 1.14.41.48.15.92.13 1.26.08.39-.06 1.18-.48 1.35-.95.16-.47.16-.87.12-.95-.05-.08-.18-.13-.38-.23Z" />
    </svg>
  ),
  email: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  ),
  arrowRight: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  ),
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  trending: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 17 6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </svg>
  ),
  inbox: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
    </svg>
  ),
  document: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6M9 17h6" />
    </svg>
  ),
  alert: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  ),
};

function formatEventDate(iso: string): { month: string; day: string } {
  const d = new Date(iso);
  return {
    month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
    day: String(d.getDate()),
  };
}

function daysUntilEvent(iso: string): number {
  const now = new Date();
  const event = new Date(iso);
  const diff = event.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

type ColorTokens = ReturnType<typeof getLeadsColors>;

function getScoreVisual(score: LeadScore, c: ColorTokens) {
  if (score === 'HIGH') {
    return { bg: c.successBg, color: c.successText, dot: c.success, border: c.successBorder };
  }
  if (score === 'MED') {
    return { bg: c.warningBg, color: c.warningText, dot: c.warning, border: c.warningBorder };
  }
  return { bg: c.dangerBg, color: c.dangerText, dot: c.danger, border: c.dangerBorder };
}

function getUrgencyVisual(daysUntil: number, c: ColorTokens) {
  if (daysUntil <= 0) {
    return { bg: c.neutralBg, color: c.neutralText, dot: c.neutral, label: 'Past' };
  }
  if (daysUntil < 30) {
    return { bg: c.dangerBg, color: c.dangerText, dot: c.danger, label: `${daysUntil}d away` };
  }
  if (daysUntil < 60) {
    return { bg: c.warningBg, color: c.warningText, dot: c.warning, label: `${daysUntil}d away` };
  }
  return { bg: c.primaryBg, color: c.primaryStrong, dot: c.primary, label: `${daysUntil}d away` };
}

type Styles = Record<string, React.CSSProperties>;

function StatCard({
  label,
  value,
  hint,
  icon,
  iconBg,
  iconColor,
  s,
}: Readonly<{
  label: string;
  value: number | string;
  hint: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  s: Styles;
}>) {
  return (
    <div style={s.statCard}>
      <div style={s.statTopRow}>
        <span style={s.statLabel}>{label}</span>
        <span style={{ ...s.statIcon, background: iconBg, color: iconColor }}>{icon}</span>
      </div>
      <div style={s.statValue}>{value}</div>
      <span style={s.statHint}>{hint}</span>
    </div>
  );
}

function LeadListItem({
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
  const score = lead.score as LeadScore;
  const scoreVisual = getScoreVisual(score, c);
  const { month, day } = formatEventDate(lead.eventDate);

  let itemStyle: React.CSSProperties = { ...s.listItem };
  if (isActive) itemStyle = { ...itemStyle, ...s.listItemActive };
  else if (isHovered) itemStyle = { ...itemStyle, ...s.listItemHover };

  return (
    <button
      type="button"
      style={itemStyle}
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <div style={s.listItemDate}>
        <span style={s.listItemDateMonth}>{month}</span>
        <span style={s.listItemDateDay}>{day}</span>
      </div>
      <div style={s.listItemContent}>
        <div style={s.listItemTopRow}>
          <span style={s.listItemName}>{lead.name}</span>
          <span
            style={{
              ...s.badgeSm,
              background: scoreVisual.bg,
              color: scoreVisual.color,
            }}
          >
            <span style={{ ...s.badgeDot, background: scoreVisual.dot }} />
            {SCORE_SHORT[score]}
          </span>
        </div>
        <div style={s.listItemBottomRow}>
          <span style={s.listItemMeta}>
            {EVENT_LABELS[lead.eventType] ?? lead.eventType} · {BUDGET_LABELS[lead.budgetRange] ?? lead.budgetRange}
          </span>
          {lead.internalNotes ? (
            <span style={s.listItemNoteDot} title="Has internal notes">
              {ICONS.document}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function LeadDetail({
  lead,
  s,
  c,
  onConvert,
}: Readonly<{ lead: Lead | null; s: Styles; c: ColorTokens; onConvert: () => void }>) {
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
          <button type="button" style={s.invertedPrimaryButton} onClick={onConvert}>
            {ICONS.plus} Convert to booking
          </button>
        </div>
      </div>

      <div style={s.detailBody}>
        {/* Priority card */}
        <div
          style={{
            ...s.priorityCard,
            background: scoreVisual.bg,
            borderColor: scoreVisual.border,
          }}
        >
          <div style={s.priorityRow}>
            <span style={s.sectionTitle}>Priority signal</span>
            <span
              style={{
                ...s.badge,
                background: c.surface,
                color: scoreVisual.color,
                border: `1px solid ${scoreVisual.border}`,
              }}
            >
              <span style={{ ...s.badgeDot, background: scoreVisual.dot }} />
              {SCORE_LABEL[score]}
            </span>
          </div>
          <p style={s.priorityReason}>{SCORE_REASON[score]}</p>
        </div>

        {/* Lead facts */}
        <div style={s.section}>
          <span style={s.sectionTitle}>Lead facts</span>
          <div style={s.sectionCard}>
            <div style={s.infoGrid}>
              <div style={s.infoRow}>
                <span style={s.infoLabel}>Email</span>
                <span style={s.infoValue}>{lead.email || '—'}</span>
              </div>
              <div style={s.infoRow}>
                <span style={s.infoLabel}>Phone</span>
                <span style={s.infoValue}>{lead.phone || '—'}</span>
              </div>
              <div style={s.infoRow}>
                <span style={s.infoLabel}>Event date</span>
                <span style={s.infoValue}>{formattedEventDate}</span>
              </div>
              <div style={s.infoRow}>
                <span style={s.infoLabel}>Time to event</span>
                <span
                  style={{
                    ...s.badge,
                    background: urgency.bg,
                    color: urgency.color,
                    width: 'fit-content',
                  }}
                >
                  <span style={{ ...s.badgeDot, background: urgency.dot }} />
                  {urgency.label}
                </span>
              </div>
              <div style={s.infoRow}>
                <span style={s.infoLabel}>Event type</span>
                <span style={s.infoValue}>
                  {EVENT_LABELS[lead.eventType] ?? lead.eventType}
                </span>
              </div>
              <div style={s.infoRow}>
                <span style={s.infoLabel}>Budget range</span>
                <span style={s.infoValue}>
                  {BUDGET_LABELS[lead.budgetRange] ?? lead.budgetRange}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Client message */}
        {lead.message ? (
          <div style={s.section}>
            <span style={s.sectionTitle}>Client message</span>
            <div style={s.messageQuote}>&ldquo;{lead.message}&rdquo;</div>
          </div>
        ) : null}

        {/* Internal notes */}
        <div style={s.section}>
          <span style={s.sectionTitle}>Internal notes</span>
          <div style={s.notesReadonly}>
            {lead.internalNotes?.trim()
              ? lead.internalNotes
              : 'No internal notes on this lead yet.'}
          </div>
          <span style={s.notesHint}>Editing internal notes is coming soon.</span>
        </div>
      </div>
    </>
  );
}

function LeadListSkeleton({ s }: Readonly<{ s: Styles }>) {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={s.skeletonItem}>
          <div style={{ ...s.skeletonBlock, width: 52, height: 52, borderRadius: 12 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ ...s.skeletonBlock, height: 12, width: '60%' }} />
            <div style={{ ...s.skeletonBlock, height: 10, width: '45%' }} />
          </div>
        </div>
      ))}
    </>
  );
}

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
  const [filterStatus, setFilterStatus] = useState<LeadFilter>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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

  const filteredLeads = useMemo(() => {
    let list = leads;
    if (filterStatus === 'High') list = list.filter((l) => l.score === 'HIGH');
    else if (filterStatus === 'Medium') list = list.filter((l) => l.score === 'MED');
    else if (filterStatus === 'Low') list = list.filter((l) => l.score === 'LOW');

    const q = searchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter((l) => {
        const haystack = `${l.name} ${l.email ?? ''} ${l.eventType ?? ''} ${l.message ?? ''}`.toLowerCase();
        return haystack.includes(q);
      });
    }
    return list;
  }, [leads, filterStatus, searchTerm]);

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

  return (
    <div style={s.pageWrapper}>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
      <div style={s.pageHeader}>
        <div>
          <h1 style={s.pageTitle}>Leads</h1>
          <p style={s.pageSubtitle}>
            Qualify enquiries, track priorities, and convert prospects into bookings.
          </p>
        </div>
      </div>

      <div style={s.summaryRow}>
        <StatCard
          label="Total leads"
          value={stats.total}
          hint="All-time enquiries"
          icon={ICONS.users}
          iconBg={c.primaryBg}
          iconColor={c.primaryStrong}
          s={s}
        />
        <StatCard
          label="High priority"
          value={stats.high}
          hint={`${stats.conversionRate}% of pipeline`}
          icon={ICONS.trending}
          iconBg={c.successBg}
          iconColor={c.successText}
          s={s}
        />
        <StatCard
          label="Needs action"
          value={stats.needsReply}
          hint="Awaiting your reply"
          icon={ICONS.inbox}
          iconBg={c.warningBg}
          iconColor={c.warningText}
          s={s}
        />
      </div>

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
            <div style={s.listHeader}>
              <span style={s.listTitle}>All leads</span>
              <span style={s.listSubtitle}>Sorted by event date · score, type & budget at a glance</span>
              <div style={s.searchWrapper}>
                <span style={s.searchIcon}>{ICONS.search}</span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search name, email, type…"
                  style={s.searchBox}
                />
              </div>
            </div>

            <div style={s.filterTabs}>
              {(['All', 'High', 'Medium', 'Low'] as LeadFilter[]).map((status) => {
                const isActive = filterStatus === status;
                return (
                  <button
                    type="button"
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    style={{
                      ...s.filterTab,
                      ...(isActive ? s.filterTabActive : {}),
                    }}
                  >
                    {status}
                  </button>
                );
              })}
            </div>

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
                  <div>Try a different filter or search term.</div>
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
                onConvert={() => router.push('/bookings')}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
