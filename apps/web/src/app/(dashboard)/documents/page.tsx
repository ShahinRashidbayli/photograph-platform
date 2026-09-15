'use client';

import React, { useMemo, useState } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { getColors } from '@/lib/design-tokens';
import { extractApiError } from '@/lib/helpers';
import { Alert, Badge, Button, Card, EmptyState, Note } from '@/components/ui';
import { useTranslation } from '@/lib/i18n';
import {
  downloadContractPdf,
  useCustomerContracts,
  useSignContract,
  type Contract,
} from '@/hooks/useContracts';

/**
 * The client's contracts — read one, sign it, keep the PDF.
 *
 * <p>This page used to render hard-coded sample documents: a contract "awaiting
 * signature", a model release marked SIGNED, and a GDPR consent stating photos
 * are deleted 12 months after delivery. It was unlinked from the sidebar but
 * the route stayed reachable, so any signed-in client who typed the URL read
 * fabricated legal statements about their own booking — including that they had
 * signed something they never signed. It was then cut back to an honest empty
 * state until a real backend existed.
 *
 * <p>It now reads `/api/customer/contracts`, which returns only contracts
 * addressed to the signed-in customer and never a photographer's draft. Nothing
 * on this page is invented: a document appears here because a photographer sent
 * it, and it says SIGNED only once this person signed it.
 */
export default function DocumentsPage() {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const c = useMemo(() => getColors(theme), [theme]);

  const { data: contracts, isLoading, isError } = useCustomerContracts();
  const [openId, setOpenId] = useState<string | null>(null);

  const list = contracts ?? [];
  const open = list.find((k) => k.id === openId) ?? null;

  return (
    <div style={{ padding: '28px 28px 40px', maxWidth: 900, margin: '0 auto', color: c.text }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 6 }}>
        {t('contracts.sign.title')}
      </h1>
      <p style={{ fontSize: '0.95rem', color: c.textMuted, marginBottom: 24 }}>
        {t('contracts.sign.subtitle')}
      </p>

      {isLoading && <Note>{t('contracts.loading')}</Note>}
      {isError && <Alert tone="danger">{t('contracts.loadError')}</Alert>}

      {!isLoading && !isError && list.length === 0 && (
        <Card>
          <EmptyState
            title={t('contracts.sign.emptyTitle')}
            body={t('contracts.sign.emptyBody')}
          />
        </Card>
      )}

      {open ? (
        <ContractDetail contract={open} onBack={() => setOpenId(null)} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.map((contract) => (
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
                  <div style={{ fontWeight: 650, fontSize: '1rem' }}>{contract.title}</div>
                  {contract.issuerName && (
                    <div style={{ fontSize: '0.85rem', color: c.textMuted, marginTop: 3 }}>
                      {t('contracts.sign.from' as never, { name: contract.issuerName })}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Badge tone={contract.status === 'SIGNED' ? c.successText : c.warningText}>
                    {t(`contracts.status.${contract.status}` as never)}
                  </Badge>
                  <Button size="sm" onClick={() => setOpenId(contract.id)}>
                    {contract.status === 'SENT'
                      ? t('contracts.sign.open')
                      : t('contracts.sign.view')}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ContractDetail({ contract, onBack }: { contract: Contract; onBack: () => void }) {
  const { t, format } = useTranslation();
  const { theme } = useThemeStore();
  const c = useMemo(() => getColors(theme), [theme]);

  const sign = useSignContract();
  const [typedName, setTypedName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = contract.status === 'SENT' && agreed && typedName.trim().length > 1;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await sign.mutateAsync({ id: contract.id, typedName: typedName.trim() });
    } catch (err) {
      setError(extractApiError(err, t('contracts.sign.error')));
    }
  }

  async function download() {
    setError(null);
    try {
      await downloadContractPdf(
        `/api/customer/contracts/${contract.id}/pdf`,
        `${contract.title.replace(/[^\w\s-]/g, '').trim() || 'Vertrag'}.pdf`
      );
    } catch (err) {
      setError(extractApiError(err, t('contracts.loadError')));
    }
  }

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={onBack} style={{ marginBottom: 14 }}>
        ← {t('contracts.action.close')}
      </Button>

      <Card>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 750, margin: '0 0 4px' }}>
          {contract.title}
        </h2>
        {contract.issuerName && (
          <div style={{ fontSize: '0.85rem', color: c.textMuted, marginBottom: 4 }}>
            {t('contracts.sign.from' as never, { name: contract.issuerName })}
            {contract.issuerAddress ? ` · ${contract.issuerAddress}` : ''}
          </div>
        )}
        {contract.status === 'SIGNED' && contract.signedAt && (
          <div style={{ fontSize: '0.85rem', color: c.successText, marginBottom: 4 }}>
            {t('contracts.signedOn' as never, {
              date: format.monthDayYear(contract.signedAt),
            })}
          </div>
        )}

        {/* The contract text, shown exactly as it will appear in the PDF —
            same characters, same line breaks. A customer signing something
            that renders differently in the file they keep would have a fair
            complaint about which one they agreed to. */}
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            fontFamily: 'inherit',
            fontSize: '0.9rem',
            lineHeight: 1.6,
            background: c.surfaceAlt,
            border: `1px solid ${c.border}`,
            borderRadius: 10,
            padding: '16px 18px',
            margin: '14px 0 0',
            maxHeight: 480,
            overflowY: 'auto',
          }}
        >
          {contract.body}
        </pre>

        {error && (
          <Alert tone="danger" style={{ marginTop: 14 }}>
            {error}
          </Alert>
        )}

        {contract.status === 'CANCELLED' && (
          <Note style={{ marginTop: 14 }}>{t('contracts.sign.withdrawn')}</Note>
        )}

        {contract.status === 'SIGNED' && (
          <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
            <Button variant="secondary" onClick={download}>
              {t('contracts.action.download')}
            </Button>
            <span style={{ fontSize: '0.85rem', color: c.textMuted }}>
              {t('contracts.sign.done')}
            </span>
          </div>
        )}

        {contract.status === 'SENT' && (
          <form onSubmit={submit} style={{ marginTop: 18 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 10 }}>
              {t('contracts.sign.heading')}
            </div>

            <label
              htmlFor="contract-signature"
              style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6 }}
            >
              {t('contracts.sign.nameLabel')}
            </label>
            <input
              id="contract-signature"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder={t('contracts.sign.namePlaceholder')}
              maxLength={200}
              style={{
                width: '100%',
                maxWidth: 380,
                padding: '10px 14px',
                borderRadius: 9,
                border: `1px solid ${c.border}`,
                background: c.surfaceAlt,
                color: c.text,
                fontSize: '1rem',
                boxSizing: 'border-box',
              }}
            />

            <label
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                margin: '14px 0',
                fontSize: '0.88rem',
                lineHeight: 1.5,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>{t('contracts.sign.agree')}</span>
            </label>

            {/* Said before the button, not after. What is being recorded is the
                kind of thing a person is entitled to know before they act, not
                something to disclose once they already have. */}
            <p style={{ fontSize: '0.78rem', color: c.textMuted, lineHeight: 1.5, margin: '0 0 14px' }}>
              {t('contracts.sign.legalNote')}
            </p>

            <Button type="submit" disabled={!canSubmit || sign.isPending}>
              {sign.isPending ? t('contracts.sign.submitting') : t('contracts.sign.submit')}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
