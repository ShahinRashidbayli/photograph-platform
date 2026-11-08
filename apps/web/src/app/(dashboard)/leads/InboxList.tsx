'use client';

import React from 'react';
import { useTranslation } from '@/lib/i18n';
import { BUDGET_LABEL_KEYS, EVENT_LABEL_KEYS, translateOr } from './leadTypes';
import { INQUIRY_BUDGET_LABEL_KEY, INQUIRY_EVENT_LABEL_KEY } from './inquiryTypes';
import { factsOf, waitingDays, type Inbox, type InboxItem } from './leads.inbox';
import type { getInboxStyles } from './inbox.styles';

type S = ReturnType<typeof getInboxStyles>;
type Tr = ReturnType<typeof useTranslation>;

export function occasionOf(item: InboxItem, t: Tr['t']): string {
  return item.kind === 'lead'
    ? translateOr(t, EVENT_LABEL_KEYS[item.lead.eventType], item.lead.eventType)
    : translateOr(t, INQUIRY_EVENT_LABEL_KEY[item.inquiry.eventType], item.inquiry.eventType);
}

export function budgetOf(item: InboxItem, t: Tr['t']): string {
  return item.kind === 'lead'
    ? translateOr(t, BUDGET_LABEL_KEYS[item.lead.budgetRange], item.lead.budgetRange)
    : translateOr(t, INQUIRY_BUDGET_LABEL_KEY[item.inquiry.budgetRange], item.inquiry.budgetRange);
}

/** "Wedding · Jun 12, 2027 · €1,000+" — the line a request is triaged by. */
export function summaryOf(item: InboxItem, { t, format }: Tr): string {
  const f = factsOf(item);
  const date = f.date ? format.monthDayYear(f.date) : t('leads.row.dateOpen');
  return [occasionOf(item, t), date, budgetOf(item, t)].filter(Boolean).join(' · ');
}

function isBooked(item: InboxItem): boolean {
  return item.kind === 'lead'
    ? item.lead.status === 'BOOKED'
    : item.inquiry.status === 'BOOKING_CREATED' || item.inquiry.status === 'ACCEPTED';
}

/**
 * The inbox: requests grouped by what they need — an answer, the client's
 * answer, or nothing. No filters and no sort control: the grouping is the
 * filter, and "oldest first" is the only order a queue of people waiting for
 * an answer should have.
 */
export function InboxList({
  inbox,
  selectedKey,
  onSelect,
  search,
  onSearch,
  closedOpen,
  onToggleClosed,
  now,
  s,
}: {
  inbox: Inbox;
  selectedKey: string | null;
  onSelect: (_item: InboxItem) => void;
  search: string;
  onSearch: (_q: string) => void;
  closedOpen: boolean;
  onToggleClosed: () => void;
  now: Date;
  s: S;
}) {
  const tr = useTranslation();
  const { t } = tr;

  const row = (item: InboxItem) => {
    const key = `${item.kind}:${item.id}`;
    const active = key === selectedKey;
    const f = factsOf(item);
    let when: string;
    let late = false;
    if (item.group === 'reply') {
      const days = waitingDays(item.createdAt, now);
      when = days === 0 ? t('leads.wait.today') : tr.tPlural('leads.wait.days', days);
      late = days >= 1;
    } else if (item.group === 'waiting') {
      when = tr.format.dayMonth(item.createdAt);
    } else {
      when = isBooked(item) ? t('leads.row.booked') : t('leads.row.declined');
    }
    const preview = f.message.split('\n')[0];
    return (
      <button
        key={key}
        type="button"
        className="ld-row"
        aria-current={active ? 'true' : undefined}
        onClick={() => onSelect(item)}
        style={{ ...s.row, ...(active ? s.rowActive : null) }}
      >
        <span style={s.rowTop}>
          <span style={item.group === 'reply' ? s.rowName : s.rowNameQuiet}>{f.name}</span>
          <span style={late ? s.rowWhenLate : s.rowWhen}>{when}</span>
        </span>
        <span style={s.rowSummary}>
          {f.score === 'HIGH' && item.group !== 'closed' && (
            <span style={s.highTag}>{t('leads.row.high')}</span>
          )}
          <span style={s.ellipsis}>{summaryOf(item, tr)}</span>
        </span>
        {preview && item.group !== 'closed' && <span style={s.rowPreview}>{preview}</span>}
      </button>
    );
  };

  return (
    <>
      <div style={s.searchWrap}>
        <label style={s.search}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t('leads.search.placeholder')}
            aria-label={t('leads.search.aria')}
            style={s.searchInput}
          />
        </label>
      </div>

      <div style={{ padding: '4px 8px 8px', overflowY: 'auto', flex: 1 }}>
        <section aria-label={t('leads.group.reply')}>
          <div style={s.groupHead}>
            <span>
              {t('leads.group.reply')} · {inbox.reply.length}
            </span>
            {inbox.reply.length > 1 && (
              <span style={{ fontWeight: 400 }}>{t('leads.group.replyHint')}</span>
            )}
          </div>
          {inbox.reply.length === 0 ? (
            <p style={s.groupEmpty}>{t('leads.allAnswered')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {inbox.reply.map(row)}
            </div>
          )}
        </section>

        {inbox.waiting.length > 0 && (
          <section aria-label={t('leads.group.waiting')}>
            <div style={s.groupHead}>
              <span>
                {t('leads.group.waiting')} · {inbox.waiting.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {inbox.waiting.map(row)}
            </div>
          </section>
        )}

        {inbox.closed.length > 0 && (
          <section aria-label={t('leads.group.closed')}>
            <button
              type="button"
              onClick={onToggleClosed}
              aria-expanded={closedOpen}
              style={s.groupToggle}
            >
              <span>
                {t('leads.group.closed')} · {inbox.closed.length}
              </span>
              <span>{closedOpen ? t('leads.group.hide') : t('leads.group.show')}</span>
            </button>
            {closedOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {inbox.closed.map(row)}
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
}
