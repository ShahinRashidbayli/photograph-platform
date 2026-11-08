'use client';

import React, { useEffect, useRef, useState } from 'react';
import { fontSize, getColors, radius, space, type Theme } from '@/lib/design-tokens';
import { useTranslation } from '@/lib/i18n';

/**
 * Transient confirmation of something that already happened.
 *
 * This exists so mutations can be applied optimistically: the change lands in
 * the UI immediately and the toast reports it, optionally offering the reverse
 * action. That is a better trade than a spinner on a disabled button — the
 * common case (it works) is instant, and the rare case (it fails) is where the
 * interruption belongs.
 *
 * Auto-dismiss pauses while the pointer or keyboard focus is inside the toast,
 * so an undo offer can't expire out from under someone reaching for it.
 */
export function Toast({
  message,
  theme,
  actionLabel,
  onAction,
  onDismiss,
  tone = 'neutral',
  duration,
}: Readonly<{
  message: string;
  theme: Theme;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  tone?: 'neutral' | 'danger';
  /** Auto-dismiss delay in ms. Defaults to 8s with an action, 4s without. */
  duration?: number;
}>) {
  const { t } = useTranslation();
  const c = getColors(theme);
  const [paused, setPaused] = useState(false);
  // Held in a ref so restarting the timer on pause/resume doesn't re-fire the
  // dismiss callback identity dance on every parent render.
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  const ms = duration ?? (actionLabel ? 8000 : 4000);

  useEffect(() => {
    if (paused) return;
    const id = window.setTimeout(() => dismissRef.current(), ms);
    return () => window.clearTimeout(id);
  }, [ms, paused, message]);

  return (
    <div
      // "status", not "alert": this reports a completed action, so it should
      // not interrupt a screen reader mid-sentence.
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className="app-toast"
      style={{
        position: 'fixed',
        bottom: space.xxl,
        left: '50%',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: space.md,
        maxWidth: 'min(520px, calc(100vw - 32px))',
        padding: `${space.md} ${space.lg}`,
        borderRadius: radius.control,
        border: `1px solid ${tone === 'danger' ? c.dangerBorder : c.border}`,
        background: c.isDark ? '#1C1C22' : '#0F172A',
        color: '#F8FAFC',
        boxShadow: c.shadowPopover,
        fontSize: fontSize.md,
      }}
    >
      <style>{`
        .app-toast {
          transform: translate(-50%, 0);
          animation: app-toast-in 160ms ease-out;
        }
        @keyframes app-toast-in {
          from { opacity: 0; transform: translate(-50%, 8px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .app-toast { animation: none; }
        }
      `}</style>

      <span style={{ flex: 1, minWidth: 0, fontWeight: 500 }}>{message}</span>

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          style={{
            padding: `${space.xs} ${space.md}`,
            borderRadius: radius.control,
            border: '1px solid rgba(248, 250, 252, 0.28)',
            background: 'transparent',
            color: '#F8FAFC',
            fontSize: fontSize.base,
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {actionLabel}
        </button>
      )}

      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('common.close')}
        style={{
          width: '24px',
          height: '24px',
          borderRadius: radius.control,
          border: 'none',
          background: 'transparent',
          color: 'rgba(248, 250, 252, 0.7)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
