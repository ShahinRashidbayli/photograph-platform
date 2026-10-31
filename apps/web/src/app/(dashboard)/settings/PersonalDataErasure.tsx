'use client';

import React, { useState } from 'react';
import { asyncError, asyncErrorText, type AsyncError } from '@/lib/async-error';
import { useTranslation, type PluralKey, type TranslationKey } from '@/lib/i18n';
import { useThemeStore } from '@/store/themeStore';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useErasePersonalData, usePreviewErasure, type ErasureItem } from '@/hooks/usePrivacy';
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  Note,
  useColors,
  type Colors,
} from '@/components/ui';

type RetentionBasis = NonNullable<ErasureItem['retentionBasis']>;

export type { ErasureItem };

/**
 * Where the flow is. The address is held with the report it belongs to, so a
 * report can never be shown — or acted on — for an address other than the one
 * it was produced for.
 */
type Phase =
  | { kind: 'idle' }
  | { kind: 'previewed'; email: string; items: ErasureItem[] }
  | { kind: 'done'; email: string; items: ErasureItem[] };

const CATEGORY_LABEL: Record<string, TranslationKey> = {
  customerAccounts: 'privacy.category.customerAccounts',
  clients: 'privacy.category.clients',
  leads: 'privacy.category.leads',
  inquiries: 'privacy.category.inquiries',
  bookings: 'privacy.category.bookings',
  galleries: 'privacy.category.galleries',
  galleryPhotos: 'privacy.category.galleryPhotos',
  contracts: 'privacy.category.contracts',
  invoices: 'privacy.category.invoices',
  auditEntries: 'privacy.category.auditEntries',
};

const BASIS_TEXT: Record<RetentionBasis, TranslationKey> = {
  TAX_RECORDS: 'privacy.basis.TAX_RECORDS',
  LEGAL_CLAIMS: 'privacy.basis.LEGAL_CLAIMS',
};

/** The same three counts, worded for a preview ("will be") and a result ("was"). */
const ACTION_TEXT: Record<
  'will' | 'did',
  Record<'deleted' | 'anonymized' | 'retained', PluralKey>
> = {
  will: {
    deleted: 'privacy.will.deleted',
    anonymized: 'privacy.will.anonymized',
    retained: 'privacy.will.retained',
  },
  did: {
    deleted: 'privacy.did.deleted',
    anonymized: 'privacy.did.anonymized',
    retained: 'privacy.did.retained',
  },
};

const CATEGORY_HINT: Record<string, TranslationKey> = {
  bookings: 'privacy.hint.bookings',
  auditEntries: 'privacy.hint.auditEntries',
};

/**
 * Erasing one person's data from the studio (Art. 17 GDPR).
 *
 * <p>Preview first, always: the server runs the real erasure and rolls it
 * back, so what is shown here is exactly what the button will do. Editing the
 * address throws the preview away — erasing on a report produced for a
 * different address is the one mistake this screen must not allow.
 *
 * <p>Anything kept is shown with its reason. The photographer has to answer
 * the person who asked, and "some of it is still there" is not an answer.
 */
