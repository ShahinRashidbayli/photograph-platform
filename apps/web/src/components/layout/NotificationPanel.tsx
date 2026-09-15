'use client';

import Link from 'next/link';
import { useState } from 'react';
import api from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { getInitials } from '@/lib/avatar';
import type { AttentionItem } from '@/hooks/useAttention';

/**
 * How long an item may sit before the panel calls it overdue.
 *
 * <p>A day, because that is the promise the product makes elsewhere: the leads
 * page counts anything still {@code NEW} as "awaiting your reply", and a
 * photographer who has not answered an enquiry by the next day has lost the
 * booking to whoever did. Long enough that an evening enquiry is not scolding
 * you at breakfast; short enough to still be worth flagging.
 */
const OVERDUE_AFTER_MS = 24 * 60 * 60 * 1000;

/** "vor 3 Tagen" / "3 days ago", in the active language. */
function relativeTime(iso: string, locale: string): string {
  const elapsed = Date.now() - new Date(iso).getTime();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
  const minutes = Math.round(elapsed / 60000);
  if (minutes < 60) return rtf.format(-Math.max(minutes, 1), 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  return rtf.format(-Math.round(hours / 24), 'day');
}

const IconCheck = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M4 12.5l5 5L20 6.5" />
  </svg>
);

const IconEye = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconEnvelope = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <rect x="2.5" y="5" width="19" height="14" rx="2" />
    <path d="M3 6.5l9 6 9-6" />
  </svg>
);

const IconPerson = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="12" cy="8" r="3.5" />
    <path d="M4.5 20c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" />
  </svg>
);

const IconArrowRight = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M4 12h15M13 6l6 6-6 6" />
  </svg>
);

/**
 * What is waiting on the photographer, opened from the bell.
 *
 * <p>The bell used to navigate straight to /leads. That answered "how many"
 * with a page load and never answered "which" — you had to leave whatever you
 * were doing to find out whether the five items were worth interrupting for.
 *
 * <h2>Why it is grouped</h2>
 * Five rows in one list are five equal claims on the photographer's attention,
 * and they are not equal: an enquiry from twenty minutes ago is fine, one from
 * three days ago is a booking going to someone else. The split says which is
 * which before anything is read, and the amber rail carries that without
 * needing a word.
 *
 * <h2>What "done" means here</h2>
 * There is no notifications table and no read flag: an item is unread because
 * it is still in the state that means nobody has dealt with it. So clearing a
 * lead is the real transition {@code LeadService#markReplied} already exposes
 * — "I have replied to this person" — which is the same thing that clears it
 * from the badge, and lands in the audit trail as LEAD_REPLIED rather than as
 * a UI preference.
 *
 * <p>Inquiries deliberately have no such button, which is why their action is
 * an eye rather than a tick. Clearing one means accepting or rejecting it, and
 * that creates a booking or sends the customer a refusal — not something to do
 * from a dropdown with their message out of sight. Those rows open /leads,
 * where the decision is made with everything in view.
 */
