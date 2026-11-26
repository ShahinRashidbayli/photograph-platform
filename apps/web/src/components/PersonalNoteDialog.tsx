'use client';

import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Button, Field, Modal, ModalHeader, Textarea, useColors } from '@/components/ui';

/** The API's limit on a Personal note (`@Size(max = 1000)` on each send request). */
export const PERSONAL_NOTE_MAX = 1000;

/**
 * Sending a Customer message, with the photographer's optional Personal note.
 *
 * <p>One dialog for every send — a request decision, a contract, a gallery —
 * so the note reads the same everywhere: plain text, at most
 * {@link PERSONAL_NOTE_MAX} characters, and nothing at all when left empty
 * (`null`, not `""`, so the message carries no empty note block).
 *
 * <p>`busy` is the caller's `m.isPending`. While it holds, the send button is
 * disabled and the dialog cannot be dismissed: a second click would be a
 * second message to the Customer. The caller closes it once the request
 * settles — on a failure too, with the error shown above the screen's content.
 */
export function PersonalNoteDialog({
  title,
  description,
  confirmLabel,
  busy,
  onSend,
  onClose,
}: Readonly<{
  title: string;
  description: string;
  confirmLabel: string;
  busy: boolean;
  onSend: (_note: string | null) => void;
  onClose: () => void;
}>) {
  const { t } = useTranslation();
  const c = useColors();
  const [note, setNote] = useState('');
  // Stable for the dialog's whole life: `Modal` moves focus to its panel
  // whenever its `onClose` changes, so a new function — per keystroke, or per
  // background refetch in the screen behind — pulled focus out of the textarea.
  const latest = useRef({ busy, onClose });
  latest.current = { busy, onClose };
  const close = useCallback(() => {
    if (!latest.current.busy) latest.current.onClose();
  }, []);

  return (
    <Modal
      label={title}
      onClose={close}
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) onSend(note.trim() || null);
      }}
    >
      <ModalHeader
        title={title}
        subtitle={description}
        onClose={close}
        closeLabel={t('common.close')}
      />
      <div style={{ marginTop: 18 }}>
        <Field
          label={t('personalNote.label')}
          hint={
            <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span>{t('personalNote.hint')}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: c.textMuted }}>
                {t('personalNote.counter', { count: note.length, max: PERSONAL_NOTE_MAX })}
              </span>
            </span>
          }
        >
          {(props) => (
            <Textarea
              {...props}
              rows={5}
              value={note}
              maxLength={PERSONAL_NOTE_MAX}
              placeholder={t('personalNote.placeholder')}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </Field>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={close} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          variant="primary"
          busy={busy}
          busyLabel={t('personalNote.sending')}
          disabled={busy}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
