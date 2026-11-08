'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button } from '@/components/ui';
import { useLeadActivity, useUpdateLeadNotes } from '@/hooks/useLeads';
import { whatsappHref, extractApiError } from '@/lib/helpers';
import { useTranslation, type TranslationKey } from '@/lib/i18n';
import type { getColors, Theme } from '@/lib/design-tokens';
import type { Booking, Lead } from '@/types/api';
import { BookingActionMenu, type MenuItem } from '../bookings/BookingActionMenu';
import { getBookingsStyles } from '../bookings/bookings.styles';
import { SCORE_LABEL_KEY } from './leadTypes';
import {
  availabilityOn,
  factsOf,
  mailtoHref,
  priorityFactors,
  waitingDays,
  withWhatsappText,
  type Factor,
  type InboxItem,
} from './leads.inbox';
import { linkButton, statusPill, type getInboxStyles } from './inbox.styles';
import { budgetOf, occasionOf } from './InboxList';

type S = ReturnType<typeof getInboxStyles>;
type Colors = ReturnType<typeof getColors>;

const FACTOR_KEY: Record<Factor, TranslationKey> = {
  budget: 'leads.factor.budget',
  type: 'leads.factor.type',
  time: 'leads.factor.time',
};

export type DetailActions = {
  /** Lead answered — by a draft that just opened, or marked without one. */
  onReplied: (_item: InboxItem, _viaDraft: boolean) => void;
  /** Lead or request declined — with a polite draft, or silently. */
  onDeclined: (_item: InboxItem, _viaDraft: boolean) => void;
  /** Client request accepted: creates the booking on the server. */
  onAccept: () => void;
  onConvert: () => void;
  onViewBookings: () => void;
};

/**
 * One request, read and answered.
 *
 * <p>Top to bottom: who and when; what they wrote (the reason this page
 * exists); the few facts that decide the answer — the date and whether the
 * studio is free then, the occasion and budget, why it scored as it did; then
 * the answer itself. Everything else is a quiet link.
 */
