import type React from 'react';
import { fontSize, getColors, leading, radius, space } from '@/lib/design-tokens';

type Colors = ReturnType<typeof getColors>;

/**
 * The booking detail pane and the sections inside it (progress, session,
 * payment, invoices, contract, gallery, notes).
 *
 * <p>One file so the sections share one rhythm: the same section padding, the
 * same heading, the same hairline between them. The pane used to be four
 * components each with its own idea of a section title (0.72rem uppercase in
 * one, 0.75rem in another), which is most of why it read as assembled rather
 * than designed. Sections are divided by hairlines, never nested in cards.
 */
export function getDetailStyles(c: Colors) {
  const sectionPad = `${space.xxl} ${space.xxl}`;
  return {
    // The pane scrolls as one; the header (with the actions) stays pinned so
    // the lead action is reachable from the notes at the bottom.
    scroll: { flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative' },
    header: {
      position: 'sticky',
      top: 0,
      zIndex: 3,
      background: c.surface,
      borderBottom: `1px solid ${c.borderSoft}`,
      marginBottom: space.xl,
      padding: `${space.xl} ${space.xxl}`,
      display: 'flex',
      gap: space.lg,
      alignItems: 'flex-start',
      flexWrap: 'wrap',
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: '50%',
      background: c.primaryBg,
      color: c.text,
      display: 'grid',
      placeItems: 'center',
      fontWeight: 600,
      fontSize: fontSize.md,
      flexShrink: 0,
    },
    identity: { flex: '1 1 180px', minWidth: 0 },
    titleRow: { display: 'flex', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
    title: {
      margin: 0,
      fontSize: '22px',
      fontWeight: 600,
      letterSpacing: '-0.015em',
      lineHeight: leading.tight,
      color: c.text,
    },
    metaRow: {
      marginTop: 6,
      color: c.textMuted,
      fontSize: fontSize.md,
      display: 'flex',
      gap: space.sm,
      flexWrap: 'wrap',
      alignItems: 'center',
    },
    metaDot: { color: c.borderActive },
    relChip: {
      fontSize: fontSize.sm,
      fontWeight: 500,
      color: c.text,
      background: c.primaryBg,
      borderRadius: radius.pill,
      padding: '1px 9px',
    },
    relChipMuted: {
      fontSize: fontSize.sm,
      color: c.textMuted,
      background: c.surfaceHover,
      borderRadius: radius.pill,
      padding: '1px 9px',
    },
    actions: { display: 'flex', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
    // Phones: the actions leave the header and sit pinned to the bottom of the
    // pane, under the thumb, the way the mockup on the canvas has them.
    stickyBar: {
      position: 'sticky',
      bottom: 0,
      zIndex: 2,
      display: 'flex',
      gap: space.sm,
      padding: `${space.md} ${space.lg}`,
      background: c.surface,
      borderTop: `1px solid ${c.border}`,
    },

    progressBox: {
      margin: `0 ${space.xxl}`,
      padding: `${space.lg} ${space.xl}`,
      background: c.surfaceAlt,
      border: `1px solid ${c.borderSoft}`,
      borderRadius: radius.card,
    },
    stepList: {
      listStyle: 'none',
      margin: 0,
      padding: 0,
      display: 'grid',
      gap: 0,
    },
    stepTrack: { display: 'flex', alignItems: 'center' },
    stepDotDone: {
      width: 22,
      height: 22,
      borderRadius: '50%',
      background: c.primarySolid,
      color: c.onPrimary,
      display: 'grid',
      placeItems: 'center',
      flexShrink: 0,
    },
    stepDotCurrent: {
      width: 22,
      height: 22,
      borderRadius: '50%',
      background: c.surface,
      border: `2px solid ${c.primarySolid}`,
      boxSizing: 'border-box',
      display: 'grid',
      placeItems: 'center',
      flexShrink: 0,
    },
    stepDotCurrentInner: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: c.primarySolid,
    },
    stepDotTodo: {
      width: 22,
      height: 22,
      borderRadius: '50%',
      background: c.surface,
      border: `1.5px solid ${c.primaryBorder}`,
      boxSizing: 'border-box',
      flexShrink: 0,
    },
    stepLine: { flex: 1, height: 2, margin: `0 ${space.sm}`, borderRadius: 2 },
    stepLabel: {
      marginTop: 10,
      fontSize: fontSize.base,
      fontWeight: 500,
      paddingRight: space.sm,
      color: c.text,
    },
    stepSub: {
      fontSize: fontSize.sm,
      color: c.textSubtle,
      paddingRight: space.sm,
      fontVariantNumeric: 'tabular-nums',
    },

    split: {
      padding: sectionPad,
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)',
      gap: space.xxxl,
    },
    splitSide: { borderLeft: `1px solid ${c.borderSoft}`, paddingLeft: space.xxl },
    eyebrow: {
      margin: `0 0 ${space.md}`,
      fontSize: fontSize.base,
      fontWeight: 500,
      color: c.textSubtle,
    },
    dl: { margin: 0, display: 'flex', flexDirection: 'column', gap: space.md },
    dlRow: {
      display: 'grid',
      gridTemplateColumns: '120px minmax(0, 1fr)',
      gap: space.md,
      alignItems: 'baseline',
    },
    dt: { color: c.textSubtle, fontSize: fontSize.base },
    dd: { margin: 0, color: c.text, fontWeight: 500, fontSize: fontSize.md, minWidth: 0 },
    ddMuted: { margin: 0, color: c.textSubtle, fontSize: fontSize.md },
    inlineLink: {
      marginLeft: space.sm,
      fontSize: fontSize.base,
      fontWeight: 400,
      color: c.textMuted,
    },
    textLink: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: fontSize.base,
      fontWeight: 500,
      color: c.text,
    },

    section: { borderTop: `1px solid ${c.borderSoft}`, padding: sectionPad },
    sectionHead: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.md,
      marginBottom: space.lg,
      flexWrap: 'wrap',
    },
    sectionTitleRow: { display: 'flex', alignItems: 'center', gap: space.sm },
    h3: { margin: 0, fontSize: fontSize.lg, fontWeight: 600, color: c.text },
    body: { margin: 0, fontSize: fontSize.md, color: c.textMuted, lineHeight: leading.normal },
    bodyStrong: { margin: 0, fontSize: fontSize.md, fontWeight: 500, color: c.text },

    figures: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: space.lg,
    },
    figureLabel: { fontSize: fontSize.base, color: c.textSubtle },
    figureValue: {
      fontSize: '22px',
      fontWeight: 600,
      letterSpacing: '-0.01em',
      fontVariantNumeric: 'tabular-nums',
      color: c.text,
    },
    barTrack: {
      marginTop: space.md,
      height: 6,
      borderRadius: radius.pill,
      background: c.borderSoft,
      overflow: 'hidden',
    },
    barFill: { height: '100%', borderRadius: radius.pill, background: c.success },

    table: {
      marginTop: space.xl,
      border: `1px solid ${c.borderSoft}`,
      borderRadius: radius.card,
      overflow: 'hidden',
    },
    invoiceRow: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto auto auto',
      gap: space.md,
      alignItems: 'center',
      padding: `${space.md} ${space.lg}`,
    },
    invoiceNumber: {
      whiteSpace: 'nowrap',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: fontSize.base,
      color: c.text,
      fontWeight: 500,
    },
    invoiceMeta: { fontSize: fontSize.sm, color: c.textSubtle, marginTop: 2 },
    amount: { fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: c.text },
    iconLink: {
      display: 'inline-grid',
      placeItems: 'center',
      width: 32,
      height: 32,
      borderRadius: radius.control,
      color: c.textMuted,
    },
    emptyNote: {
      marginTop: space.xl,
      padding: `${space.md} ${space.lg}`,
      border: `1px dashed ${c.primaryBorder}`,
      borderRadius: radius.card,
      color: c.textMuted,
      fontSize: fontSize.md,
      lineHeight: leading.normal,
    },
    quietError: {
      marginTop: space.xl,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.md,
      padding: `${space.md} ${space.lg}`,
      border: `1px solid ${c.borderSoft}`,
      borderRadius: radius.card,
      color: c.textMuted,
      fontSize: fontSize.md,
    },

    docs: {
      borderTop: `1px solid ${c.borderSoft}`,
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
    docCell: { padding: sectionPad, minWidth: 0 },
    docCellDivided: {
      padding: sectionPad,
      minWidth: 0,
      borderRight: `1px solid ${c.borderSoft}`,
    },

    notesLabel: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: space.sm,
      marginBottom: space.md,
      flexWrap: 'wrap',
    },
    notesHint: { fontSize: fontSize.sm, color: c.textSubtle },
    notesArea: {
      width: '100%',
      boxSizing: 'border-box',
      resize: 'vertical',
      minHeight: 88,
      border: `1px solid ${c.border}`,
      borderRadius: radius.card,
      padding: `${space.md} ${space.lg}`,
      font: 'inherit',
      fontSize: fontSize.md,
      lineHeight: leading.normal,
      color: c.text,
      background: c.surfaceAlt,
    },
    notesActions: {
      display: 'flex',
      alignItems: 'center',
      gap: space.sm,
      marginTop: space.sm,
      minHeight: 32,
    },
    notesStatus: { fontSize: fontSize.sm, color: c.textSubtle },
  } satisfies Record<string, React.CSSProperties>;
}

/** A status pill in the given tone: tinted ground, coloured text and dot. */
export function pill(fg: string, bg: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 24,
    padding: '0 10px',
    borderRadius: radius.pill,
    fontSize: fontSize.sm,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    background: bg,
    color: fg,
    flexShrink: 0,
  };
}

export function dot(color: string): React.CSSProperties {
  return { width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 };
}
