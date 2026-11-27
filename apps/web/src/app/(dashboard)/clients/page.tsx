'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useThemeStore } from '@/store/themeStore';
import { Client } from '@/types/api';
import { useClients, useUpdateClientNotes } from '@/hooks/useClients';
import { getInitials, pickAvatarColor } from '@/lib/avatar';
import { whatsappHref } from '@/lib/helpers';
import { StatStrip } from '@/components/StatStrip';
import { useTranslation, type TranslationKey } from '@/lib/i18n';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { MobilePaneBack } from '@/components/MobilePaneBack';
import { getClientsColors, getClientsStyles, type ClientsTheme } from './clients.styles';
import { ClientRecords } from './ClientRecords';

type ClientFilter = 'All' | 'Active' | 'Repeat';

/** Stable while the query has no data, so the filters below do not recompute every render. */
const NO_CLIENTS: Client[] = [];

const FILTER_LABEL_KEY: Record<ClientFilter, TranslationKey> = {
  All: 'clients.filter.All',
  Active: 'clients.filter.Active',
  Repeat: 'clients.filter.Repeat',
};

const ICONS = {
  search: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  ),
  plus: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  whatsapp: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.6 6.32A7.85 7.85 0 0 0 12.05 4a7.94 7.94 0 0 0-6.88 11.91L4 20l4.2-1.1a7.93 7.93 0 0 0 3.84.98h.01a7.94 7.94 0 0 0 5.55-13.56Zm-5.55 12.21h-.01a6.6 6.6 0 0 1-3.36-.92l-.24-.14-2.5.65.67-2.43-.16-.25a6.6 6.6 0 0 1 10.3-8.13 6.55 6.55 0 0 1 1.94 4.69 6.6 6.6 0 0 1-6.64 6.53Zm3.61-4.94c-.2-.1-1.18-.58-1.36-.65s-.31-.1-.45.1c-.13.2-.5.65-.62.78-.11.13-.23.15-.43.05a5.42 5.42 0 0 1-1.6-.99 6 6 0 0 1-1.1-1.38c-.12-.2 0-.31.09-.41.09-.09.2-.23.3-.34.1-.12.13-.2.2-.33.07-.13.03-.25-.02-.35-.05-.1-.45-1.08-.61-1.48-.16-.39-.32-.34-.45-.34h-.38a.74.74 0 0 0-.53.25 2.21 2.21 0 0 0-.7 1.65c0 .97.71 1.91.81 2.05.1.13 1.4 2.13 3.39 2.99.47.2.85.32 1.14.41.48.15.92.13 1.26.08.39-.06 1.18-.48 1.35-.95.16-.47.16-.87.12-.95-.05-.08-.18-.13-.38-.23Z" />
    </svg>
  ),
  email: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  ),
};

type Styles = Record<string, React.CSSProperties>;
type ColorTokens = ReturnType<typeof getClientsColors>;

function ClientListItem({
  client,
  isActive,
  isHovered,
  onSelect,
  onHover,
  s,
  c,
}: Readonly<{
  client: Client;
  isActive: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onHover: (_hov: boolean) => void;
  s: Styles;
  c: ColorTokens;
}>) {
  const { t, tPlural, format } = useTranslation();
  const avatar = pickAvatarColor(client.id || client.fullName, c.isDark);

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
      <span style={{ ...s.listItemAvatar, background: avatar.bg, color: avatar.fg }}>
        {getInitials(client.fullName)}
      </span>
      <div style={s.listItemContent}>
        <span style={s.listItemName}>{client.fullName}</span>
        <span style={s.listItemMeta}>
          {tPlural('clients.bookingCount', client.totalBookings)} ·{' '}
          {format.eur(client.totalSpentCents)}
        </span>
      </div>
      {client.upcomingBookings > 0 ? (
        <span
          style={{
            ...s.badgeSm,
            background: c.primaryBg,
            color: c.primaryStrong,
          }}
        >
          <span style={{ ...s.badgeDot, background: c.primary }} />
          {t('clients.upcomingBadge', { count: client.upcomingBookings })}
        </span>
      ) : null}
    </button>
  );
}

