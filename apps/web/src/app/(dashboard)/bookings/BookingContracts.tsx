'use client';

import React, { useMemo, useState } from 'react';
import { getColors, type Theme } from '@/lib/design-tokens';
import { asyncError, asyncErrorText, type AsyncError } from '@/lib/async-error';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PersonalNoteDialog } from '@/components/PersonalNoteDialog';
import { Alert, Badge, Button, Modal, ModalHeader, Note } from '@/components/ui';
import { UpgradeCard } from '@/components/UpgradeCard';
import { useTranslation } from '@/lib/i18n';
import { useEntitlements } from '@/hooks/useEntitlements';
import { getDetailStyles } from './bookingDetail.styles';
import {
  downloadContractPdf,
  useBookingContracts,
  useCancelContract,
  useCreateContract,
  useResendContract,
  useSendContract,
  useUpdateContract,
  type Contract,
} from '@/hooks/useContracts';
import { contractSubline } from '@/lib/contract-status';
import type { Booking } from '@/types/api';

/**
 * The photographer's contract surface for one booking.
 *
 * <p>Mirrors {@code BookingInvoices} in shape, and differs where the documents
 * differ: an invoice is immutable the instant it exists, while a contract has a
 * genuine draft stage — the whole point is that the photographer reads it
 * before anyone is bound by it. So this screen has an editor, and the
 * irreversible step is *sending*, which is what the confirmation guards.
 *
 * <p>On a plan without CONTRACTS this renders an upgrade prompt rather than
 * the panel. It used to render nothing at all, which was wrong in a way worth
 * naming: a photographer on Starter could not discover the feature existed, so
 * the gate silently cost the sale it was there to make. Showing the *controls*
 * disabled would be the other mistake — the server refuses those writes, and a
 * button that only ever fails is not an invitation. Naming the tier and linking
 * to it is the honest middle.
 */