export function NotificationPanel({
  items,
  colors,
  theme,
  onClose,
  onHandled,
}: {
  items: AttentionItem[] | null;
  colors: {
    border: string;
    text: string;
    subText: string;
    cardBg: string;
    surfaceHover: string;
    shadowPopover: string;
  };
  theme: 'light' | 'dark';
  onClose: () => void;
  onHandled: () => void;
}) {
  const { t, format, lang } = useTranslation();
  const [busy, setBusy] = useState<string[]>([]);
  // Cleared here as soon as the API confirms, so a row goes at the moment the
  // photographer acts rather than when the next refetch lands.
  const [cleared, setCleared] = useState<string[]>([]);

  const visible = (items ?? []).filter((i) => !cleared.includes(i.id));
  const now = Date.now();
  const overdue = visible.filter((i) => now - new Date(i.createdAt).getTime() > OVERDUE_AFTER_MS);
  const fresh = visible.filter((i) => !overdue.includes(i));
  const clearableLeads = visible.filter((i) => i.kind === 'LEAD');

  async function markReplied(ids: string[]) {
    if (ids.length === 0) return;
    setBusy((b) => [...b, ...ids]);
    const done: string[] = [];
    // Sequential, not Promise.all: each is a state transition the server may
    // refuse on its own, and one refusal must not take the others' rows with
    // it — a row that vanished on a failed write would say the lead was
    // answered when it was not.
    for (const id of ids) {
      try {
        await api.patch(`/api/leads/${id}/status`, { status: 'REPLIED' });
        done.push(id);
      } catch {
        /* left in the list */
      }
    }
    setCleared((c) => [...c, ...done]);
    setBusy((b) => b.filter((id) => !ids.includes(id)));
    if (done.length > 0) onHandled();
  }

  function subtitle(item: AttentionItem): string {
    // Most specific thing first, and never an empty line: a lead with nothing
    // but an address still has to say who it is from.
    const parts = [
      item.name ? null : item.email,
      item.eventType,
      item.eventDate ? format.dayMonthYearLong(item.eventDate) : null,
      relativeTime(item.createdAt, lang),
    ].filter(Boolean) as string[];
    if (parts.length === 1 && item.source) {
      parts.unshift(t('chrome.notifications.contactForm'));
    }
    return parts.join(' · ');
  }

  function Avatar({ item, urgent }: { item: AttentionItem; urgent: boolean }) {
    const tint = urgent
      ? { bg: theme === 'dark' ? '#442D10' : '#FEF3C7', fg: '#D97706' }
      : { bg: theme === 'dark' ? '#1E2A5A' : '#E0E7FF', fg: '#6366F1' };
    const plain = { bg: theme === 'dark' ? '#2A2A2E' : '#EEF0F4', fg: colors.subText };
    const shown = item.name ? tint : plain;
    return (
      <div
        aria-hidden
        style={{
          width: 36,
          height: 36,
          flexShrink: 0,
          borderRadius: '50%',
          background: shown.bg,
          color: shown.fg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.78rem',
          fontWeight: 700,
        }}
      >
        {item.name ? (
          getInitials(item.name)
        ) : item.kind === 'INQUIRY' ? (
          <IconEnvelope />
        ) : (
          <IconPerson />
        )}
      </div>
    );
  }

  function Row({ item, urgent }: { item: AttentionItem; urgent: boolean }) {
    const working = busy.includes(item.id);
    const displayName =
      item.name ??
      t(
        item.kind === 'INQUIRY'
          ? 'chrome.notifications.unnamedInquiry'
          : 'chrome.notifications.unnamed'
      );
    const actionStyle: React.CSSProperties = {
      flexShrink: 0,
      width: 34,
      height: 34,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: `1px solid ${colors.border}`,
      borderRadius: '9px',
      background: 'transparent',
      color: colors.text,
      textDecoration: 'none',
      cursor: working ? 'default' : 'pointer',
      opacity: working ? 0.45 : 1,
    };
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px' }}>
        <Avatar item={item} urgent={urgent} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: '0.9rem',
              fontWeight: 600,
              color: colors.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {displayName}
          </div>
          <div
            style={{
              fontSize: '0.78rem',
              color: colors.subText,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {subtitle(item)}
          </div>
        </div>
        {item.kind === 'LEAD' ? (
          <button
            role="menuitem"
            onClick={() => markReplied([item.id])}
            disabled={working}
            aria-label={t('chrome.notifications.markRead')}
            title={t('chrome.notifications.markRead')}
            style={actionStyle}
          >
            <IconCheck />
          </button>
        ) : (
          <Link
            role="menuitem"
            href="/leads"
            onClick={onClose}
            aria-label={t('chrome.notifications.review')}
            title={t('chrome.notifications.review')}
            style={actionStyle}
          >
            <IconEye />
          </Link>
        )}
      </div>
    );
  }

  const sectionLabel: React.CSSProperties = {
    padding: '10px 12px 4px',
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  };

  return (
    <div
      role="menu"
      aria-label={t('chrome.notifications.title')}
      style={{
        position: 'absolute',
        top: 'calc(100% + 10px)',
        right: 0,
        width: 380,
        maxWidth: 'calc(100vw - 24px)',
        maxHeight: 460,
        overflowY: 'auto',
        background: colors.cardBg,
        border: `1px solid ${colors.border}`,
        borderRadius: '14px',
        boxShadow: colors.shadowPopover,
        zIndex: 50,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '14px 14px 10px',
        }}
      >
        <div style={{ fontSize: '1.02rem', fontWeight: 700, color: colors.text }}>
          {t('chrome.notifications.title')}
        </div>
        {clearableLeads.length > 0 && (
          <button
            role="menuitem"
            onClick={() => markReplied(clearableLeads.map((i) => i.id))}
            style={{
              border: 'none',
              background: 'transparent',
              color: colors.subText,
              fontSize: '0.84rem',
              fontWeight: 500,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {t('chrome.notifications.allDone')}
          </button>
        )}
      </div>

      {items === null ? (
        <div style={{ padding: '4px 14px 16px', fontSize: '0.86rem', color: colors.subText }}>
          {t('chrome.notifications.loading')}
        </div>
      ) : visible.length === 0 ? (
        <div style={{ padding: '4px 14px 16px', fontSize: '0.86rem', color: colors.subText }}>
          {t('chrome.notifications.none')}
        </div>
      ) : (
        <>
          {overdue.length > 0 && (
            // The rail is the whole point of the grouping: urgency you can see
            // without reading a date.
            <div style={{ borderLeft: '3px solid #D97706', background: 'rgba(217, 119, 6, 0.06)' }}>
              <div style={{ ...sectionLabel, color: '#D97706' }}>
                {t('chrome.notifications.overdue')} · {overdue.length}
              </div>
              {overdue.map((item) => (
                <Row key={`${item.kind}-${item.id}`} item={item} urgent />
              ))}
            </div>
          )}
          {fresh.length > 0 && (
            <div>
              <div style={{ ...sectionLabel, color: colors.subText }}>
                {t('chrome.notifications.fresh')} · {fresh.length}
              </div>
              {fresh.map((item) => (
                <Row key={`${item.kind}-${item.id}`} item={item} urgent={false} />
              ))}
            </div>
          )}
        </>
      )}

      <div style={{ borderTop: `1px solid ${colors.border}` }}>
        <Link
          role="menuitem"
          href="/leads"
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '13px 14px',
            fontSize: '0.88rem',
            fontWeight: 600,
            color: '#6366F1',
            textDecoration: 'none',
          }}
        >
          {t('chrome.notifications.viewAll')}
          <IconArrowRight />
        </Link>
      </div>
    </div>
  );
}