function ClientDetail({
  client,
  s,
  c,
  onNewBooking,
}: Readonly<{
  client: Client | null;
  s: Styles;
  c: ColorTokens;
  onNewBooking: () => void;
}>) {
  const { t, format } = useTranslation();
  if (!client) {
    return (
      <div style={s.emptyState}>
        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: c.text }}>
          {t('clientDetail.noneSelectedTitle')}
        </div>
        <div>{t('clientDetail.noneSelectedBody')}</div>
      </div>
    );
  }

  const lastBookingDate = client.lastBookingDate ? new Date(client.lastBookingDate) : null;
  const joinedDate = new Date(client.createdAt);
  const avatar = pickAvatarColor(client.id || client.fullName, c.isDark);
  const waHref = whatsappHref(client.phone);

  return (
    <>
      <div style={s.detailHeader}>
        <div style={s.detailHeaderLeft}>
          <span style={{ ...s.detailAvatar, background: avatar.bg, color: avatar.fg }}>
            {getInitials(client.fullName)}
          </span>
          <div style={s.detailHeaderText}>
            <div style={s.detailTitleRow}>
              <span style={s.detailTitle}>{client.fullName}</span>
              {client.upcomingBookings > 0 ? (
                <span
                  style={{
                    ...s.badge,
                    background: c.primaryBg,
                    color: c.primaryStrong,
                  }}
                >
                  <span style={{ ...s.badgeDot, background: c.primary }} />
                  {t('clients.upcomingBadge', { count: client.upcomingBookings })}
                </span>
              ) : null}
            </div>
            <span style={s.detailSubtitle}>
              {t('clientDetail.joined', { date: format.monthYear(joinedDate) })}
            </span>
          </div>
        </div>
        <div style={s.detailActions}>
          <a
            href={waHref ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!waHref}
            title={waHref ? t('contact.whatsappTitle') : t('contact.noPhone')}
            style={{
              ...s.secondaryButton,
              textDecoration: 'none',
              ...(waHref ? {} : { opacity: 0.5, pointerEvents: 'none' }),
            }}
          >
            {ICONS.whatsapp} {t('contact.whatsapp')}
          </a>
          <a
            href={`mailto:${client.email}`}
            title={t('contact.emailTitle', { email: client.email })}
            style={{ ...s.secondaryButton, textDecoration: 'none' }}
          >
            {ICONS.email} {t('contact.email')}
          </a>
          <button type="button" style={s.invertedPrimaryButton} onClick={onNewBooking}>
            {ICONS.plus} {t('bookings.newBooking')}
          </button>
        </div>
      </div>

      <div style={s.detailBody}>
        <div style={s.statsGrid}>
          <div style={s.statBox}>
            <span style={s.statBoxLabel}>{t('clientDetail.stat.totalSpent')}</span>
            <span style={s.statBoxValue}>{format.eur(client.totalSpentCents)}</span>
          </div>
          <div style={s.statBox}>
            <span style={s.statBoxLabel}>{t('clientDetail.stat.bookings')}</span>
            <span style={s.statBoxValue}>{client.totalBookings}</span>
          </div>
          <div style={s.statBox}>
            <span style={s.statBoxLabel}>{t('clientDetail.stat.upcoming')}</span>
            <span style={s.statBoxValue}>{client.upcomingBookings}</span>
          </div>
          <div style={s.statBox}>
            <span style={s.statBoxLabel}>{t('clientDetail.stat.lastSession')}</span>
            <span style={s.statBoxValue}>
              {lastBookingDate ? format.monthDay(lastBookingDate) : '—'}
            </span>
          </div>
        </div>

        <div style={s.section}>
          <span style={s.sectionTitle}>{t('clientDetail.contactInfo')}</span>
          <div style={s.sectionCard}>
            <div style={s.infoGrid}>
              <div style={s.infoRow}>
                <span style={s.infoLabel}>{t('clientDetail.email')}</span>
                <span style={s.infoValue}>{client.email}</span>
              </div>
              <div style={s.infoRow}>
                <span style={s.infoLabel}>{t('clientDetail.phone')}</span>
                <span style={s.infoValue}>{client.phone || '—'}</span>
              </div>
              <div style={s.infoRow}>
                <span style={s.infoLabel}>{t('clientDetail.joinedLabel')}</span>
                <span style={s.infoValue}>{format.monthDayYear(joinedDate)}</span>
              </div>
            </div>
          </div>
        </div>

        <ClientRecords clientId={client.id} s={s} />

        <div style={s.section}>
          <span style={s.sectionTitle}>{t('clientDetail.notes')}</span>
          <NotesEditor
            key={client.id}
            clientId={client.id}
            initialNotes={client.notes ?? ''}
            s={s}
            c={c}
          />
        </div>
      </div>
    </>
  );
}

/**
 * Inline notes editor. Keyed on the client id by the parent so switching
 * clients resets the draft rather than leaking one client's unsaved text onto
 * another.
 */
