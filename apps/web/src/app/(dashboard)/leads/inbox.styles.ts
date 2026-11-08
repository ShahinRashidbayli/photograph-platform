import type React from 'react';
import { fontSize, getColors, leading, radius, space } from '@/lib/design-tokens';

type Colors = ReturnType<typeof getColors>;

/**
 * The leads inbox: the list of requests and the one being read.
 *
 * <p>Deliberately fewer parts than the booking detail it sits beside in the
 * app. A request is read once and answered; the screen is the message, the
 * few facts that decide the answer, and the answer.
 */
export function getInboxStyles(c: Colors) {
  return {
    searchWrap: { padding: space.md, borderBottom: `1px solid ${c.borderSoft}` },
    search: {
      display: 'flex',
      alignItems: 'center',
      gap: space.sm,
      height: 38,
      padding: `0 ${space.md}`,
      border: `1px solid ${c.border}`,
      borderRadius: radius.control,
      background: c.surfaceAlt,
      color: c.textSubtle,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      border: 0,
      background: 'transparent',
      font: 'inherit',
      fontSize: fontSize.md,
      color: c.text,
      outline: 'none',
    },
    groupHead: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: space.sm,
      padding: `${space.md} ${space.sm} ${space.xs}`,
      fontSize: fontSize.sm,
      fontWeight: 500,
      color: c.textSubtle,
    },
    groupToggle: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: `${space.md} ${space.sm} ${space.xs}`,
      border: 0,
      background: 'transparent',
      cursor: 'pointer',
      font: 'inherit',
      fontSize: fontSize.sm,
      fontWeight: 500,
      color: c.textSubtle,
    },
    groupEmpty: {
      margin: `0 ${space.sm} ${space.sm}`,
      fontSize: fontSize.base,
      color: c.textSubtle,
    },
    row: {
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      textAlign: 'left',
      padding: `10px ${space.md}`,
      border: '1px solid transparent',
      borderRadius: 11,
      background: 'transparent',
      cursor: 'pointer',
      font: 'inherit',
      color: c.text,
      ['--ld-row-hover' as string]: c.surfaceHover,
    },
    rowActive: { background: c.surfaceHover, border: `1px solid ${c.border}` },
    rowTop: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: space.sm,
    },
    rowName: {
      fontWeight: 600,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    rowNameQuiet: {
      fontWeight: 500,
      color: c.textMuted,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    rowWhen: { fontSize: fontSize.sm, color: c.textSubtle, whiteSpace: 'nowrap' },
    rowWhenLate: {
      fontSize: fontSize.sm,
      color: c.warningText,
      fontWeight: 500,
      whiteSpace: 'nowrap',
    },
    rowSummary: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: fontSize.base,
      color: c.textMuted,
      minWidth: 0,
    },
    rowPreview: {
      fontSize: fontSize.base,
      color: c.textSubtle,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    ellipsis: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    highTag: {
      flexShrink: 0,
      fontSize: fontSize.xs,
      fontWeight: 500,
      color: c.onPrimary,
      background: c.primarySolid,
      borderRadius: radius.pill,
      padding: '0 7px',
      lineHeight: '18px',
    },

    // ── the request ──
    scroll: { flex: 1, minHeight: 0, overflowY: 'auto' },
    article: {
      padding: `${space.xxl} ${space.xxxl} ${space.xxxl}`,
      display: 'flex',
      flexDirection: 'column',
      gap: space.xl,
    },
    // No wrap: the "…" menu stays top-right while the name and pills wrap.
    header: { display: 'flex', alignItems: 'flex-start', gap: space.md },
    titleRow: { display: 'flex', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
    title: {
      margin: 0,
      fontSize: '22px',
      fontWeight: 600,
      letterSpacing: '-0.015em',
      lineHeight: leading.tight,
      color: c.text,
    },
    meta: { margin: '6px 0 0', color: c.textSubtle, fontSize: fontSize.base },
    message: {
      margin: 0,
      fontSize: '17px',
      lineHeight: 1.65,
      maxWidth: '62ch',
      color: c.text,
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
    },
    facts: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      padding: `${space.lg} 18px`,
      background: c.surfaceAlt,
      border: `1px solid ${c.borderSoft}`,
      borderRadius: radius.card,
    },
    factLine: { display: 'flex', alignItems: 'flex-start', gap: 10, color: c.textMuted },
    factText: {
      display: 'flex',
      alignItems: 'center',
      gap: space.sm,
      flexWrap: 'wrap',
      minWidth: 0,
      lineHeight: 1.4,
    },
    factStrong: { color: c.text, fontWeight: 500 },
    prio: { margin: 0, paddingLeft: 26, fontSize: fontSize.base, color: c.textSubtle },
    actions: { display: 'flex', gap: space.sm, flexWrap: 'wrap', alignItems: 'center' },
    hint: { margin: 0, fontSize: fontSize.sm, color: c.textSubtle },
    links: {
      display: 'flex',
      gap: 18,
      flexWrap: 'wrap',
      fontSize: fontSize.base,
      borderTop: `1px solid ${c.borderSoft}`,
      paddingTop: space.lg,
    },
    linkButton: {
      border: 0,
      background: 'none',
      padding: 0,
      font: 'inherit',
      fontSize: fontSize.base,
      color: c.textMuted,
      cursor: 'pointer',
      textDecoration: 'none',
    },
    closedNote: {
      margin: 0,
      padding: `14px ${space.lg}`,
      border: `1px solid ${c.borderSoft}`,
      borderRadius: radius.card,
      fontSize: fontSize.md,
      color: c.textMuted,
    },
    stickyBar: {
      position: 'sticky',
      bottom: 0,
      display: 'flex',
      gap: space.sm,
      padding: `${space.md} ${space.lg}`,
      background: c.surface,
      borderTop: `1px solid ${c.border}`,
    },
  } satisfies Record<string, React.CSSProperties>;
}

/** A link styled as a button — mail and WhatsApp drafts are real links. */
export function linkButton(c: Colors, variant: 'primary' | 'secondary'): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    padding: '0 18px',
    borderRadius: 11,
    fontSize: fontSize.md,
    fontWeight: 500,
    textDecoration: 'none',
    cursor: 'pointer',
    font: 'inherit',
    boxSizing: 'border-box',
  };
  return variant === 'primary'
    ? {
        ...base,
        background: c.primarySolid,
        color: c.onPrimary,
        border: `1px solid ${c.primarySolid}`,
        ['--ui-btn-primary-hover' as string]: c.primarySolidHover,
      }
    : {
        ...base,
        background: c.surface,
        color: c.text,
        border: `1px solid ${c.border}`,
        ['--ui-btn-hover' as string]: c.surfaceHover,
      };
}

export function statusPill(fg: string, bg: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 22,
    padding: '0 9px',
    borderRadius: radius.pill,
    fontSize: fontSize.sm,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    background: bg,
    color: fg,
  };
}
