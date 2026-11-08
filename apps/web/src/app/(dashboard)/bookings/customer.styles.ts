import type React from 'react';
import { fontSize, getColors, leading, radius, space } from '@/lib/design-tokens';

type Colors = ReturnType<typeof getColors>;

/**
 * The client portal: overview, a shoot's page, galleries, payments.
 *
 * <p>Calmer than the studio's screens on purpose. A client visits a handful of
 * times per shoot; the page is a short list of what to do and where things
 * stand, with one clear action per row — not a workspace.
 */
export function getPortalStyles(c: Colors) {
  return {
    page: {
      maxWidth: 960,
      margin: '0 auto',
      padding: `${space.xxxl} ${space.xxl} 56px`,
      display: 'flex',
      flexDirection: 'column',
      gap: 36,
      color: c.text,
    },
    header: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: space.lg,
      flexWrap: 'wrap',
    },
    headerText: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
    subtitle: { margin: 0, fontSize: '15px', color: c.textMuted, lineHeight: leading.snug },
    section: { display: 'flex', flexDirection: 'column', gap: space.md },
    sectionHead: { display: 'flex', alignItems: 'baseline', gap: space.sm },
    h2: { margin: 0, fontSize: fontSize.lg, fontWeight: 600, color: c.text },
    count: { fontSize: fontSize.md, color: c.textSubtle },
    card: {
      background: c.surface,
      border: `1px solid ${c.border}`,
      borderRadius: radius.card,
      overflow: 'hidden',
    },
    row: {
      display: 'flex',
      alignItems: 'center',
      gap: space.lg,
      padding: `${space.lg} ${space.xl}`,
      flexWrap: 'wrap',
    },
    rowDivider: { borderTop: `1px solid ${c.borderSoft}` },
    rowIcon: {
      width: 44,
      height: 44,
      borderRadius: 10,
      background: c.surfaceAlt,
      color: c.text,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      objectFit: 'cover',
    },
    rowText: {
      flex: '1 1 260px',
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
    },
    rowTitle: { fontSize: '15px', fontWeight: 500, color: c.text },
    rowMeta: { fontSize: fontSize.base, color: c.textSubtle, lineHeight: leading.snug },
    empty: {
      margin: 0,
      padding: `${space.lg} ${space.xl}`,
      fontSize: fontSize.md,
      color: c.textMuted,
    },
    // A shoot still ahead: the date large, then what and where, then progress.
    shoot: {
      display: 'flex',
      gap: space.xxl,
      padding: space.xxl,
      flexWrap: 'wrap',
      textDecoration: 'none',
      color: 'inherit',
      background: c.surface,
      border: `1px solid ${c.border}`,
      borderRadius: radius.card,
      ['--ui-row-hover' as string]: c.surfaceHover,
    },
    dateBlock: {
      width: 84,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    },
    dateDay: {
      fontSize: 36,
      lineHeight: 1,
      fontWeight: 600,
      letterSpacing: '-0.03em',
      fontVariantNumeric: 'tabular-nums',
    },
    dateSmall: { fontSize: fontSize.base, color: c.textMuted },
    shootBody: {
      flex: '1 1 420px',
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: space.lg,
    },
    shootTop: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: space.md,
      flexWrap: 'wrap',
    },
    shootTitle: { fontSize: '18px', fontWeight: 600, letterSpacing: '-0.01em', color: c.text },
    shootMeta: { fontSize: fontSize.md, color: c.textMuted },
    // A past or cancelled shoot: one quiet line.
    pastRow: {
      display: 'flex',
      alignItems: 'center',
      gap: space.xxl,
      padding: `${space.lg} ${space.xxl}`,
      flexWrap: 'wrap',
      textDecoration: 'none',
      color: 'inherit',
      background: c.surface,
      border: `1px solid ${c.border}`,
      borderRadius: radius.card,
      ['--ui-row-hover' as string]: c.surfaceHover,
    },
    pastDate: { width: 84, flexShrink: 0, fontSize: fontSize.base, color: c.textSubtle },
    steps: {
      listStyle: 'none',
      margin: 0,
      padding: 0,
      display: 'grid',
      gap: space.sm,
    },
    step: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
    stepLabel: { fontSize: fontSize.sm, color: c.textSubtle },
    footer: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      paddingTop: space.xl,
      borderTop: `1px solid ${c.border}`,
      flexWrap: 'wrap',
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: '50%',
      background: c.primaryBg,
      color: c.text,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: fontSize.base,
      fontWeight: 600,
      flexShrink: 0,
    },
    chevron: { color: c.textSubtle, flexShrink: 0 },
  } satisfies Record<string, React.CSSProperties>;
}

/** A progress bar segment: ink when done, amber where the client is, quiet ahead. */
export function stepBar(c: Colors, state: 'done' | 'current' | 'todo'): React.CSSProperties {
  return {
    height: 4,
    borderRadius: 2,
    background: state === 'done' ? c.primarySolid : state === 'current' ? c.warning : c.border,
  };
}

export function stepText(c: Colors, state: 'done' | 'current' | 'todo'): React.CSSProperties {
  return {
    fontSize: fontSize.sm,
    color: state === 'current' ? c.warningText : state === 'done' ? c.textMuted : c.textSubtle,
    fontWeight: state === 'current' ? 500 : 400,
  };
}

export function pill(fg: string, bg: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    height: 24,
    padding: '0 10px',
    borderRadius: radius.pill,
    fontSize: fontSize.base,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    color: fg,
    background: bg,
  };
}

/**
 * A link that looks like the app's `Button` (md): signing, paying and opening a
 * gallery are navigations, so they are real links — middle-click, copy, and a
 * screen reader that announces where they go.
 */
export function linkButton(
  c: Colors,
  variant: 'primary' | 'secondary' | 'ghost'
): { className: string; style: React.CSSProperties } {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 38,
    padding: '9px 16px',
    boxSizing: 'border-box',
    borderRadius: radius.control,
    fontFamily: 'inherit',
    fontSize: '0.875rem',
    fontWeight: 550,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    textDecoration: 'none',
    cursor: 'pointer',
  };
  const paint: React.CSSProperties =
    variant === 'primary'
      ? {
          background: c.primarySolid,
          color: c.onPrimary,
          border: `1px solid ${c.primarySolid}`,
          ['--ui-btn-primary-hover' as string]: c.primarySolidHover,
        }
      : variant === 'ghost'
        ? {
            background: 'transparent',
            color: c.textMuted,
            border: '1px solid transparent',
            ['--ui-btn-hover' as string]: c.surfaceHover,
          }
        : {
            background: c.surface,
            color: c.text,
            border: `1px solid ${c.border}`,
            boxShadow: c.shadowRaised,
            ['--ui-btn-hover' as string]: c.surfaceHover,
          };
  return { className: `ui-press ui-btn-${variant}`, style: { ...base, ...paint } };
}
