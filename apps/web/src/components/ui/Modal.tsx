'use client';

import React, { useEffect, useRef } from 'react';
import { useColors, RADIUS } from './tokens';

export interface ModalProps {
  /** Accessible name for the dialog. */
  label: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
  /** Rendered as a <form> when given, so Enter submits and buttons behave. */
  onSubmit?: (_e: React.FormEvent) => void;
}

/**
 * The app's dialog shell: backdrop, panel, Escape, backdrop-click, and focus
 * returned to whatever opened it.
 *
 * <p>The focus restore is the part that is easy to leave out and hard to
 * notice: without it, dismissing a dialog drops focus onto `<body>`, and a
 * keyboard user has to tab from the top of the page to get back to where they
 * were. Focus is *not* trapped inside the panel — the payment dialog hosts a
 * cross-origin Stripe iframe that manages its own focus, and a trap fights it.
 */
export function Modal({ label, onClose, children, maxWidth = 520, onSubmit }: ModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    globalThis.addEventListener('keydown', onKey);
    // Move focus into the panel so the next Tab lands inside the dialog
    // rather than continuing through the page behind it.
    panelRef.current?.focus();
    return () => {
      globalThis.removeEventListener('keydown', onKey);
      if (openerRef.current instanceof HTMLElement) {
        openerRef.current.focus();
      }
    };
  }, [onClose]);

  const c = useColors();
  const panelStyle: React.CSSProperties = {
    background: c.surface,
    border: `1px solid ${c.border}`,
    borderRadius: 16,
    boxShadow: c.shadowModal,
    color: c.text,
    width: '100%',
    maxWidth,
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: 24,
    outline: 'none',
  };

  const body = onSubmit ? (
    <form onSubmit={onSubmit} style={panelStyle}>
      {children}
    </form>
  ) : (
    <div style={panelStyle}>{children}</div>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      ref={panelRef}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(6, 6, 10, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      {body}
    </div>
  );
}

/** Title + optional subtitle + close affordance, for the top of a Modal. */
export function ModalHeader({
  title,
  subtitle,
  onClose,
  closeLabel = 'Close',
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose?: () => void;
  closeLabel?: string;
}) {
  const c = useColors();
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>{title}</h2>
        {subtitle ? (
          <p
            style={{ fontSize: '0.83rem', color: c.textMuted, margin: '4px 0 0', lineHeight: 1.5 }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          style={{
            background: 'transparent',
            border: 'none',
            color: c.textMuted,
            fontSize: '1.3rem',
            lineHeight: 1,
            cursor: 'pointer',
            borderRadius: RADIUS.control,
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
