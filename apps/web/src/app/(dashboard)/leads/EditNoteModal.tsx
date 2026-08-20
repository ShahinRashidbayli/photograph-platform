import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Lead } from '@/types/api';
import { extractApiError } from '@/lib/helpers';
import { useTranslation } from '@/lib/i18n';
import type { ColorTokens } from './leadTypes';

/**
 * Single-textarea modal for editing a lead's internal notes. PATCHes
 * /api/leads/{id}/notes; backend treats null/blank identically so clearing
 * the textarea actually clears the field. Title and CTA flip based on
 * whether the lead already has a note ("Add note" vs "Edit note") so the
 * action label matches the intent.
 */
export function EditNoteModal({
  lead,
  c,
  onClose,
  onSaved,
}: Readonly<{
  lead: Lead;
  c: ColorTokens;
  onClose: () => void;
  onSaved: (_lead: Lead) => void;
}>) {
  const { t } = useTranslation();
  const isEdit = !!lead.internalNotes;
  const [notes, setNotes] = useState(lead.internalNotes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  const handleSave = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await api.patch<Lead>(`/api/leads/${lead.id}/notes`, {
        notes: notes.trim() || null,
      });
      onSaved(res.data);
    } catch (err) {
      setSubmitError(extractApiError(err, t('editNote.errSubmit')));
    } finally {
      setSubmitting(false);
    }
  };

  const overlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 100,
    background: 'rgba(15, 23, 42, 0.55)',
    backdropFilter: 'blur(2px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  };
  const card: React.CSSProperties = {
    width: '100%',
    maxWidth: '520px',
    background: c.surface,
    borderRadius: '14px',
    border: `1px solid ${c.border}`,
    boxShadow: c.elevatedShadow,
    display: 'flex',
    flexDirection: 'column',
  };
  const ghostBtn: React.CSSProperties = {
    padding: '9px 16px',
    background: 'transparent',
    color: c.text,
    border: `1px solid ${c.border}`,
    borderRadius: '8px',
    fontSize: '0.88rem',
    fontWeight: 600,
    cursor: submitting ? 'not-allowed' : 'pointer',
  };
  const primaryBtn: React.CSSProperties = {
    padding: '9px 18px',
    background: c.primarySolid,
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.88rem',
    fontWeight: 600,
    cursor: submitting ? 'wait' : 'pointer',
    opacity: submitting ? 0.7 : 1,
    minWidth: '120px',
  };

  return (
    <div
      style={overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={
          isEdit
            ? t('editNote.ariaEdit', { name: lead.name })
            : t('editNote.ariaAdd', { name: lead.name })
        }
        style={card}
      >
        <div
          style={{
            padding: '20px 24px 12px',
            borderBottom: `1px solid ${c.divider}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: c.text }}>
              {isEdit ? t('editNote.titleEdit') : t('editNote.titleAdd')}
            </div>
            <div style={{ fontSize: '0.85rem', color: c.textMuted, marginTop: '4px' }}>
              {t('editNote.subtitle')}
            </div>
          </div>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            aria-label={t('common.close')}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.4rem',
              color: c.textMuted,
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {submitError && (
            <div
              role="alert"
              style={{
                padding: '10px 12px',
                background: c.dangerBg,
                color: c.dangerText,
                border: `1px solid ${c.dangerBorder}`,
                borderRadius: '8px',
                fontSize: '0.85rem',
              }}
            >
              {submitError}
            </div>
          )}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('editNote.placeholder')}
            maxLength={4000}
            autoFocus
            style={{
              padding: '10px 12px',
              border: `1px solid ${c.border}`,
              borderRadius: '8px',
              background: c.surfaceAlt,
              color: c.text,
              fontSize: '0.88rem',
              minHeight: '140px',
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ fontSize: '0.72rem', color: c.textMuted, textAlign: 'right' }}>
            {notes.length} / 4000
          </div>
        </div>

        <div
          style={{
            padding: '16px 24px',
            borderTop: `1px solid ${c.divider}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
          }}
        >
          <button type="button" style={ghostBtn} onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </button>
          <button type="button" style={primaryBtn} onClick={handleSave} disabled={submitting}>
            {submitting ? t('common.saving') : t('editNote.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
