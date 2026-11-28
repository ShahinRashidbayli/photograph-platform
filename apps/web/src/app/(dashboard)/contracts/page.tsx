'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useThemeStore } from '@/store/themeStore';
import { getColors, pageTitle } from '@/lib/design-tokens';
import { extractApiError } from '@/lib/helpers';
import { Alert, Badge, Button, Card, EmptyState, Note } from '@/components/ui';
import { UpgradeCard } from '@/components/UpgradeCard';
import { useTranslation } from '@/lib/i18n';
import { contractStatusTone, contractSubline } from '@/lib/contract-status';
import { useEntitlements } from '@/hooks/useEntitlements';
import { downloadContractPdf, useTenantContracts, type Contract } from '@/hooks/useContracts';

/**
 * Every contract in the studio, in one place.
 *
 * <p>Contracts were reachable only from the booking they belong to, which
 * answers "what did I agree with this client?" but never "which of these is
 * still unsigned?" — and the second is the question a photographer actually
 * has. `GET /api/contracts` existed from the start; nothing rendered it.
 *
 * <p>Awaiting-signature comes first and is the default filter, because it is
 * the only status that represents work in flight. Signed and withdrawn are
 * records; they matter when you go looking for them, not when you arrive.
 */
const STATUSES = ['SENT', 'DRAFT', 'SIGNED', 'CANCELLED'] as const;
type StatusFilter = 'ALL' | (typeof STATUSES)[number];

export default function ContractsPage() {
  const { t, format } = useTranslation();
  const { theme } = useThemeStore();
  const c = useMemo(() => getColors(theme), [theme]);
  const { has } = useEntitlements();
  const allowed = has('CONTRACTS');

  const { data, isLoading, isError } = useTenantContracts(allowed);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [error, setError] = useState<string | null>(null);

  const all = useMemo(() => data ?? [], [data]);
  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const k of all) out[k.status] = (out[k.status] ?? 0) + 1;
    return out;
  }, [all]);

  const shown = filter === 'ALL' ? all : all.filter((k) => k.status === filter);

  async function download(contract: Contract) {
    setError(null);
    try {
      await downloadContractPdf(
        `/api/contracts/${contract.id}/pdf`,
        `${contract.title.replace(/[^\w\s-]/g, '').trim() || 'Vertrag'}.pdf`
      );
    } catch (e) {
      setError(extractApiError(e, t('contracts.loadError')));
    }
  }

  return (
    <div style={{ padding: '28px 28px 40px', maxWidth: 900, margin: '0 auto', color: c.text }}>
      <h1 style={pageTitle}>{t('contracts.title')}</h1>
      <p style={{ fontSize: '0.95rem', color: c.textMuted, marginBottom: 22 }}>
        {t('contracts.pageSubtitle')}
      </p>

      {!allowed ? (
        <UpgradeCard
          capability="CONTRACTS"
          title={t('upgrade.contractsTitle')}
          body={t('upgrade.contractsBody')}
        />
      ) : (
        <>
          {error && (
            <Alert tone="danger" style={{ marginBottom: 14 }}>
              {error}
            </Alert>
          )}
          {isLoading && <Note>{t('contracts.loading')}</Note>}
          {isError && <Alert tone="danger">{t('contracts.loadError')}</Alert>}

          {!isLoading && !isError && all.length === 0 && (
            <Card>
              <EmptyState
                title={t('contracts.emptyTitle')}
                body={t('contracts.emptyBody')}
                action={
                  <Link href="/bookings" style={{ textDecoration: 'none' }}>
                    <Button>{t('contracts.goToBookings')}</Button>
                  </Link>
                }
              />
            </Card>
          )}

          {all.length > 0 && (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                <FilterChip
                  active={filter === 'ALL'}
                  label={t('contracts.filterAll')}
                  count={all.length}
                  colors={c}
                  onClick={() => setFilter('ALL')}
                />
                {STATUSES.filter((st) => counts[st]).map((st) => (
                  <FilterChip
                    key={st}
                    active={filter === st}
                    label={t(`contracts.status.${st}` as never)}
                    count={counts[st]}
                    colors={c}
                    onClick={() => setFilter(st)}
                  />
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {shown.map((contract) => (
                  <Card key={contract.id}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 650, fontSize: '0.98rem' }}>{contract.title}</div>
                        <div style={{ fontSize: '0.83rem', color: c.textMuted, marginTop: 3 }}>
                          {contractSubline(contract, t, format)}
                        </div>
                      </div>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
                      >
                        <Badge tone={contractStatusTone(contract.status, c)}>
                          {t(`contracts.status.${contract.status}` as never)}
                        </Badge>
                        {contract.status !== 'CANCELLED' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void download(contract)}
                          >
                            {t('contracts.action.download')}
                          </Button>
                        )}
                        {/* Editing and sending stay on the booking, where the
                            contract's context is. This page is for finding one,
                            not for a second place to change it. */}
                        <Link
                          href={`/bookings?booking=${contract.bookingId}`}
                          style={{ textDecoration: 'none' }}
                        >
                          <Button variant="ghost" size="sm">
                            {t('contracts.openBooking')}
                          </Button>
                        </Link>
                      </div>
                    </div>

                    {contract.status === 'SIGNED' && !contract.intact && (
                      <Alert tone="danger" style={{ marginTop: 10 }}>
                        {t('contracts.tampered')}
                      </Alert>
                    )}
                  </Card>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function FilterChip({
  active,
  label,
  count,
  colors: c,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  colors: ReturnType<typeof getColors>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: '6px 13px',
        borderRadius: 999,
        border: `1px solid ${active ? c.primaryBorder : c.border}`,
        background: active ? c.primaryBg : 'transparent',
        color: active ? c.primaryText : c.textMuted,
        fontSize: '0.84rem',
        fontWeight: active ? 700 : 500,
        fontFamily: 'inherit',
        cursor: 'pointer',
      }}
    >
      {label} <span style={{ opacity: 0.7 }}>{count}</span>
    </button>
  );
}