export function InboxDetail({
  item,
  now,
  bookings,
  isPhone,
  theme,
  c,
  s,
  actions,
}: {
  item: InboxItem;
  now: Date;
  bookings: Booking[];
  isPhone: boolean;
  theme: Theme;
  c: Colors;
  s: S;
  actions: DetailActions;
}) {
  const tr = useTranslation();
  const { t, tPlural, format } = tr;
  const f = factsOf(item);
  const isLead = item.kind === 'lead';
  const menuStyles = useMemo(() => getBookingsStyles(theme), [theme]);
  const [noteOpen, setNoteOpen] = useState(false);

  // When they were answered, read from the lead's history — best-effort, so a
  // failure only drops the "you replied" half of the line.
  const activity = useLeadActivity(isLead ? item.id : null).data;
  const repliedAt = activity?.find((a) => a.action === 'LEAD_REPLIED')?.createdAt ?? null;

  const days = waitingDays(item.createdAt, now);
  const at = format.time(item.createdAt);
  const when =
    days === 0
      ? t('leads.when.today', { time: at })
      : days === 1
        ? t('leads.when.yesterday', { time: at })
        : format.dateTime(item.createdAt);
  const meta = [
    t(isLead ? 'leads.meta.form' : 'leads.meta.client', { when }),
    item.group === 'waiting' && repliedAt
      ? t('leads.meta.replied', { date: format.dayMonth(repliedAt) })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // ── status ──
  const booked =
    item.kind === 'lead'
      ? item.lead.status === 'BOOKED'
      : item.inquiry.status !== 'PENDING' && item.inquiry.status !== 'REJECTED';
  const [statusKey, fg, bg]: [TranslationKey, string, string] =
    item.group === 'reply'
      ? [isLead ? 'leads.status.new' : 'leads.status.request', c.infoText, c.infoBg]
      : item.group === 'waiting'
        ? ['leads.status.waiting', c.neutralText, c.neutralBg]
        : booked
          ? ['leads.status.booked', c.successText, c.successBg]
          : ['leads.status.declined', c.neutralText, c.neutralBg];

  // ── the date, and whether the studio is free then ──
  const avail = availabilityOn(f.date, bookings);
  const untilDays = f.date
    ? Math.round(
        (new Date(`${f.date}T00:00:00`).getTime() -
          new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
          86_400_000
      )
    : null;
  const relative =
    untilDays === null || untilDays < 0
      ? null
      : untilDays < 60
        ? tPlural('bookings.stat.inDays', untilDays)
        : tPlural('leads.relative.months', Math.round(untilDays / 30.4));
  let availText: string;
  let availStyle: React.CSSProperties;
  if (avail.kind === 'free') {
    availText = t('leads.avail.free');
    availStyle = statusPill(c.successText, c.successBg);
  } else if (avail.kind === 'busy') {
    const first = avail.bookings[0];
    const who = [first.clientName, first.eventType, first.eventTime?.slice(0, 5)]
      .filter(Boolean)
      .join(' · ');
    availText =
      avail.bookings.length > 1
        ? tPlural('leads.avail.busyMore', avail.bookings.length - 1, { who })
        : t('leads.avail.busy', { who });
    availStyle = statusPill(c.warningText, c.warningBg);
  } else {
    availText = t('leads.avail.noDate');
    availStyle = statusPill(c.neutralText, c.neutralBg);
  }

  // ── why it scored as it did ──
  const factors = priorityFactors(item);
  const list = (fs: Factor[]) => fs.map((x) => t(FACTOR_KEY[x])).join(', ');
  const prio = [
    t(SCORE_LABEL_KEY[f.score]),
    factors.strong.length ? t('leads.priority.strong', { list: list(factors.strong) }) : null,
    factors.weak.length ? t('leads.priority.weak', { list: list(factors.weak) }) : null,
    !isLead ? t('leads.priority.inquiry') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // ── drafts, in the photographer's own mail app ──
  const dateFrag = f.date
    ? t('leads.draft.forDate', { date: format.dayMonthYearLong(f.date) })
    : '';
  const subject = t('leads.draft.subject', { date: dateFrag });
  const body = (key: TranslationKey) => t(key, { name: f.firstName, date: dateFrag });
  const draft = (key: TranslationKey) => (f.email ? mailtoHref(f.email, subject, body(key)) : null);
  const replyHref = draft(isLead ? 'leads.draft.reply' : 'leads.draft.accept');
  const declineHref = draft('leads.draft.decline');
  const followUpHref = draft('leads.draft.followUp');
  const wa = whatsappHref(f.phone);
  const waHref = wa ? withWhatsappText(wa, body('leads.draft.reply').trim()) : null;

  // ── the "…" menu: the same moves, without a draft ──
  const menu: MenuItem[] = [];
  if (isLead && item.group === 'reply') {
    menu.push({
      key: 'replied',
      label: t('leads.menu.markReplied'),
      onSelect: () => actions.onReplied(item, false),
    });
  }
  if (item.group !== 'closed') {
    menu.push({
      key: 'reject',
      label: t('leads.menu.reject'),
      danger: true,
      onSelect: () => actions.onDeclined(item, false),
    });
  }

  const mailIcon = (
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
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
    </svg>
  );

  // The answer. On a phone it sits in a bar under the thumb.
  const replyButtons =
    item.group !== 'reply' ? null : isLead ? (
      <>
        {replyHref && (
          <a
            href={replyHref}
            className="ui-press ui-btn-primary"
            style={{ ...linkButton(c, 'primary'), ...(isPhone ? { flex: 1 } : null) }}
            onClick={() => actions.onReplied(item, true)}
          >
            {mailIcon}
            {t('leads.reply.email')}
          </a>
        )}
        {waHref && (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="ui-press ui-btn-secondary"
            style={linkButton(c, 'secondary')}
            onClick={() => actions.onReplied(item, true)}
          >
            {t('contact.whatsapp')}
          </a>
        )}
        {f.phone && !isPhone && (
          <a
            href={`tel:${f.phone}`}
            className="ui-press ui-btn-secondary"
            style={linkButton(c, 'secondary')}
          >
            {t('leads.reply.call')}
          </a>
        )}
      </>
    ) : replyHref ? (
      <a
        href={replyHref}
        className="ui-press ui-btn-primary"
        style={{ ...linkButton(c, 'primary'), ...(isPhone ? { flex: 1 } : null) }}
        onClick={actions.onAccept}
      >
        {mailIcon}
        {t('leads.reply.accept')}
      </a>
    ) : (
      <Button variant="primary" onClick={actions.onAccept}>
        {t('leads.reply.accept')}
      </Button>
    );

  const hint =
    item.group !== 'reply'
      ? null
      : isLead
        ? replyHref
          ? t('leads.reply.hint', { name: f.firstName })
          : t('leads.reply.noEmail')
        : t('leads.reply.acceptHint', { name: f.firstName });

  return (
    <div style={s.scroll}>
      <div style={s.article}>
        <header style={s.header}>
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <div style={s.titleRow}>
              <h2 style={s.title}>{f.name}</h2>
              <span style={statusPill(fg, bg)}>{t(statusKey)}</span>
              {f.score === 'HIGH' && item.group !== 'closed' && (
                <span style={statusPill(c.onPrimary, c.primarySolid)}>
                  {t(SCORE_LABEL_KEY.HIGH)}
                </span>
              )}
            </div>
            <p style={s.meta}>{meta}</p>
          </div>
          {menu.length > 0 && (
            <BookingActionMenu
              label={t('leads.moreActions')}
              styles={menuStyles}
              colors={c}
              items={menu}
            />
          )}
        </header>

        {f.message && <p style={s.message}>{f.message}</p>}

        <div style={s.facts} aria-label={t('leads.avail.aria')} role="group">
          {/* Icon in its own column, so on a phone the text wraps under the
              text — not the icon alone on a line above it. */}
          <div style={s.factLine}>
            <CalendarIcon />
            <span style={s.factText}>
              {f.date && (
                <span style={s.factStrong}>
                  {format.fullDate(f.date)}
                  {relative ? ` · ${relative}` : ''}
                </span>
              )}
              {item.group !== 'closed' && <span style={availStyle}>{availText}</span>}
            </span>
          </div>
          <div style={s.factLine}>
            <CameraIcon />
            <span style={s.factText}>
              <span style={s.factStrong}>
                {[occasionOf(item, t), budgetOf(item, t), f.location].filter(Boolean).join(' · ')}
              </span>
            </span>
          </div>
          <p style={s.prio}>{prio}</p>
        </div>

        {item.group === 'reply' && !isPhone && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={s.actions}>{replyButtons}</div>
            {hint && <p style={s.hint}>{hint}</p>}
          </section>
        )}
        {item.group === 'reply' && isPhone && hint && <p style={s.hint}>{hint}</p>}

        {item.group === 'waiting' && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ margin: 0, color: c.textMuted }}>
              {t('leads.waiting.text', { name: f.firstName })}
            </p>
            <div style={s.actions}>
              <button
                type="button"
                className="ui-press ui-btn-primary"
                style={linkButton(c, 'primary')}
                onClick={actions.onConvert}
              >
                {t('leads.convertToBooking')}
              </button>
              {followUpHref && (
                <a
                  href={followUpHref}
                  className="ui-press ui-btn-secondary"
                  style={linkButton(c, 'secondary')}
                >
                  {t('leads.waiting.followUp')}
                </a>
              )}
            </div>
          </section>
        )}

        {item.group === 'closed' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={s.closedNote}>
              {booked ? t('leads.closed.booked') : t('leads.closed.declined')}
            </p>
            {booked && (
              <div>
                <Button variant="secondary" onClick={actions.onViewBookings}>
                  {t('leads.viewInBookings')} →
                </Button>
              </div>
            )}
          </div>
        )}

        {item.group !== 'closed' && (
          <div style={s.links}>
            {isLead && item.group === 'reply' && (
              <button
                type="button"
                className="txt-link"
                style={s.linkButton}
                onClick={actions.onConvert}
              >
                {t('leads.convertToBooking')}
              </button>
            )}
            {declineHref ? (
              <a
                href={declineHref}
                className="txt-link"
                style={s.linkButton}
                onClick={() => actions.onDeclined(item, true)}
              >
                {t('leads.decline')}
              </a>
            ) : (
              <button
                type="button"
                className="txt-link"
                style={s.linkButton}
                onClick={() => actions.onDeclined(item, false)}
              >
                {t('leads.decline')}
              </button>
            )}
            {isLead && (
              <button
                type="button"
                className="txt-link"
                style={s.linkButton}
                aria-expanded={noteOpen || !!item.lead.internalNotes}
                onClick={() => setNoteOpen((o) => !o)}
              >
                {item.lead.internalNotes ? t('leads.note.show') : t('leads.note.add')}
              </button>
            )}
          </div>
        )}

        {isLead && (noteOpen || !!item.lead.internalNotes) && (
          <LeadNote key={item.id} lead={item.lead} c={c} />
        )}
      </div>

      {item.group === 'reply' && isPhone && <div style={s.stickyBar}>{replyButtons}</div>}
    </div>
  );
}

