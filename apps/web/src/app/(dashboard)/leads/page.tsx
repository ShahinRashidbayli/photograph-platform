'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useThemeStore } from '@/store/themeStore';
import { Toast } from '@/components/Toast';
import { Alert, Button } from '@/components/ui';
import { PersonalNoteDialog } from '@/components/PersonalNoteDialog';
import { useTranslation } from '@/lib/i18n';
import { asyncErrorText } from '@/lib/async-error';
import { useInquiries, useLeads } from '@/hooks/useLeads';
import { useBookings } from '@/hooks/useBookings';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { MobilePaneBack } from '@/components/MobilePaneBack';
import type { Lead } from '@/types/api';
import { BookingActionMenu } from '../bookings/BookingActionMenu';
import { getBookingsStyles } from '../bookings/bookings.styles';
import { getLeadsColors, getLeadsStyles, type LeadsTheme } from './leads.styles';
import { getInboxStyles } from './inbox.styles';
import { LeadListSkeleton } from './LeadListSkeleton';
import { AddLeadModal } from './AddLeadModal';
import { ConvertLeadModal } from './ConvertLeadModal';
import { InboxList } from './InboxList';
import { InboxDetail } from './InboxDetail';
import { useLeadActions } from './useLeadActions';
import { useDeferredStatus } from './useDeferredStatus';
import { buildInbox, factsOf, type InboxItem, type PendingStatus } from './leads.inbox';
import { inquiryDisplayName, type Inquiry } from './inquiryTypes';

/** Stable while a query has no data, so the memos below do not recompute every render. */
const NO_LEADS: Lead[] = [];
const NO_INQUIRIES: Inquiry[] = [];

type ToastState = { message: string; undo?: PendingStatus };

/**
 * Renders a translated sentence with one segment in bold. The template carries
 * a placeholder (e.g. "Converted {name} to a booking.") which we split on, so
 * each language keeps its own word order — German puts the name first.
 */
function bold(template: string, placeholder: string, value: string) {
  const [before, after] = template.split(placeholder);
  return (
    <>
      {before}
      <strong>{value}</strong>
      {after}
    </>
  );
}

const keyOf = (i: { kind: string; id: string }) => `${i.kind}:${i.id}`;

/**
 * The leads inbox — where a client's request first arrives and gets its
 * first answer.
 *
 * <p>It used to be a CRM view: pipeline tabs, a filter popover, a sort row, a
 * yellow banner, fact cards, score bars, an activity log and a row of four
 * tinted buttons. For a first contact the photographer needs four things —
 * who, what they wrote, am I free that day, and a way to answer — so that is
 * what the page now is, with everything else one quiet link away.
 */
function LeadsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useThemeStore();
  const { t, tPlural } = useTranslation();
  const themeKey: LeadsTheme = theme === 'dark' ? 'dark' : 'light';
  const s = useMemo(() => getLeadsStyles(themeKey), [themeKey]);
  const c = useMemo(() => getLeadsColors(themeKey), [themeKey]);
  const ins = useMemo(() => getInboxStyles(c), [c]);
  const menuStyles = useMemo(() => getBookingsStyles(themeKey), [themeKey]);

  const leadsQuery = useLeads();
  // Best-effort: a failure here reads as "no inquiries" (see useInquiries), so
  // only the leads can fail the inbox.
  const inquiriesQuery = useInquiries();
  // For "are you free that day" — the list the bookings page already caches.
  const { data: bookings = [] } = useBookings(true);
  const leads = leadsQuery.data ?? NO_LEADS;
  const inquiries = inquiriesQuery.data ?? NO_INQUIRIES;
  const loading = leadsQuery.isLoading || inquiriesQuery.isLoading;
  const loadFailed = leadsQuery.isError && !leadsQuery.data;
  const reload = () => {
    void leadsQuery.refetch();
    void inquiriesQuery.refetch();
  };

  const actions = useLeadActions();
  const { reportError } = actions;
  const [toast, setToast] = useState<ToastState | null>(null);
  const { pending, schedule, undo } = useDeferredStatus(
    useCallback(
      (err: unknown, change: PendingStatus) => {
        setToast(null);
        reportError(err, change.status === 'REPLIED' ? 'leads.error.reply' : 'leads.error.reject');
      },
      [reportError]
    )
  );

  const [search, setSearch] = useState('');
  const [closedOpen, setClosedOpen] = useState(false);
  const now = useMemo(() => new Date(), []);
  const inbox = useMemo(
    () => buildInbox(leads, inquiries, search, pending),
    [leads, inquiries, search, pending]
  );

  // Below this width the list and the request are two screens with a back
  // button. ROADMAP §4.5 has the photographer answering on a phone, which is
  // why the phone gets the reply bar under the thumb.
  const isNarrow = useMediaQuery('(max-width: 900px)');
  const isPhone = useMediaQuery('(max-width: 640px)');
  const [mobilePane, setMobilePane] = useState<'list' | 'detail'>('list');

  // Deep-link (?selected=<leadId>) — the dashboard and the bell link to leads.
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    const sel = searchParams.get('selected');
    if (sel) setSelected(`lead:${sel}`);
  }, [searchParams]);

  // The selection, or the first request waiting for an answer.
  const all = useMemo(() => [...inbox.reply, ...inbox.waiting, ...inbox.closed], [inbox]);
  const current: InboxItem | null = useMemo(
    () => all.find((i) => keyOf(i) === selected) ?? all[0] ?? null,
    [all, selected]
  );
  // A deep link to a closed request opens the closed group so the row is visible.
  useEffect(() => {
    if (current?.group === 'closed') setClosedOpen(true);
  }, [current?.group]);

  function move(item: InboxItem, status: PendingStatus['status'], viaDraft: boolean) {
    const change: PendingStatus = { kind: item.kind, id: item.id, status };
    schedule(change);
    const name = factsOf(item).name;
    const key =
      status === 'REPLIED'
        ? viaDraft
          ? 'leads.toast.replied'
          : 'leads.toast.markedReplied'
        : viaDraft
          ? 'leads.toast.declined'
          : 'leads.toast.rejected';
    setToast({ message: t(key, { name }), undo: change });
  }

  const pendingCount = inbox.reply.length;

  return (
    <div style={s.pageWrapper}>
      {actions.actionError && (
        <Alert
          tone="danger"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span>{asyncErrorText(actions.actionError, t)}</span>
          <button
            type="button"
            aria-label={t('common.close')}
            onClick={actions.dismissActionError}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: '1.1rem',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </Alert>
      )}

      {actions.convertSuccess && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: '12px',
            background: c.successBg,
            color: c.successText,
            border: `1px solid ${c.successBorder}`,
            fontSize: '0.9rem',
            fontWeight: 500,
          }}
        >
          <span>{bold(t('leads.converted'), '{name}', actions.convertSuccess.leadName)}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={() => router.push('/bookings')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              {t('leads.viewInBookings')} →
            </button>
            <button
              type="button"
              aria-label={t('common.close')}
              onClick={actions.dismissConvertSuccess}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                fontSize: '1.1rem',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </span>
        </div>
      )}

      {actions.convertingLead && (
        <ConvertLeadModal
          lead={actions.convertingLead}
          c={c}
          onClose={actions.cancelConvert}
          onConverted={actions.applyConverted}
        />
      )}

      {actions.addOpen && (
        <AddLeadModal
          c={c}
          onClose={actions.closeAdd}
          onCreated={(created) => {
            actions.closeAdd();
            // Open the new lead so it is visible without hunting through the
            // list — useCreateLead has already re-read the inbox.
            setSelected(`lead:${created.id}`);
          }}
        />
      )}

      {/* Header: one number, the one way to add, and a menu for the rest. */}
      <header style={s.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={s.pageTitle}>{t('leads.title')}</h1>
          <p style={{ ...s.pageSubtitle, margin: 0 }}>
            {pendingCount > 0 ? tPlural('leads.toReply', pendingCount) : t('leads.allAnswered')}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button variant="primary" onClick={actions.openAdd}>
            + {t('leads.newLead')}
          </Button>
          <BookingActionMenu
            label={t('leads.moreActions')}
            styles={menuStyles}
            colors={c}
            items={[
              {
                key: 'export',
                label: t('leads.exportCsv'),
                // A plain navigation: the browser sends the session cookie and
                // the API answers with Content-Disposition: attachment.
                onSelect: () => window.location.assign('/api/leads/export.csv'),
              },
            ]}
          />
        </div>
      </header>

      {loadFailed ? (
        <div style={{ ...s.listPanel, maxHeight: 'none' }}>
          <div style={s.errorPanel}>
            <div style={s.errorPanelTitle}>{t('leads.errorTitle')}</div>
            <div style={s.errorPanelText}>{t('leads.errorLoad')}</div>
            <button type="button" style={s.retryButton} onClick={reload}>
              {t('common.tryAgain')}
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            ...s.container,
            ...(isNarrow ? { gridTemplateColumns: 'minmax(0, 1fr)' } : {}),
          }}
        >
          <style>{`
            @media (hover: hover) {
              .ld-row:not([aria-current]):hover { background: var(--ld-row-hover); }
              .txt-link:hover { color: ${c.text} !important; text-decoration: underline !important; }
            }
          `}</style>
          <div
            style={{
              ...s.listPanel,
              ...(isNarrow && mobilePane === 'detail' ? { display: 'none' } : {}),
            }}
          >
            {loading ? (
              <div style={s.listScroll}>
                <LeadListSkeleton s={s} />
              </div>
            ) : leads.length === 0 && inquiries.length === 0 ? (
              <div style={s.emptyState}>
                <div style={{ color: c.text, fontWeight: 600 }}>{t('leads.empty.noneTitle')}</div>
                <div>{t('leads.empty.noneBody')}</div>
              </div>
            ) : (
              <InboxList
                inbox={inbox}
                selectedKey={current ? keyOf(current) : null}
                onSelect={(item) => {
                  setSelected(keyOf(item));
                  if (isNarrow) setMobilePane('detail');
                }}
                search={search}
                onSearch={setSearch}
                closedOpen={closedOpen}
                onToggleClosed={() => setClosedOpen((o) => !o)}
                now={now}
                s={ins}
              />
            )}
          </div>

          <div
            style={{
              ...s.detailPanel,
              ...(isNarrow && mobilePane === 'list' ? { display: 'none' } : {}),
            }}
          >
            {isNarrow && (
              <div style={{ padding: '16px 20px 0' }}>
                <MobilePaneBack
                  label={t('leads.backToList')}
                  style={s.backButton}
                  onClick={() => setMobilePane('list')}
                />
              </div>
            )}
            {loading ? (
              <div style={s.emptyState}>{t('leads.loadingDetails')}</div>
            ) : current ? (
              <InboxDetail
                key={keyOf(current)}
                item={current}
                now={now}
                bookings={bookings}
                isPhone={isPhone}
                theme={themeKey}
                c={c}
                s={ins}
                actions={{
                  onReplied: (item, viaDraft) => move(item, 'REPLIED', viaDraft),
                  // A client's request is decided in the note dialog: the
                  // server emails them, so there is no draft to open or undo.
                  onDeclined: (item, viaDraft) =>
                    item.kind === 'inquiry'
                      ? actions.startDecision(item.inquiry, 'REJECTED')
                      : move(item, 'REJECTED', viaDraft),
                  onAccept: () =>
                    current.kind === 'inquiry' &&
                    actions.startDecision(current.inquiry, 'ACCEPTED'),
                  onConvert: () => current.kind === 'lead' && actions.startConvert(current.lead),
                  onViewBookings: () => router.push('/bookings'),
                }}
              />
            ) : (
              <div style={s.emptyState}>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: c.text }}>
                  {search ? t('leads.empty.noMatchTitle') : t('leadDetail.noneSelectedTitle')}
                </div>
                <div>{search ? t('common.tryOtherFilter') : t('leadDetail.noneSelectedBody')}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {actions.deciding && (
        <PersonalNoteDialog
          title={t(
            actions.deciding.status === 'ACCEPTED'
              ? 'leads.decision.acceptTitle'
              : 'leads.decision.declineTitle'
          )}
          description={t(
            actions.deciding.status === 'ACCEPTED'
              ? 'leads.decision.acceptBody'
              : 'leads.decision.declineBody',
            { name: inquiryDisplayName(actions.deciding.inquiry) }
          )}
          confirmLabel={t(
            actions.deciding.status === 'ACCEPTED'
              ? 'leads.decision.accept'
              : 'leads.decision.decline'
          )}
          busy={actions.decisionPending}
          onSend={actions.decide}
          onClose={actions.cancelDecision}
        />
      )}

      {toast && (
        <Toast
          theme={themeKey}
          message={toast.message}
          actionLabel={toast.undo ? t('leads.toast.undo') : undefined}
          onAction={
            toast.undo
              ? () => {
                  if (toast.undo) undo(toast.undo);
                  setToast(null);
                }
              : undefined
          }
          duration={toast.undo ? 6000 : undefined}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}

/**
 * `useSearchParams` needs a Suspense boundary in the app router — without one
 * the whole route bails out of prerendering and the build fails.
 */
export default function LeadsPage() {
  return (
    <Suspense fallback={null}>
      <LeadsView />
    </Suspense>
  );
}
