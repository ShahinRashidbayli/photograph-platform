import React from 'react';
import { getColors, type Theme } from '@/lib/design-tokens';

export const getGalleriesColors = getColors;

export const getGalleriesStyles = (theme: Theme): Record<string, React.CSSProperties> => {
  const c = getColors(theme);

  return {
    pageWrapper: {
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      flex: 1,
      minHeight: '100vh',
      padding: '28px 28px 40px',
      width: '100%',
      background: c.bg,
      color: c.text,
      fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
    pageHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '20px',
      flexWrap: 'wrap',
    },
    // The figures and the button share the header's right side. `stretch` so
    // the band takes its height from the button rather than setting its own —
    // matched by arithmetic, this drifts the next time either padding changes.
    headerStats: {
      display: 'flex',
      alignItems: 'stretch',
      gap: '12px',
      flexWrap: 'wrap',
    },
    pageTitle: {
      fontSize: '22px',
      fontWeight: 800,
      marginBottom: '4px',
      color: c.text,
    },
    pageSubtitle: {
      fontSize: '13px',
      maxWidth: '560px',
      lineHeight: '1.6',
      color: c.textMuted,
    },

    container: {
      display: 'flex',
      gap: '16px',
      flex: 1,
      overflow: 'hidden',
      padding: '0',
      width: '100%',
      maxWidth: '1400px',
      margin: '0 auto',
      background: c.bg,
    },

    listPanel: {
      display: 'flex',
      flexDirection: 'column',
      width: '320px',
      minWidth: '320px',
      background: c.surface,
      borderRadius: '16px',
      border: `1px solid ${c.border}`,
      overflow: 'hidden',
      boxShadow: c.overlayShadow,
    },
    listHeader: {
      padding: '20px 22px',
      borderBottom: `1px solid ${c.border}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    listTitle: {
      fontSize: '16px',
      fontWeight: 700,
      marginBottom: 0,
      letterSpacing: '-0.01em',
      lineHeight: '1.2',
      color: c.text,
    },
    searchBox: {
      width: '100%',
      marginTop: '6px',
      padding: '12px 14px',
      border: `1px solid ${c.border}`,
      borderRadius: '12px',
      fontSize: '13px',
      fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: c.text,
      backgroundColor: c.surfaceAlt,
      outline: 'none',
    },
    filterTabs: {
      display: 'flex',
      gap: '8px',
      padding: '12px 16px',
      borderBottom: `1px solid ${c.border}`,
      overflowX: 'auto',
    },
    filterTab: {
      padding: '8px 16px',
      border: `1px solid ${c.border}`,
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: 700,
      background: 'transparent',
      color: c.textMuted,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      whiteSpace: 'nowrap',
    },
    filterTabActive: {
      background: c.primary,
      color: '#fff',
      border: `1px solid ${c.primary}`,
    },
    listScroll: {
      flex: 1,
      overflowY: 'auto',
      padding: '12px',
    },
    listItem: {
      padding: '14px 16px',
      marginBottom: '10px',
      borderRadius: '12px',
      border: `1px solid ${c.border}`,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      background: c.surface,
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      color: c.text,
      width: '100%',
      textAlign: 'left',
      fontFamily: 'inherit',
    },
    listItemActive: {
      background: c.surfaceActive,
      border: `1px solid ${c.borderActive}`,
    },
    listItemTitle: {
      fontSize: '13px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
      color: c.text,
    },
    listItemMeta: {
      fontSize: '11px',
      fontWeight: 500,
      color: c.textMuted,
    },

    detailPanel: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      background: c.surface,
      borderRadius: '16px',
      border: `1px solid ${c.border}`,
      overflow: 'hidden',
      boxShadow: c.overlayShadow,
    },
    detailHeader: {
      padding: '22px 26px',
      borderBottom: `1px solid ${c.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '20px',
    },
    detailTitle: {
      fontSize: '18px',
      fontWeight: 700,
      marginBottom: '2px',
      letterSpacing: '-0.01em',
      color: c.text,
    },
    detailSubtitle: {
      fontSize: '13px',
      fontWeight: 500,
      color: c.textMuted,
    },
    detailActions: {
      display: 'flex',
      gap: '10px',
    },
    actionButton: {
      padding: '9px 18px',
      borderRadius: '10px',
      fontSize: '13px',
      fontWeight: 600,
      border: `1px solid ${c.border}`,
      background: c.surface,
      color: c.text,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      whiteSpace: 'nowrap',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
    },
    actionButtonOutline: {
      background: 'transparent',
      color: c.text,
      border: `1px solid ${c.border}`,
    },
    actionButtonPrimary: {
      background: c.primary,
      color: '#fff',
      border: `1px solid ${c.primary}`,
      fontWeight: 700,
    },
    // ── Detail header identity ────────────────────────────────────────────
    detailAvatar: {
      width: 44,
      height: 44,
      borderRadius: '50%',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '15px',
      fontWeight: 700,
      flexShrink: 0,
    },
    detailTitleRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      flexWrap: 'wrap',
      minWidth: 0,
    },

    // ── Panel metrics ─────────────────────────────────────────────────────
    // Value first, label under it, hairlines between — deliberately *not* the
    // shared StatStrip. That component is a bordered band that opens a page;
    // dropped inside a card it reads as a second card, and its label-above
    // order buries the figure. Here the numbers sit directly on the panel.
    metricsRow: {
      display: 'flex',
      alignItems: 'stretch',
      flexShrink: 0,
    },
    metric: {
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      padding: '0 20px',
      minWidth: 0,
    },
    metricValue: {
      fontSize: '24px',
      fontWeight: 800,
      letterSpacing: '-0.02em',
      lineHeight: 1.1,
      color: c.text,
    },
    metricLabel: {
      fontSize: '12px',
      fontWeight: 500,
      color: c.textMuted,
      lineHeight: 1.2,
    },

    // ── Overview band: the figures and the expiry countdown, side by side ──
    // One row rather than two blocks, because "how much is in here" and "how
    // long is it live for" are read together when deciding whether to extend.
    overviewRow: {
      display: 'flex',
      alignItems: 'stretch',
      gap: '20px',
      flexWrap: 'wrap',
      paddingBottom: '18px',
      borderBottom: `1px solid ${c.border}`,
      marginBottom: '18px',
    },
    expiryBlock: {
      flex: '1 1 240px',
      minWidth: 0,
      // Continues the hairline rhythm the metrics beside it set, so the whole
      // band reads as one row of related facts rather than two components
      // that happen to be adjacent.
      borderLeft: `1px solid ${c.border}`,
      paddingLeft: '20px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: '8px',
    },
    expiryHeadRow: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: '12px',
    },
    expiryDate: {
      fontSize: '13px',
      fontWeight: 600,
      color: c.text,
    },
    // The bar makes the number concrete: "59 days" means nothing until you can
    // see it against the window it came out of.
    expiryTrack: {
      height: 4,
      borderRadius: 999,
      background: c.neutralBg,
      overflow: 'hidden',
    },
    expiryFill: {
      height: '100%',
      borderRadius: 999,
      transition: 'width 0.3s ease',
    },

    // ── Sharing ───────────────────────────────────────────────────────────
    toggleList: {
      display: 'flex',
      flexDirection: 'column',
    },
    toggleDivider: {
      borderTop: `1px solid ${c.border}`,
    },

    // ── Photos ────────────────────────────────────────────────────────────
    sectionHeadRow: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: '12px',
      marginBottom: '10px',
    },
    sectionCount: {
      fontSize: '12px',
      color: c.textMuted,
      fontWeight: 600,
    },
    // A dashed tile in the grid rather than only the header button: the place
    // you notice you are short a photo is while looking at the photos.
    addTile: {
      border: `1px dashed ${c.border}`,
      borderRadius: '10px',
      background: 'transparent',
      color: c.textMuted,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '4px',
      fontSize: '11px',
      fontWeight: 600,
      cursor: 'pointer',
      aspectRatio: '1 / 1',
    },

    // ── Link ──────────────────────────────────────────────────────────────
    linkRow: {
      display: 'flex',
      alignItems: 'stretch',
      gap: '8px',
    },

    detailBody: {
      flex: 1,
      overflowY: 'auto',
      padding: '24px 26px',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
    },

    section: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    // A heading, not an eyebrow. Uppercase 11px muted text is a *label* for a
    // value beside it; used as a section title it makes every section look
    // like fine print above the thing that matters.
    sectionTitle: {
      fontSize: '15px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
      marginBottom: '10px',
      color: c.text,
    },

    expiryBadge: {
      fontSize: '11px',
      fontWeight: 700,
      padding: '6px 12px',
      borderRadius: '8px',
      display: 'inline-flex',
      alignItems: 'center',
      whiteSpace: 'nowrap',
      letterSpacing: '0.01em',
    },
    expiryWarning: {
      background: c.warningBg,
      color: c.warningText,
    },
    expiryExpired: {
      background: c.dangerBg,
      color: c.dangerText,
    },
    expiryActive: {
      background: c.successBg,
      color: c.successText,
    },

    emptyState: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      color: c.textMuted,
      fontSize: '14px',
      flexDirection: 'column',
      gap: '8px',
    },

    errorPanel: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      padding: '48px 28px',
      background: c.surface,
      border: `1px solid ${c.dangerBorder}`,
      borderRadius: '16px',
      textAlign: 'center',
      color: c.text,
    },
    errorText: {
      fontSize: '0.875rem',
      color: c.textMuted,
      maxWidth: '420px',
      lineHeight: 1.5,
    },
    retryButton: {
      padding: '9px 20px',
      background: c.primary,
      color: '#fff',
      border: 'none',
      borderRadius: '10px',
      fontSize: '0.875rem',
      fontWeight: 600,
      cursor: 'pointer',
    },

    codeBlock: {
      padding: '12px 14px',
      background: c.surfaceAlt,
      borderRadius: '10px',
      border: `1px solid ${c.border}`,
      fontFamily: 'monospace',
      fontSize: '12px',
      color: c.text,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      lineHeight: '1.5',
      display: 'flex',
      alignItems: 'center',
    },

    // ── delivered-photo grid ────────────────────────────────────────────────
    photoGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
      gap: '10px',
    },
    photoCell: {
      position: 'relative',
      borderRadius: '8px',
      overflow: 'hidden',
      background: c.surfaceAlt,
      border: `1px solid ${c.border}`,
      aspectRatio: '1 / 1',
    },
    photoImg: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      display: 'block',
    },
    photoFallback: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: c.textMuted,
      fontSize: '0.7rem',
    },
    photoDelete: {
      position: 'absolute',
      top: '4px',
      right: '4px',
      width: '20px',
      height: '20px',
      lineHeight: '18px',
      textAlign: 'center',
      padding: 0,
      borderRadius: '6px',
      border: 'none',
      background: 'rgba(0,0,0,0.6)',
      color: '#fff',
      fontSize: '15px',
      cursor: 'pointer',
    },
  };
};

// Keep old export for any existing imports — remove once all consumers updated
export const galleriesStyles = getGalleriesStyles('light');
