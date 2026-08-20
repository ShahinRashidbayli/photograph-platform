'use client';

import type { CSSProperties, ReactNode } from 'react';
import { getColors } from '@/lib/design-tokens';
import { useThemeStore } from '@/store/themeStore';

/**
 * A disabled button for actions the product advertises but hasn't shipped yet
 * (Pay now, Read & sign, Download PDF, Message…). Centralises the not-allowed
 * cursor, dimmed opacity and hover title so the "coming soon" treatment stays
 * identical everywhere — it was previously hand-rolled inline in every card.
 * Pair it with the <ComingSoon /> chip for a visible label.
 */
export type ComingSoonVariant = 'primary' | 'outline' | 'link' | 'danger';

interface ComingSoonButtonProps {
  children: ReactNode;
  variant?: ComingSoonVariant;
  /** Native tooltip explaining why it's disabled. */
  title?: string;
  /** Leading icon (mainly for the `link` variant, e.g. a download glyph). */
  icon?: ReactNode;
  /** Per-call-site overrides (padding, width…) merged last. */
  style?: CSSProperties;
}

export function ComingSoonButton({
  children,
  variant = 'primary',
  title = 'Coming soon',
  icon,
  style,
}: ComingSoonButtonProps) {
  const { theme } = useThemeStore();
  const c = getColors(theme);

  const base: CSSProperties = {
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'not-allowed',
    whiteSpace: 'nowrap',
  };

  const byVariant: Record<ComingSoonVariant, CSSProperties> = {
    primary: {
      padding: '9px 18px',
      borderRadius: '10px',
      border: 'none',
      background: c.primarySolid,
      color: '#fff',
      fontWeight: 700,
      opacity: 0.7,
    },
    outline: {
      padding: '9px 18px',
      borderRadius: '10px',
      border: `1px solid ${c.border}`,
      background: 'transparent',
      color: c.text,
      opacity: 0.7,
    },
    link: {
      padding: 0,
      border: 'none',
      background: 'transparent',
      color: c.primary,
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      opacity: 0.7,
    },
    danger: {
      padding: 0,
      border: 'none',
      background: 'transparent',
      color: c.dangerText,
      opacity: 0.85,
    },
  };

  return (
    <button
      type="button"
      disabled
      title={title}
      style={{ ...base, ...byVariant[variant], ...style }}
    >
      {icon}
      {children}
    </button>
  );
}
