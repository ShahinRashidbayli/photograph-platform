"use client";

import React, { useEffect, useRef } from 'react';
import { getColors, type Theme } from '@/lib/design-tokens';

/**
 * Styled, theme-aware confirmation dialog — a replacement for the native
 * `window.confirm()`, which is unstyled and ignores dark mode.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  theme,
  busy = false,
  onConfirm,
  onCancel,
}: Readonly<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  theme: Theme;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}>) {
  const c = getColors(theme);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const confirmBg = tone === 'danger' ? c.danger : c.primarySolid;

  return (
    <div
      role="presentation"
      onClick={() => !busy && onCancel()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '420px',
          background: c.surface,
          borderRadius: '14px',
          border: `1px solid ${c.border}`,
          boxShadow: c.elevatedShadow,
          padding: '24px',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: c.text, letterSpacing: '-0.01em' }}>
          {title}
        </h2>
        <p style={{ margin: '8px 0 20px', fontSize: '0.9rem', color: c.textMuted, lineHeight: 1.55 }}>
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: '9px 16px',
              borderRadius: '10px',
              fontSize: '0.875rem',
              fontWeight: 600,
              border: `1px solid ${c.border}`,
              background: c.surface,
              color: c.text,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              padding: '9px 16px',
              borderRadius: '10px',
              fontSize: '0.875rem',
              fontWeight: 600,
              border: '1px solid transparent',
              background: confirmBg,
              color: '#FFFFFF',
              cursor: busy ? 'progress' : 'pointer',
              minWidth: '96px',
            }}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