export function PersonalDataErasure() {
  const { t, tPlural } = useTranslation();
  const { theme } = useThemeStore();
  const c = useColors();

  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const previewErasure = usePreviewErasure();
  const eraseData = useErasePersonalData();
  const busy = previewErasure.isPending || eraseData.isPending;
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<AsyncError | null>(null);

  function editEmail(value: string) {
    setEmail(value);
    if (phase.kind === 'previewed') setPhase({ kind: 'idle' });
    setError(null);
  }

  function preview(e: React.FormEvent) {
    e.preventDefault();
    const address = email.trim();
    if (!address || busy) return;
    setError(null);
    previewErasure.mutate(address, {
      onSuccess: (items) => setPhase({ kind: 'previewed', email: address, items }),
      onError: (err) => setError(erasureError(err, 'privacy.previewError')),
    });
  }

  function erase() {
    if (phase.kind !== 'previewed') return;
    const { email: address } = phase;
    setError(null);
    eraseData.mutate(address, {
      onSuccess: (items) => {
        setPhase({ kind: 'done', email: address, items });
        setEmail('');
      },
      onError: (err) => setError(erasureError(err, 'privacy.eraseError')),
      onSettled: () => setConfirming(false),
    });
  }

  function startOver() {
    setPhase({ kind: 'idle' });
    setEmail('');
    setError(null);
  }

  const photos =
    phase.kind === 'previewed'
      ? (phase.items.find((i) => i.category === 'galleryPhotos')?.deleted ?? 0)
      : 0;

  return (
    <Card>
      {error && (
        <Alert tone="danger" style={{ marginBottom: 16 }}>
          {asyncErrorText(error, t)}
        </Alert>
      )}

      {phase.kind !== 'done' && (
        <form onSubmit={preview}>
          <Field label={t('privacy.emailLabel')}>
            {(props) => (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Input
                  {...props}
                  type="email"
                  required
                  autoComplete="off"
                  value={email}
                  onChange={(e) => editEmail(e.target.value)}
                  placeholder={t('privacy.emailPlaceholder')}
                  maxLength={320}
                  style={{ flex: '1 1 240px' }}
                />
                <Button
                  type="submit"
                  busy={busy && phase.kind === 'idle'}
                  busyLabel={t('privacy.previewing')}
                  disabled={!email.trim() || busy}
                >
                  {t('privacy.preview')}
                </Button>
              </div>
            )}
          </Field>
        </form>
      )}

      {phase.kind !== 'idle' && (
        <div style={{ marginTop: phase.kind === 'previewed' ? 20 : 0 }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: c.text, margin: '0 0 8px' }}>
            {t(phase.kind === 'done' ? 'privacy.doneHeading' : 'privacy.previewHeading', {
              email: phase.email,
            })}
          </h3>

          {phase.items.length === 0 ? (
            <Note>{t('privacy.nothingFound')}</Note>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {phase.items.map((item) => (
                <ReportRow
                  key={item.category}
                  item={item}
                  executed={phase.kind === 'done'}
                  colors={c}
                  // A category this build does not know yet — a module added
                  // to erasure after it shipped — is shown by its own name
                  // rather than dropped from what the photographer is told.
                  label={
                    CATEGORY_LABEL[item.category] ? t(CATEGORY_LABEL[item.category]) : item.category
                  }
                  hint={CATEGORY_HINT[item.category] ? t(CATEGORY_HINT[item.category]) : null}
                  basis={item.retentionBasis ? t(BASIS_TEXT[item.retentionBasis]) : null}
                  count={(base, count) => tPlural(base, count)}
                />
              ))}
            </ul>
          )}

          {phase.kind === 'previewed' && phase.items.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Button variant="danger" onClick={() => setConfirming(true)} disabled={busy}>
                {t('privacy.erase')}
              </Button>
            </div>
          )}

          {phase.kind === 'done' && (
            <>
              {phase.items.length > 0 && (
                <Alert tone="success" style={{ marginTop: 16 }}>
                  {t('privacy.doneNote')}
                </Alert>
              )}
              <div style={{ marginTop: 16 }}>
                <Button variant="secondary" onClick={startOver}>
                  {t('privacy.another')}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title={t('privacy.confirmTitle')}
        message={
          photos > 0
            ? `${t('privacy.confirmMessage')} ${tPlural('privacy.confirmPhotos', photos)}`
            : t('privacy.confirmMessage')
        }
        confirmLabel={busy ? t('privacy.erasing') : t('privacy.erase')}
        tone="danger"
        theme={theme}
        busy={busy}
        onConfirm={erase}
        onCancel={() => setConfirming(false)}
      />
    </Card>
  );
}

/** One kind of record and what happens — or happened — to it. */
function ReportRow({
  item,
  executed,
  colors: c,
  label,
  hint,
  basis,
  count,
}: Readonly<{
  item: ErasureItem;
  executed: boolean;
  colors: Colors;
  label: string;
  hint: string | null;
  basis: string | null;
  count: (_base: PluralKey, _n: number) => string;
}>) {
  const text = ACTION_TEXT[executed ? 'did' : 'will'];
  const actions: { n: number; key: PluralKey; tone: string; background: string }[] = [
    {
      n: item.deleted,
      key: text.deleted,
      tone: c.dangerText,
      background: c.dangerBg,
    },
    {
      n: item.anonymized,
      key: text.anonymized,
      tone: c.warningText,
      background: c.warningBg,
    },
    {
      n: item.retained,
      key: text.retained,
      tone: c.infoText,
      background: c.infoBg,
    },
  ];

  return (
    <li style={{ padding: '12px 0', borderTop: `1px solid ${c.border}` }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '0.9rem', color: c.text, fontWeight: 500 }}>{label}</span>
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {actions
            .filter((a) => a.n > 0)
            .map((a) => (
              <Badge key={a.key} tone={a.tone} background={a.background}>
                {count(a.key, a.n)}
              </Badge>
            ))}
        </span>
      </div>
      {(hint || basis) && (
        <Note style={{ marginTop: 4 }}>{[hint, basis].filter(Boolean).join(' ')}</Note>
      )}
    </li>
  );
}

/**
 * A 401 here is the owner check, not an expired session — the interceptor has
 * already refreshed and retried by the time it arrives. The server's own text
 * is English, so the case gets a translated message of its own.
 */
function erasureError(err: unknown, fallback: TranslationKey): AsyncError {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status === 401) return { key: 'privacy.ownerOnly' };
  return asyncError(err, fallback);
}
