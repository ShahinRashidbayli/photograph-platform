import React from 'react';
import {
  fontSize,
  getColors,
  leading,
  radius,
  space,
  type Theme,
  pageTitle,
} from '@/lib/design-tokens';

export type BookingsTheme = Theme;

export const getBookingsColors = getColors;

/**
 * Every value here comes off a token ramp — `fontSize`, `space`, `radius`,
 * `leading` — rather than a hand-picked rem. This file used to carry 19
 * distinct font sizes (0.66rem, 0.7rem, 0.72rem, 0.74rem, 0.78rem…) which is
 * what made the page read as "slightly off" without the eye being able to name
 * why. A raw px/rem value below should be treated as a bug, not a shortcut.
 */
export const getBookingsStyles = (theme: BookingsTheme): Record<string, React.CSSProperties> => {
  const c = getBookingsColors(theme);

  return {
    pageWrapper: {
      display: 'flex',
      flexDirection: 'column',
      gap: space.xl,
      flex: 1,
      minHeight: '100vh',
      padding: `${space.xxl} ${space.xxl} ${space.xxxl}`,
      width: '100%',
      maxWidth: '1400px',
      margin: '0 auto',
      background: c.bg,
      color: c.text,
      fontFamily: "var(--font-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },

    pageHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: space.xl,
      flexWrap: 'wrap',
    },
    pageTitle: { ...pageTitle, color: c.text },
    pageSubtitle: {
      fontSize: fontSize.md,
      color: c.textMuted,
      lineHeight: leading.normal,
    },
    headerActions: {
      display: 'flex',
      gap: space.sm,
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
    },

    // Metrics are a slim strip, not a row of tall cards: the same three numbers
    // in ~60px instead of ~110px, so the list + detail panes (the actual work
    // area) start higher up the page. Segments are divided by hairlines rather
    // than being separate bordered cards.
    statStrip: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      width: '100%',
      background: c.surface,
      border: `1px solid ${c.border}`,
      borderRadius: radius.card,
      overflow: 'hidden',
    },
    statStripItem: {
      padding: `${space.md} ${space.lg}`,
      display: 'flex',
      flexDirection: 'column',
      gap: space.xxs,
      minWidth: 0,
    },
    // The eyebrow stays small and quiet on purpose: it names the number, it
    // isn't the thing being read. Bumping it to 700 made it compete with the
    // value it labels, which is what flattened the strip.
    statStripLabel: {
      fontSize: fontSize.xs,
      color: c.textMuted,
      fontWeight: 600,
    },
    statStripValueRow: {
      display: 'flex',
      alignItems: 'baseline',
      gap: space.sm,
      minWidth: 0,
    },
    // xl, not lg: the number is the only thing in this strip meant to be read
    // at a glance, so it needs a clear step above the card titles below it.
    statStripValue: {
      fontSize: fontSize.xl,
      fontWeight: 600,
      color: c.text,
      letterSpacing: '-0.02em',
      lineHeight: leading.tight,
      whiteSpace: 'nowrap',
    },
    statStripTrend: {
      fontSize: fontSize.sm,
      fontWeight: 500,
      color: c.textMuted,
      lineHeight: leading.snug,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      minWidth: 0,
    },

    container: {
      display: 'grid',
      gridTemplateColumns: 'minmax(320px, 380px) minmax(0, 1fr)',
      gap: space.lg,
      flex: 1,
      width: '100%',
    },

    listPanel: {
      display: 'flex',
      flexDirection: 'column',
      background: c.surface,
      borderRadius: radius.card,
      border: `1px solid ${c.border}`,
      overflow: 'hidden',
      boxShadow: c.overlayShadow,
      maxHeight: 'calc(100vh - 200px)',
    },
    // Search and the status filter share one row: the filter used to be a
    // second wrapping row of count chips under the search box, which cost a
    // whole bordered band of the panel before the first booking appeared.
    listHeader: {
      padding: `${space.md} ${space.lg}`,
      borderBottom: `1px solid ${c.border}`,
      display: 'flex',
      alignItems: 'center',
      gap: space.sm,
    },
    searchBox: {
      width: '100%',
      padding: `${space.sm} ${space.md}`,
      border: `1px solid ${c.border}`,
      borderRadius: radius.control,
      fontSize: fontSize.md,
      fontFamily: "var(--font-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: c.text,
      backgroundColor: c.surfaceAlt,
      outline: 'none',
      transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
    },
    // Selectable chip (budget ranges in the request-session modal). Inactive is
    // muted text on a transparent ground; active is a filled primary pill.
    chip: {
      padding: `${space.xs} ${space.md}`,
      borderRadius: radius.pill,
      fontSize: fontSize.base,
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.18s ease',
      whiteSpace: 'nowrap',
      border: '1px solid transparent',
      background: 'transparent',
      color: c.textMuted,
    },
    chipActive: {
      background: c.primary,
      color: c.onPrimary,
      border: `1px solid ${c.primary}`,
    },

    listScroll: {
      flex: 1,
      overflowY: 'auto',
      padding: space.sm,
    },
    listItem: {
      width: '100%',
      padding: space.md,
      marginBottom: space.xs,
      borderRadius: radius.control,
      border: '1px solid transparent',
      cursor: 'pointer',
      transition: 'background 0.16s ease, border-color 0.16s ease',
      background: 'transparent',
      display: 'grid',
      gridTemplateColumns: '52px minmax(0, 1fr)',
      gap: space.md,
      alignItems: 'start',
      textAlign: 'left',
      color: c.text,
      fontFamily: 'inherit',
      // Feeds the `.bk-row:hover` rule in the page's stylesheet.
      ['--bk-row-hover' as string]: c.surfaceHover,
    },
    // A quiet fill and a hairline ring — the selected row used to carry a
    // heavy outline that read like a stuck focus ring.
    listItemActive: {
      background: c.surfaceHover,
      border: `1px solid ${c.border}`,
    },
    listItemDate: {
      width: '52px',
      height: '60px',
      boxSizing: 'border-box',
      borderRadius: radius.control,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      background: c.surface,
      border: `1px solid ${c.border}`,
    },
    // Past shoots: the same block, sunk a step into the page.
    listItemDatePast: {
      background: c.surfaceAlt,
    },
    listItemDateMonth: {
      fontSize: fontSize.xs,
      color: c.textSubtle,
      lineHeight: leading.tight,
    },
    listItemDateDay: {
      fontSize: '19px',
      fontWeight: 600,
      color: c.text,
      lineHeight: 1.1,
      fontVariantNumeric: 'tabular-nums',
    },
    listItemOpen: {
      fontSize: fontSize.sm,
      color: c.warningText,
      whiteSpace: 'nowrap',
      fontVariantNumeric: 'tabular-nums',
      flexShrink: 0,
    },
    listItemHint: {
      fontSize: fontSize.sm,
      color: c.textMuted,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      minWidth: 0,
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
    },
    listItemHintDot: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: c.warning,
      flexShrink: 0,
    },
    listItemContent: {
      display: 'flex',
      flexDirection: 'column',
      gap: space.xs,
      minWidth: 0,
    },
    listItemTopRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.sm,
      minWidth: 0,
    },
    listItemBottomRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.sm,
      minWidth: 0,
    },
    listItemName: {
      fontSize: fontSize.md,
      fontWeight: 600,
      color: c.text,
      lineHeight: leading.snug,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      minWidth: 0,
    },
    listItemAmount: {
      fontSize: fontSize.md,
      fontWeight: 600,
      color: c.text,
      letterSpacing: '-0.01em',
      whiteSpace: 'nowrap',
      flexShrink: 0,
    },
    listItemMeta: {
      fontSize: fontSize.sm,
      color: c.textMuted,
      lineHeight: leading.snug,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      minWidth: 0,
    },
    // Day-grouping header inside the list ("This week", "Later"). Sticky so the
    // group a row belongs to stays visible while scrolling a long list.
    listGroupHeader: {
      position: 'sticky',
      top: 0,
      zIndex: 1,
      padding: `${space.sm} ${space.xs} ${space.xs}`,
      background: c.surface,
      fontSize: fontSize.xs,
      fontWeight: 550,
      color: c.textMuted,
    },

    detailPanel: {
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      background: c.surface,
      borderRadius: radius.card,
      border: `1px solid ${c.border}`,
      overflow: 'hidden',
      boxShadow: c.overlayShadow,
      maxHeight: 'calc(100vh - 200px)',
    },
    // Header is a vertical stack — identity on top, a dedicated action bar
    // below — so the status actions never get crammed next to the name in a
    // narrow column (which forced an ugly two-row wrap).
    detailHeader: {
      padding: `${space.lg} ${space.xxl}`,
      borderBottom: `1px solid ${c.border}`,
      display: 'flex',
      flexDirection: 'column',
      gap: space.md,
    },
    detailHeaderLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: space.md,
      minWidth: 0,
    },
    detailAvatar: {
      width: '48px',
      height: '48px',
      borderRadius: radius.control,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: fontSize.md,
      fontWeight: 600,
      flexShrink: 0,
      letterSpacing: '0.02em',
    },
    detailTitleRow: {
      display: 'flex',
      alignItems: 'center',
      gap: space.sm,
      flexWrap: 'wrap',
    },
    detailTitle: {
      fontSize: fontSize.xl,
      fontWeight: 600,
      color: c.text,
      letterSpacing: '-0.015em',
      lineHeight: leading.tight,
    },
    detailSubtitle: {
      fontSize: fontSize.base,
      color: c.textMuted,
      lineHeight: leading.snug,
    },
    // A compact action toolbar with one clear rank: a single filled primary
    // action leads, everything else is a neutral secondary, and destructive
    // moves (cancel) live in the overflow menu — four competing button styles
    // side by side made every row of this panel read as a decision.
    detailActions: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: space.sm,
    },
    // Mobile-only: returns from the detail pane to the list pane.
    backButton: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: space.xs,
      padding: `${space.xs} ${space.sm}`,
      marginLeft: `-${space.sm}`,
      borderRadius: radius.control,
      border: 'none',
      background: 'transparent',
      color: c.textMuted,
      fontSize: fontSize.base,
      fontWeight: 600,
      fontFamily: 'inherit',
      cursor: 'pointer',
    },

    // ─── Overflow ("…") menu ───────────────────────────────────
    menuWrapper: {
      position: 'relative',
      flexShrink: 0,
    },
    menuTrigger: {
      width: '32px',
      height: '32px',
      borderRadius: radius.control,
      border: `1px solid ${c.border}`,
      background: c.surface,
      color: c.textMuted,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background 0.18s ease, color 0.18s ease',
    },
    menuPanel: {
      position: 'absolute',
      top: 'calc(100% + 6px)',
      right: 0,
      minWidth: '200px',
      padding: space.xs,
      background: c.surface,
      border: `1px solid ${c.border}`,
      borderRadius: radius.control,
      boxShadow: c.elevatedShadow,
      display: 'flex',
      flexDirection: 'column',
      gap: space.xxs,
      zIndex: 40,
    },
    menuItem: {
      width: '100%',
      padding: `${space.sm} ${space.sm}`,
      borderRadius: radius.control,
      border: 'none',
      background: 'transparent',
      color: c.text,
      fontSize: fontSize.base,
      fontWeight: 600,
      fontFamily: 'inherit',
      textAlign: 'left',
      whiteSpace: 'nowrap',
      cursor: 'pointer',
      transition: 'background 0.16s ease',
    },
    menuItemDanger: {
      color: c.dangerText,
    },

    detailBody: {
      flex: 1,
      overflowY: 'auto',
      padding: space.xxl,
      display: 'flex',
      flexDirection: 'column',
      gap: space.xxl,
    },

    section: {
      display: 'flex',
      flexDirection: 'column',
      gap: space.md,
    },
    sectionTitle: {
      fontSize: fontSize.xs,
      fontWeight: 550,
      color: c.textMuted,
    },

    infoGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: `${space.md} ${space.xxl}`,
    },
    infoRow: {
      display: 'flex',
      flexDirection: 'column',
      gap: space.xs,
      minWidth: 0,
    },

    badge: {
      padding: `${space.xs} ${space.sm}`,
      borderRadius: radius.pill,
      fontSize: fontSize.xs,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      letterSpacing: '0.02em',
      display: 'inline-flex',
      alignItems: 'center',
      gap: space.xs,
      flexShrink: 0,
    },
    badgeDot: {
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      flexShrink: 0,
    },

    secondaryButton: {
      padding: `${space.sm} ${space.lg}`,
      borderRadius: radius.control,
      fontSize: fontSize.md,
      fontWeight: 600,
      border: `1px solid ${c.border}`,
      background: c.surface,
      color: c.text,
      cursor: 'pointer',
      transition: 'all 0.18s ease',
      whiteSpace: 'nowrap',
      fontFamily: 'inherit',
    },
    primaryButton: {
      padding: `${space.sm} ${space.lg}`,
      borderRadius: radius.control,
      fontSize: fontSize.md,
      fontWeight: 600,
      border: '1px solid transparent',
      background: c.primarySolid,
      color: c.onPrimary,
      cursor: 'pointer',
      transition: 'all 0.18s ease',
      whiteSpace: 'nowrap',
      fontFamily: 'inherit',
      boxShadow: 'none',
    },
    invertedPrimaryButton: {
      padding: `${space.sm} ${space.lg}`,
      borderRadius: radius.control,
      fontSize: fontSize.md,
      fontWeight: 600,
      border: '1px solid transparent',
      background: c.isDark ? '#F1F5F9' : '#0F172A',
      color: c.isDark ? '#0F172A' : '#FFFFFF',
      cursor: 'pointer',
      transition: 'all 0.18s ease',
      whiteSpace: 'nowrap',
      fontFamily: 'inherit',
      boxShadow: c.isDark ? 'none' : '0 4px 12px rgba(15, 23, 42, 0.18)',
    },
    emptyState: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      padding: space.xxxl,
      color: c.textMuted,
      fontSize: fontSize.md,
      textAlign: 'center',
    },

    // ─── Skeletons ─────────────────────────────────────────────
    // Loading shows the shape of the answer rather than the word "Loading":
    // the blocks below mirror the real list row and detail panel, so nothing
    // jumps when the data lands.
    skeletonBlock: {
      background: c.isDark ? 'rgba(148, 163, 184, 0.14)' : '#EEF1F5',
      borderRadius: radius.control,
    },

    // ─── Error / retry panel ───────────────────────────────────
    errorPanel: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.md,
      padding: `${space.xxxl} ${space.xxl}`,
      background: c.surface,
      border: `1px solid ${c.dangerBorder}`,
      borderRadius: radius.card,
      textAlign: 'center',
    },
    errorPanelTitle: {
      fontSize: fontSize.lg,
      fontWeight: 600,
      color: c.text,
    },
    errorPanelText: {
      fontSize: fontSize.md,
      color: c.textMuted,
      maxWidth: '420px',
      lineHeight: leading.normal,
    },
    actionError: {
      fontSize: fontSize.base,
      fontWeight: 600,
      color: c.dangerText,
      background: c.dangerBg,
      border: `1px solid ${c.dangerBorder}`,
      borderRadius: radius.control,
      padding: `${space.sm} ${space.md}`,
      width: '100%',
    },

    // ─── Modal (New booking) ───────────────────────────────────
    modalOverlay: {
      position: 'fixed',
      inset: 0,
      zIndex: 80,
      background: 'rgba(15, 23, 42, 0.55)',
      backdropFilter: 'blur(2px)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: `${space.xxxl} ${space.lg}`,
      overflowY: 'auto',
    },
    modalCard: {
      width: '100%',
      maxWidth: '560px',
      background: c.surface,
      borderRadius: radius.card,
      border: `1px solid ${c.border}`,
      boxShadow: c.elevatedShadow,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    },
    modalHeader: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: space.lg,
      padding: `${space.xl} ${space.xxl}`,
      borderBottom: `1px solid ${c.border}`,
    },
    modalTitle: {
      fontSize: fontSize.xl,
      fontWeight: 600,
      color: c.text,
      letterSpacing: '-0.015em',
    },
    modalSubtitle: {
      fontSize: fontSize.base,
      color: c.textMuted,
      marginTop: space.xxs,
    },
    modalClose: {
      width: '32px',
      height: '32px',
      borderRadius: radius.control,
      border: `1px solid ${c.border}`,
      background: c.surface,
      color: c.textMuted,
      cursor: 'pointer',
      fontSize: fontSize.lg,
      lineHeight: 1,
      flexShrink: 0,
    },
    modalBody: {
      padding: `${space.xl} ${space.xxl}`,
      display: 'flex',
      flexDirection: 'column',
      gap: space.md,
    },
    modalFooter: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: space.sm,
      padding: `${space.lg} ${space.xxl}`,
      borderTop: `1px solid ${c.border}`,
    },
    formRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: space.md,
    },
    formField: {
      display: 'flex',
      flexDirection: 'column',
      gap: space.xs,
      minWidth: 0,
    },
    formLabel: {
      fontSize: fontSize.xs,
      fontWeight: 550,
      color: c.textMuted,
    },
    formInput: {
      width: '100%',
      padding: `${space.sm} ${space.md}`,
      border: `1px solid ${c.border}`,
      borderRadius: radius.control,
      fontSize: fontSize.md,
      fontFamily: "var(--font-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: c.text,
      background: c.surfaceAlt,
      outline: 'none',
    },
    formTextarea: {
      width: '100%',
      padding: `${space.sm} ${space.md}`,
      border: `1px solid ${c.border}`,
      borderRadius: radius.control,
      fontSize: fontSize.md,
      fontFamily: "var(--font-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: c.text,
      background: c.surfaceAlt,
      outline: 'none',
      resize: 'vertical',
      minHeight: '72px',
    },
    fieldError: {
      fontSize: fontSize.xs,
      fontWeight: 600,
      color: c.dangerText,
    },
  };
};

// Backward compatibility shim — always returns the light theme. Prefer
// getBookingsStyles(theme) so dark mode applies automatically.
export const bookingStyles = getBookingsStyles('light');