/**
 * The private note, edited where it is read — it used to need its own dialog.
 * Saves on blur or ⌘/Ctrl+Enter; keyed by lead, so a draft never follows the
 * photographer to another request.
 */
function LeadNote({ lead, c }: { lead: Lead; c: Colors }) {
  const { t } = useTranslation();
  const save = useUpdateLeadNotes();
  const [draft, setDraft] = useState(lead.internalNotes ?? '');
  const [saved, setSaved] = useState(lead.internalNotes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const fromServer = lead.internalNotes ?? '';

  // Changed elsewhere: adopt it unless a draft is open.
  useEffect(() => {
    setDraft((d) => (d.trim() === savedRef.current.trim() ? fromServer : d));
    setSaved(fromServer);
  }, [fromServer]);

  const dirty = draft.trim() !== saved.trim();
  function submit() {
    if (!dirty || save.isPending) return;
    const note = draft;
    setError(null);
    save.mutate(
      { id: lead.id, notes: note.trim() || null },
      {
        onSuccess: () => {
          setSaved(note);
          setJustSaved(true);
        },
        onError: (err) => setError(extractApiError(err, t('editNote.errSubmit'))),
      }
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={`ld-note-${lead.id}`} style={{ fontSize: 13, color: c.textSubtle }}>
        {t('leads.note.label')}
      </label>
      <textarea
        id={`ld-note-${lead.id}`}
        rows={2}
        value={draft}
        placeholder={t('leads.note.placeholder')}
        onChange={(e) => {
          setDraft(e.target.value);
          setJustSaved(false);
        }}
        onBlur={submit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          resize: 'vertical',
          border: `1px solid ${c.border}`,
          borderRadius: 10,
          padding: '10px 12px',
          font: 'inherit',
          fontSize: 14,
          lineHeight: 1.55,
          color: c.text,
          background: c.surfaceAlt,
        }}
      />
      <span aria-live="polite" style={{ fontSize: 12, color: c.textSubtle, minHeight: 16 }}>
        {save.isPending
          ? t('bookings.notes.saving')
          : justSaved && !dirty
            ? t('bookings.notes.saved')
            : ''}
      </span>
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}

function CalendarIcon() {
  return (
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
      style={{ flexShrink: 0 }}
    >
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    </svg>
  );
}

function CameraIcon() {
  return (
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
      style={{ flexShrink: 0 }}
    >
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </svg>
  );
}