function NotesEditor({
  clientId,
  initialNotes,
  s,
  c,
}: Readonly<{
  clientId: string;
  initialNotes: string;
  s: Styles;
  c: ColorTokens;
}>) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialNotes);
  const updateNotes = useUpdateClientNotes();
  const saving = updateNotes.isPending;
  const error = updateNotes.isError;

  function save() {
    updateNotes.mutate(
      { id: clientId, notes: value.trim() },
      { onSuccess: () => setEditing(false) }
    );
  }

  if (!editing) {
    return (
      <>
        <div style={s.notesReadonly}>
          {initialNotes.trim() ? initialNotes : t('clientDetail.noNotes')}
        </div>
        <button
          type="button"
          style={{ ...s.secondaryButton, marginTop: 10, alignSelf: 'flex-start' }}
          onClick={() => {
            setValue(initialNotes);
            setEditing(true);
          }}
        >
          {t('clientDetail.notesEdit')}
        </button>
      </>
    );
  }

  return (
    <>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t('clientDetail.notesPlaceholder')}
        rows={5}
        autoFocus
        style={{
          width: '100%',
          resize: 'vertical',
          padding: '12px 14px',
          borderRadius: 12,
          border: `1px solid ${c.border}`,
          background: c.surface,
          color: c.text,
          fontSize: '0.9rem',
          fontFamily: 'inherit',
          lineHeight: 1.5,
        }}
      />
      {error && (
        <span style={{ color: c.dangerText, fontSize: '0.82rem', marginTop: 6 }}>
          {t('clientDetail.notesError')}
        </span>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        <button type="button" style={s.invertedPrimaryButton} onClick={save} disabled={saving}>
          {saving ? t('clientDetail.notesSaving') : t('clientDetail.notesSave')}
        </button>
        <button
          type="button"
          style={s.secondaryButton}
          onClick={() => setEditing(false)}
          disabled={saving}
        >
          {t('clientDetail.notesCancel')}
        </button>
      </div>
    </>
  );
}

function ClientListSkeleton({ s }: Readonly<{ s: Styles }>) {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={s.skeletonItem}>
          <div style={{ ...s.skeletonBlock, width: 44, height: 44, borderRadius: 12 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ ...s.skeletonBlock, height: 12, width: '60%' }} />
            <div style={{ ...s.skeletonBlock, height: 10, width: '40%' }} />
          </div>
        </div>
      ))}
    </>
  );
}

function ClientsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useThemeStore();
  const { t, format } = useTranslation();
  const themeKey: ClientsTheme = theme === 'dark' ? 'dark' : 'light';
  const s = useMemo(() => getClientsStyles(themeKey), [themeKey]);
  const c = useMemo(() => getClientsColors(themeKey), [themeKey]);

  const clientsQuery = useClients();
  const clients = clientsQuery.data ?? NO_CLIENTS;
  const loading = clientsQuery.isLoading;
  const loadFailed = clientsQuery.isError && !clientsQuery.data;
  // A deep link (?selected=<clientId>) picks the client; otherwise the detail
  // pane falls back to the first visible row (see selectedClient below).
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  useEffect(() => {
    const selected = searchParams.get('selected');
    if (selected) setSelectedClientId(selected);
  }, [searchParams]);

  // Same narrow-screen treatment as Bookings and Leads: the 380px master column
  // and the detail pane cannot share a phone, so they take turns.
  const isNarrow = useMediaQuery('(max-width: 900px)');
  const [mobilePane, setMobilePane] = useState<'list' | 'detail'>('list');
  const [filterStatus, setFilterStatus] = useState<ClientFilter>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const filteredClients = useMemo(() => {
    let list = clients;
    if (filterStatus === 'Active') list = list.filter((cl) => cl.upcomingBookings > 0);
    else if (filterStatus === 'Repeat') list = list.filter((cl) => cl.totalBookings > 1);

    const q = searchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter((cl) => {
        const haystack = `${cl.fullName} ${cl.email}`.toLowerCase();
        return haystack.includes(q);
      });
    }
    return list;
  }, [clients, filterStatus, searchTerm]);

  const selectedClient = useMemo(
    () => filteredClients.find((cl) => cl.id === selectedClientId) || filteredClients[0] || null,
    [filteredClients, selectedClientId]
  );

  const stats = useMemo(() => {
    const total = clients.length;
    const active = clients.filter((cl) => cl.upcomingBookings > 0).length;
    const totalRevenueCents = clients.reduce((sum, cl) => sum + cl.totalSpentCents, 0);
    const avgSpendCents = total > 0 ? Math.round(totalRevenueCents / total) : 0;
    return { total, active, totalRevenueCents, avgSpendCents };
  }, [clients]);

  return (
    <div style={s.pageWrapper}>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
      <div style={s.pageHeader}>
        <div>
          <h1 style={s.pageTitle}>{t('clients.title')}</h1>
          <p style={s.pageSubtitle}>{t('clients.subtitle')}</p>
        </div>
        <div style={s.headerActions}>
          <button
            type="button"
            style={s.invertedPrimaryButton}
            onClick={() => router.push('/bookings')}
          >
            {ICONS.plus} {t('bookings.newBooking')}
          </button>
        </div>
      </div>

      <StatStrip
        aria-label={t('clients.title')}
        items={[
          {
            label: t('clients.stat.total'),
            value: String(stats.total),
            trend: t('clients.stat.totalHint', { amount: format.eur(stats.totalRevenueCents) }),
          },
          {
            label: t('bookings.stat.active'),
            value: String(stats.active),
            trend: t('clients.stat.activeHint'),
          },
          {
            label: t('clients.stat.avgSpend'),
            value: format.eur(stats.avgSpendCents),
            trend: t('clients.stat.avgSpendHint'),
          },
        ]}
      />

      {loadFailed ? (
        <div style={{ ...s.listPanel, maxHeight: 'none' }}>
          <div style={s.errorPanel}>
            <div style={s.errorPanelTitle}>{t('clients.errorTitle')}</div>
            <div style={s.errorPanelText}>{t('clients.errorLoad')}</div>
            <button type="button" style={s.retryButton} onClick={() => clientsQuery.refetch()}>
              {t('common.tryAgain')}
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            ...s.container,
            // One pane at a time below the breakpoint, so one track: the fixed
            // 380px master column otherwise survives alone and pushes the page
            // 18px wider than a phone.
            ...(isNarrow ? { gridTemplateColumns: 'minmax(0, 1fr)' } : {}),
          }}
        >
          <div
            style={{
              ...s.listPanel,
              ...(isNarrow && mobilePane === 'detail' ? { display: 'none' } : {}),
            }}
          >
            <div style={s.listHeader}>
              <span style={s.listTitle}>{t('clients.listTitle')}</span>
              <span style={s.listSubtitle}>{t('clients.listSubtitle')}</span>
              <div style={s.searchWrapper}>
                <span style={s.searchIcon}>{ICONS.search}</span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t('clients.search.placeholder')}
                  style={s.searchBox}
                />
              </div>
            </div>

            <div style={s.filterTabs}>
              {(['All', 'Active', 'Repeat'] as ClientFilter[]).map((status) => {
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
                    {t(FILTER_LABEL_KEY[status])}
                  </button>
                );
              })}
            </div>

            <div style={s.listScroll}>
              {loading ? (
                <ClientListSkeleton s={s} />
              ) : clients.length === 0 ? (
                <div style={s.emptyState}>
                  <div style={{ color: c.text, fontWeight: 600 }}>
                    {t('clients.empty.noneTitle')}
                  </div>
                  <div>{t('clients.empty.noneBody')}</div>
                  <button
                    type="button"
                    style={{ ...s.primaryButton, marginTop: '4px' }}
                    onClick={() => router.push('/bookings')}
                  >
                    {ICONS.plus} {t('bookings.newBooking')}
                  </button>
                </div>
              ) : filteredClients.length === 0 ? (
                <div style={s.emptyState}>
                  <div style={{ color: c.text, fontWeight: 600 }}>
                    {t('clients.empty.noMatchTitle')}
                  </div>
                  <div>{t('common.tryOtherFilter')}</div>
                </div>
              ) : (
                filteredClients.map((client) => (
                  <ClientListItem
                    key={client.id}
                    client={client}
                    isActive={selectedClient?.id === client.id}
                    isHovered={hoveredId === client.id}
                    onSelect={() => {
                      setSelectedClientId(client.id);
                      if (isNarrow) setMobilePane('detail');
                    }}
                    onHover={(hov) => setHoveredId(hov ? client.id : null)}
                    s={s}
                    c={c}
                  />
                ))
              )}
            </div>
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
                  label={t('clients.backToList')}
                  style={s.backButton}
                  onClick={() => setMobilePane('list')}
                />
              </div>
            )}
            {loading ? (
              <div style={s.emptyState}>{t('clients.loadingDetails')}</div>
            ) : (
              <ClientDetail
                client={selectedClient}
                s={s}
                c={c}
                onNewBooking={() => router.push('/bookings')}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * `useSearchParams` needs a Suspense boundary in the app router — without one
 * the whole route bails out of prerendering and the build fails.
 */
export default function ClientsPage() {
  return (
    <Suspense fallback={null}>
      <ClientsView />
    </Suspense>
  );
}