export function BookingContracts({ booking, theme }: { booking: Booking; theme: Theme }) {
  const c = useMemo(() => getColors(theme), [theme]);
  const s = useMemo(() => getDetailStyles(c), [c]);
  const { t, format } = useTranslation();
  const { has } = useEntitlements();
  const allowed = has('CONTRACTS');

  const { data: contracts, isLoading, isError } = useBookingContracts(booking.id, allowed);
  const create = useCreateContract(booking.id);
  const update = useUpdateContract(booking.id);
  const send = useSendContract(booking.id);
  const resend = useResendContract(booking.id);
  const { mutate: mutateSend } = send;
  const { mutate: mutateResend } = resend;
  const cancel = useCancelContract(booking.id);

  const [editing, setEditing] = useState<Contract | null>(null);
  // Sending and "Erneut senden" share the Personal note dialog; which one it
  // is decides the endpoint and the words.
  const [sending, setSending] = useState<{ contract: Contract; again: boolean } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<Contract | null>(null);
  const [error, setError] = useState<AsyncError | null>(null);

  if (!allowed) {
    return (
      <section aria-labelledby="bk-contract-title">
        <h3 id="bk-contract-title" style={{ ...s.h3, marginBottom: 12 }}>
          {t('contracts.title')}
        </h3>
        <UpgradeCard
          compact
          capability="CONTRACTS"
          title={t('upgrade.contractsTitle')}
          body={t('upgrade.contractsBody')}
        />
      </section>
    );
  }

  const list = contracts ?? [];
  const hasLive = list.some((k) => k.status !== 'CANCELLED');

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(asyncError(e, 'contracts.loadError'));
    }
  }

  return (
    <section aria-labelledby="bk-contract-title">
      <div style={{ ...s.sectionHead, marginBottom: 12 }}>
        <h3 id="bk-contract-title" style={s.h3}>
          {t('contracts.title')}
        </h3>
        {!hasLive && (
          <Button
            variant="secondary"
            size="sm"
            disabled={create.isPending}
            onClick={() => run(async () => setEditing(await create.mutateAsync({})))}
          >
            {t('contracts.new')}
          </Button>
        )}
      </div>

      {error && (
        <Alert tone="danger" style={{ marginBottom: 10 }}>
          {asyncErrorText(error, t)}
        </Alert>
      )}
      {isLoading && <Note style={{ marginBottom: 10 }}>{t('contracts.loading')}</Note>}
      {isError && <Alert tone="danger">{t('contracts.loadError')}</Alert>}

      {!isLoading && list.length === 0 && (
        <Note style={{ marginBottom: 4 }}>{t('contracts.none')}</Note>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {list.map((contract) => (
          <ContractRow
            key={contract.id}
            contract={contract}
            colors={c}
            format={format}
            t={t}
            onEdit={() => setEditing(contract)}
            onSend={() => setSending({ contract, again: false })}
            onResend={() => setSending({ contract, again: true })}
            onCancel={() => setConfirmCancel(contract)}
            onDownload={() =>
              run(() =>
                downloadContractPdf(
                  `/api/contracts/${contract.id}/pdf`,
                  `${contract.title.replace(/[^\w\s-]/g, '').trim() || 'Vertrag'}.pdf`
                )
              )
            }
          />
        ))}
      </div>

      {editing && (
        <ContractEditor
          contract={editing}
          theme={theme}
          busy={update.isPending}
          onClose={() => setEditing(null)}
          onSave={async (title, body) => {
            await run(async () => {
              await update.mutateAsync({ id: editing.id, title, body });
              setEditing(null);
            });
          }}
        />
      )}

      {sending && (
        <PersonalNoteDialog
          title={t(sending.again ? 'contracts.resendTitle' : 'contracts.sendConfirmTitle')}
          description={t(sending.again ? 'contracts.resendBody' : 'contracts.sendConfirmBody', {
            name: sending.contract.recipientName,
          })}
          confirmLabel={t(sending.again ? 'contracts.action.resend' : 'contracts.action.send')}
          busy={sending.again ? resend.isPending : send.isPending}
          onClose={() => setSending(null)}
          onSend={(note) => {
            setError(null);
            (sending.again ? mutateResend : mutateSend)(
              { id: sending.contract.id, note },
              {
                onError: (e) => setError(asyncError(e, 'contracts.sendError')),
                // Closed on failure too, with the error above the list: a
                // dialog left open invites the second click that would send a
                // second email.
                onSettled: () => setSending(null),
              }
            );
          }}
        />
      )}

      <ConfirmDialog
        open={confirmCancel !== null}
        theme={theme}
        title={t('contracts.cancelConfirmTitle')}
        message={t('contracts.cancelConfirmBody')}
        confirmLabel={t('contracts.action.cancel')}
        busy={cancel.isPending}
        onCancel={() => setConfirmCancel(null)}
        onConfirm={() =>
          run(async () => {
            if (confirmCancel) await cancel.mutateAsync(confirmCancel.id);
            setConfirmCancel(null);
          })
        }
      />
    </section>
  );
}

function ContractRow({
  contract,
  colors: c,
  format,
  t,
  onEdit,
  onSend,
  onResend,
  onCancel,
  onDownload,
}: {
  contract: Contract;
  colors: ReturnType<typeof getColors>;
  format: ReturnType<typeof useTranslation>['format'];
  t: ReturnType<typeof useTranslation>['t'];
  onEdit: () => void;
  onSend: () => void;
  onResend: () => void;
  onCancel: () => void;
  onDownload: () => void;
}) {
  const tone = statusTone(contract.status, c);

  return (
    // Flat, not a card inside the detail card: the row sits in a section that
    // is already bounded by hairlines.
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: '0.875rem', color: c.text }}>
            {contract.title}
          </div>
          <div style={{ fontSize: '0.8125rem', color: c.textMuted, marginTop: 3 }}>
            {contractSubline(contract, t, format)}
          </div>
        </div>
        <Badge tone={tone}>{t(`contracts.status.${contract.status}` as never)}</Badge>
      </div>

      {/* Only ever shown when the stored text stops matching the signature.
          Silence is the normal state; a green "verified" chip on every row
          would train the eye to skip exactly the one that matters. */}
      {contract.status === 'SIGNED' && !contract.intact && (
        <Alert tone="danger" style={{ marginTop: 10 }}>
          {t('contracts.tampered')}
        </Alert>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {contract.editable && (
          <>
            <Button variant="secondary" size="sm" onClick={onEdit}>
              {t('contracts.action.edit')}
            </Button>
            <Button size="sm" onClick={onSend}>
              {t('contracts.action.send')}
            </Button>
          </>
        )}
        {/* For the Customer whose first email went missing. The contract
            itself does not change, so only a SENT one offers it. */}
        {contract.status === 'SENT' && (
          <Button variant="secondary" size="sm" onClick={onResend}>
            {t('contracts.action.resend')}
          </Button>
        )}
        {contract.status !== 'CANCELLED' && (
          <Button variant="secondary" size="sm" onClick={onDownload}>
            {t('contracts.action.download')}
          </Button>
        )}
        {contract.status !== 'SIGNED' && contract.status !== 'CANCELLED' && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {t('contracts.action.cancel')}
          </Button>
        )}
      </div>
    </div>
  );
}

function ContractEditor({
  contract,
  theme,
  busy,
  onClose,
  onSave,
}: {
  contract: Contract;
  theme: Theme;
  busy: boolean;
  onClose: () => void;
  onSave: (_title: string, _body: string) => void;
}) {
  const c = getColors(theme);
  const { t } = useTranslation();
  const [title, setTitle] = useState(contract.title);
  const [body, setBody] = useState(contract.body);

  const field: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 9,
    border: `1px solid ${c.border}`,
    background: c.surfaceAlt,
    color: c.text,
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };

  return (
    <Modal
      label={t('contracts.heading')}
      maxWidth={760}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        onSave(title.trim(), body);
      }}
    >
      <ModalHeader title={contract.title} onClose={onClose} />

      <Alert tone="warning" style={{ marginBottom: 14 }}>
        {t('contracts.disclaimer')}
      </Alert>

      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6 }}>
        {t('contracts.field.title')}
      </label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
        required
        style={{ ...field, marginBottom: 14 }}
      />

      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6 }}>
        {t('contracts.field.body')}
      </label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
        rows={18}
        // Monospace and pre-wrap because the text is rendered into the PDF
        // exactly as typed — the editor should show the same line breaks the
        // signed document will have.
        style={{
          ...field,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          lineHeight: 1.55,
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('contracts.action.close')}
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? t('contracts.action.saving') : t('contracts.action.save')}
        </Button>
      </div>
    </Modal>
  );
}

function statusTone(status: Contract['status'], c: ReturnType<typeof getColors>): string {
  switch (status) {
    case 'SIGNED':
      return c.successText;
    case 'SENT':
      return c.warningText;
    case 'CANCELLED':
      return c.textMuted;
    default:
      return c.textMuted;
  }
}
