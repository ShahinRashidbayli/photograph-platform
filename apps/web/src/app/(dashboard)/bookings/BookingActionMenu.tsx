'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { getBookingsColors } from './bookings.styles';

/**
 * The "…" overflow menu on a booking. Destructive and rare actions live here
 * rather than as a fourth button competing with the lifecycle actions.
 */

export type MenuItem = {
  key: string;
  label: string;
  onSelect: () => void;
  danger?: boolean;
};

/**
 * Small "…" overflow menu. Destructive and rarely-used actions live in here
 * rather than as a fourth button on the detail toolbar — closes on outside
 * click, Escape, or selection.
 */
export function BookingActionMenu({
  items,
  label,
  styles,
  colors,
}: Readonly<{
  items: MenuItem[];
  label: string;
  styles: Record<string, React.CSSProperties>;
  colors: ReturnType<typeof getBookingsColors>;
}>) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    // Focus goes back where it came from — otherwise closing the menu drops
    // the keyboard user at the top of the document.
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    // Opening with the keyboard should land on the first item.
    itemRefs.current[0]?.focus();

    function onPointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  function onMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const focusable = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
    const index = focusable.indexOf(document.activeElement as HTMLButtonElement);
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        close(true);
        break;
      case 'ArrowDown':
        event.preventDefault();
        focusable[(index + 1) % focusable.length]?.focus();
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusable[(index - 1 + focusable.length) % focusable.length]?.focus();
        break;
      case 'Tab':
        // A menu is modal-ish: tabbing out closes it rather than leaving an
        // orphaned popup floating over the page.
        setOpen(false);
        break;
      default:
        break;
    }
  }

  if (items.length === 0) return null;

  return (
    <div ref={wrapperRef} style={styles.menuWrapper}>
      <button
        type="button"
        ref={triggerRef}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        style={{
          ...styles.menuTrigger,
          ...(open ? { background: colors.surfaceHover, color: colors.text } : {}),
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="19" cy="12" r="1.7" />
        </svg>
      </button>
      {open && (
        <div role="menu" style={styles.menuPanel} onKeyDown={onMenuKeyDown}>
          {items.map((item, index) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              onClick={() => {
                close(true);
                item.onSelect();
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = item.danger
                  ? colors.dangerBg
                  : colors.surfaceHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
              style={{
                ...styles.menuItem,
                ...(item.danger ? styles.menuItemDanger : {}),
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Loading state that mirrors the real layout — strip, list rows, detail panel —
 * rather than the word "Loading". Nothing shifts when the data arrives, and the
 * page's shape is readable while it does.
 */
