import type React from 'react';
import { fonts, getColors, radius, type Theme } from '@/lib/design-tokens';

/**
 * Landing page styles — derived from the app design tokens (`getColors`) so the
 * public marketing page shares the dashboard's indigo-on-neutral brand instead
 * of a bespoke palette. Layout, hover, keyframes and breakpoints live in
 * globals.css (`.landing-*`) because inline styles can't express those.
 *
 * The one deliberate departure from the dashboard is typography: headings use
 * `fonts.serif` (an editorial display face) to give the marketing site more
 * personality. The dense product UI stays on `fonts.sans`.
 */

/** Duotone gradients standing in for real photographs in the gallery preview. */
export const PHOTO_GRADIENTS = [
  'linear-gradient(150deg, #F0B45E, #C56B36 52%, #6E3A2C)', // golden hour
  'linear-gradient(155deg, #8E7BFF, #4B37C8 46%, #241B4A)', // twilight
  'linear-gradient(150deg, #E79CB0, #9E5A82 48%, #3E274F)', // dusk
  'linear-gradient(150deg, #C9BFF6, #7C6CD8 48%, #2A2740)', // studio
  'linear-gradient(150deg, #8FB98D, #46795E 50%, #1F3A36)', // forest
  'linear-gradient(150deg, #F1A6A0, #B65C6E 50%, #45283F)', // rose
  'linear-gradient(155deg, #F4C77E, #B0567A 52%, #2E2352)', // city
  'linear-gradient(150deg, #AEC6D8, #5E7E9C 50%, #2A3446)', // mist
];

export const getLandingStyles = (theme: Theme) => {
  const c = getColors(theme);
  const isDark = c.isDark;

  const styles = {
    page: {
      position: 'relative',
      minHeight: '100vh',
      fontFamily: fonts.sans,
      background: c.bg,
      color: c.text,
      transition: 'background 0.3s ease, color 0.3s ease',
      overflowX: 'hidden',
    },

    // ─── Nav ───────────────────────────────────────────────────
    // The bar itself is full-bleed (border + blur span the viewport), but its
    // contents sit in the same 1180 container as the hero/sections so the logo
    // lines up with the content edge instead of hugging the window.
    navbar: {
      position: 'sticky',
      top: 0,
      zIndex: 100,
      borderBottom: `1px solid ${c.border}`,
      background: isDark ? 'rgba(10,10,12,0.76)' : 'rgba(247,248,251,0.78)',
      backdropFilter: 'blur(16px) saturate(1.4)',
      WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
      transition: 'box-shadow 0.25s ease, background 0.25s ease',
    },
    // Applied once the page scrolls past the hero: a stronger backdrop + soft
    // shadow lift the bar off the content so it reads as a floating layer.
    navbarScrolled: {
      background: isDark ? 'rgba(10,10,12,0.9)' : 'rgba(247,248,251,0.92)',
      boxShadow: isDark
        ? '0 10px 30px -18px rgba(0,0,0,0.8)'
        : '0 10px 30px -18px rgba(2,6,23,0.26)',
    },
    navInner: {
      maxWidth: 1180,
      margin: '0 auto',
      padding: '0 32px',
      height: 66,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    navLogo: { display: 'flex', alignItems: 'center', textDecoration: 'none', cursor: 'pointer' },
    navLinks: { display: 'flex', gap: 30 },
    navLink: {
      fontSize: '0.92rem',
      fontWeight: 500,
      color: c.textMuted,
      textDecoration: 'none',
      cursor: 'pointer',
    },
    navRight: { display: 'flex', alignItems: 'center', gap: 12 },
    // Hidden above 860px by `.landing-nav-menu-btn`, where the section links
    // are laid out in the bar itself.
    navMenuBtn: {
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      width: 38,
      height: 38,
      borderRadius: radius.control,
      border: `1px solid ${c.border}`,
      background: 'transparent',
      color: c.text,
      cursor: 'pointer',
      padding: 0,
    },
    // Drops out of the bar rather than covering the page: the menu holds four
    // anchors and a sign-in link, and a full-screen overlay for five items
    // hides the hero it was opened from.
    navMenu: {
      display: 'flex',
      flexDirection: 'column',
      padding: '8px 20px 16px',
      borderTop: `1px solid ${c.border}`,
      background: isDark ? 'rgba(10,10,12,0.97)' : 'rgba(247,248,251,0.98)',
    },
    navMenuLink: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '13px 2px',
      fontSize: '0.95rem',
      fontWeight: 500,
      color: c.text,
      textDecoration: 'none',
      borderBottom: `1px solid ${c.border}`,
    },
    navSignIn: {
      fontSize: '0.9rem',
      fontWeight: 600,
      color: c.text,
      textDecoration: 'none',
      cursor: 'pointer',
    },

    // ─── Hero ──────────────────────────────────────────────────
    hero: {
      position: 'relative',
      maxWidth: 1180,
      margin: '0 auto',
      padding: '78px 32px 64px',
      overflow: 'hidden',
    },
    heroGlow: {
      position: 'absolute',
      zIndex: 0,
      width: 660,
      height: 660,
      borderRadius: '50%',
      top: -240,
      right: -180,
      pointerEvents: 'none',
      background: `radial-gradient(circle, ${c.primaryBg} 0%, transparent 70%)`,
      filter: 'blur(10px)',
    },
    heroBg: {
      position: 'absolute',
      inset: 0,
      zIndex: 0,
      pointerEvents: 'none',
      opacity: 0.6,
      backgroundImage: `linear-gradient(${c.border} 1px, transparent 1px), linear-gradient(90deg, ${c.border} 1px, transparent 1px)`,
      backgroundSize: '54px 54px',
      maskImage: 'radial-gradient(circle at 28% 36%, #000, transparent 76%)',
      WebkitMaskImage: 'radial-gradient(circle at 28% 36%, #000, transparent 76%)',
    },
    // Container for the drifting aurora blobs (positioning + blobs live in
    // globals.css `.landing-aurora`). Only the opacity differs by theme —
    // richer in the dark hero, restrained on the light background.
    heroAurora: { opacity: isDark ? 0.85 : 0.5 },
    heroInner: { position: 'relative', zIndex: 2 },
    pill: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 9,
      padding: '7px 15px 7px 11px',
      borderRadius: radius.pill,
      background: c.surface,
      border: `1px solid ${c.border}`,
      fontFamily: fonts.mono,
      fontSize: '0.74rem',
      color: c.textMuted,
      marginBottom: 26,
      boxShadow: c.overlayShadow,
    },
    pillFlag: {
      width: 20,
      height: 14,
      borderRadius: 3,
      overflow: 'hidden',
      display: 'inline-flex',
      flexDirection: 'column',
      boxShadow: '0 0 0 1px rgba(0,0,0,0.2)',
    },
    heroTitle: {
      fontFamily: fonts.serif,
      fontSize: 'clamp(2.7rem, 5.6vw, 4.2rem)',
      fontWeight: 500,
      lineHeight: 1.05,
      letterSpacing: '-0.02em',
      margin: '0 0 22px 0',
    },
    // Gradient text — brand indigo→violet→indigo, swept horizontally by the
    // `.landing-accent-shimmer` class. `backgroundSize > 100%` gives the sweep
    // room to travel; the text is painted transparent so the gradient shows
    // through the glyphs.
    heroAccent: {
      fontStyle: 'italic',
      backgroundImage: 'linear-gradient(90deg, #6366f1, #a855f7 42%, #6366f1 82%)',
      backgroundSize: '220% auto',
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      color: 'transparent',
      WebkitTextFillColor: 'transparent',
    },
    lede: {
      fontSize: '1.14rem',
      lineHeight: 1.62,
      color: c.textMuted,
      maxWidth: 490,
      margin: '0 0 32px 0',
    },
    heroCta: { display: 'flex', gap: 13, flexWrap: 'wrap', marginBottom: 22 },
    heroMicro: {
      display: 'flex',
      gap: 18,
      flexWrap: 'wrap',
      fontFamily: fonts.mono,
      fontSize: '0.76rem',
      color: c.textSubtle,
    },
    heroMicroItem: { display: 'inline-flex', alignItems: 'center', gap: 7 },

    // Secondary / outline button (hover handled inline, matching auth pages).
    btnOutline: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: '13px 22px',
      boxSizing: 'border-box',
      borderRadius: radius.pill,
      fontSize: '0.94rem',
      fontWeight: 600,
      cursor: 'pointer',
      textDecoration: 'none',
      whiteSpace: 'nowrap',
      background: 'transparent',
      color: c.text,
      border: `1px solid ${c.border}`,
      transition: 'all 0.2s',
    },

    // ─── Product mockup ────────────────────────────────────────
    mock: {
      position: 'relative',
      background: c.surface,
      border: `1px solid ${c.border}`,
      borderRadius: 20,
      padding: 15,
      boxShadow: isDark
        ? '0 48px 100px -30px rgba(0,0,0,0.72)'
        : '0 40px 90px -30px rgba(15,23,42,0.2)',
    },
    mockTop: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '3px 4px 13px',
      borderBottom: `1px solid ${c.border}`,
      marginBottom: 13,
    },
    dots: { display: 'flex', gap: 6 },
    dot: { width: 10, height: 10, borderRadius: '50%', background: c.borderSoft },
    mockTab: {
      fontFamily: fonts.mono,
      fontSize: '0.72rem',
      color: c.textMuted,
      display: 'flex',
      gap: 7,
      alignItems: 'center',
      marginLeft: 'auto',
    },
    live: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: c.success,
      boxShadow: `0 0 0 3px ${c.successBg}`,
    },
    mockTitle: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 13,
      padding: '0 3px',
    },
    mockTitleH: {
      fontFamily: fonts.serif,
      fontSize: '1rem',
      fontWeight: 500,
      color: c.text,
      margin: 0,
    },
    mockChip: {
      fontFamily: fonts.mono,
      fontSize: '0.7rem',
      fontWeight: 600,
      color: c.primaryText,
      background: c.primaryBg,
      border: `1px solid ${c.primaryBorder}`,
      padding: '4px 10px',
      borderRadius: radius.pill,
    },
    row: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '11px 12px',
      borderRadius: 12,
      background: c.surfaceAlt,
      border: `1px solid ${c.border}`,
      marginBottom: 8,
    },
    avatar: {
      width: 34,
      height: 34,
      borderRadius: 9,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: fonts.mono,
      fontWeight: 700,
      fontSize: '0.72rem',
      color: '#fff',
      flexShrink: 0,
    },
    rowInfo: { flex: 1, minWidth: 0 },
    rowName: {
      display: 'block',
      fontSize: '0.84rem',
      fontWeight: 600,
      color: c.text,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    rowMeta: { fontFamily: fonts.mono, fontSize: '0.7rem', color: c.textSubtle },
    status: {
      fontFamily: fonts.mono,
      fontSize: '0.66rem',
      fontWeight: 600,
      padding: '4px 9px',
      borderRadius: radius.pill,
      whiteSpace: 'nowrap',
    },
    statusConf: { color: c.infoText, background: c.infoBg },
    statusPaid: { color: c.successText, background: c.successBg },
    statusPend: { color: c.warningText, background: c.warningBg },
    toast: {
      position: 'absolute',
      left: -18,
      bottom: 24,
      zIndex: 4,
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      background: c.surface,
      border: `1px solid ${c.border}`,
      color: c.text,
      padding: '12px 15px',
      borderRadius: 14,
      boxShadow: c.elevatedShadow,
    },
    toastTick: {
      width: 32,
      height: 32,
      borderRadius: 9,
      background: c.successBg,
      color: c.success,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    toastB: { fontSize: '0.82rem', fontWeight: 700, display: 'block', color: c.text },
    toastSpan: { fontFamily: fonts.mono, fontSize: '0.7rem', color: c.textMuted },

    // ─── Capability strip ──────────────────────────────────────
    // Horizontal mask fades the marquee in/out at both edges so items don't
    // hard-cut against the strip borders — the standard modern marquee finish.
    strip: {
      borderTop: `1px solid ${c.border}`,
      borderBottom: `1px solid ${c.border}`,
      background: c.surfaceAlt,
      overflow: 'hidden',
      maskImage: 'linear-gradient(90deg, transparent, #000 9%, #000 91%, transparent)',
      WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 9%, #000 91%, transparent)',
    },
    stripItem: {
      fontFamily: fonts.mono,
      fontSize: '0.8rem',
      letterSpacing: '0.05em',
      color: c.textMuted,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 40,
      paddingLeft: 40,
      whiteSpace: 'nowrap',
    },
    stripDiamond: { color: c.primaryText, fontSize: '0.55rem' },

    // ─── Section chrome ────────────────────────────────────────
    // 80px (was 100) — every section boundary stacked two 100px paddings into a
    // 200px void between blocks; 80 keeps the sections breathing without the
    // dead space that made the page feel empty on scroll.
    section: { maxWidth: 1180, margin: '0 auto', padding: '80px 32px' },
    // 720 (was 640): at 640 the display sizes below broke the longer German
    // section titles one word onto a line of their own.
    headCenter: { maxWidth: 720, margin: '0 auto 50px', textAlign: 'center' },
    eyebrow: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      fontFamily: fonts.mono,
      fontSize: '0.72rem',
      letterSpacing: '0.2em',
      textTransform: 'uppercase',
      color: c.primaryText,
      fontWeight: 600,
    },
    eyebrowLine: { width: 20, height: 1, background: c.primaryBorder, display: 'inline-block' },
    sectionTitle: {
      fontFamily: fonts.serif,
      fontSize: 'clamp(2rem, 3.8vw, 2.9rem)',
      fontWeight: 500,
      letterSpacing: '-0.02em',
      lineHeight: 1.08,
      color: c.text,
      margin: '15px 0 15px',
      // Evens the two lines out instead of leaving a single orphan word on the
      // second one — the titles are display type, so the rag is very visible.
      textWrap: 'balance',
    },
    sectionSub: {
      fontSize: '1.08rem',
      lineHeight: 1.6,
      color: c.textMuted,
      margin: 0,
      textWrap: 'balance',
    },

    // ─── Bento ─────────────────────────────────────────────────
    tile: {
      background: c.surface,
      border: `1px solid ${c.border}`,
      borderRadius: 18,
      padding: 26,
      display: 'flex',
      flexDirection: 'column',
    },
    tileBig: {
      background: c.surface,
      border: `1px solid ${c.border}`,
      borderRadius: 18,
      padding: 0,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    },
    tileTitle: {
      fontFamily: fonts.serif,
      fontSize: '1.2rem',
      fontWeight: 500,
      color: c.text,
      margin: '0 0 8px 0',
    },
    tileText: { fontSize: '0.92rem', lineHeight: 1.55, color: c.textMuted, margin: 0 },
    // Header block kept together at the top so the mini-visual can be pushed to
    // the bottom of the card via `marginTop: auto`, filling the dead space.
    tileHead: { display: 'flex', flexDirection: 'column' },

    // ─── Audience ──────────────────────────────────────────────
    // Asymmetric on purpose. Two equal panels said the photographer and the
    // client were two audiences of equal standing; only one of them can buy
    // anything, and they were being offered competing calls to action one
    // screen above the pricing table.
    // 1000, not the section's full 1180: four outcomes in a 2×2 grid across
    // the full width gave each line a 545px measure and left the card reading
    // as an empty plate. The narrower card sits under the centred heading as
    // one deliberate block.
    studioCard: {
      maxWidth: 1000,
      margin: '0 auto',
      boxSizing: 'border-box',
      background: c.surface,
      border: `1px solid ${c.border}`,
      borderRadius: 18,
      padding: '30px 32px',
    },
    outcome: { display: 'flex', alignItems: 'flex-start', gap: 12 },
    // One icon per outcome, in the brand indigo. Four identical green ticks
    // said "included in your plan" — the pricing table's language, repeated one
    // screen above the pricing table — and carried no information of their own.
    outcomeIcon: {
      color: c.primaryStrong,
      display: 'inline-flex',
      flexShrink: 0,
      marginTop: 2,
    },
    outcomeTitle: {
      display: 'block',
      fontSize: '1rem',
      fontWeight: 600,
      color: c.text,
      lineHeight: 1.35,
    },
    outcomeText: { display: 'block', fontSize: '0.9rem', color: c.textMuted, marginTop: 2 },
    // A hand-off to the pricing table directly below, not a third copy of the
    // page's primary CTA. The button that used to sit here repeated the hero's
    // offer — same label, same "no credit card" line as the closing CTA — one
    // screen above three more of the same button in the pricing cards.
    studioCta: {
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '12px 18px',
      marginTop: 26,
      paddingTop: 22,
      borderTop: `1px solid ${c.border}`,
    },
    studioLink: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      fontSize: '0.95rem',
      fontWeight: 600,
      color: c.primaryStrong,
      textDecoration: 'none',
    },

    // The client card is quieter than the studio card by design: no hover
    // lift, no call to action — it is evidence, not an offer. Quieter is a
    // flatter fill, though, not an outline: bordered-but-empty next to a filled
    // card of the same radius and width read as a disabled version of it.
    // The fill has to sit *below* the studio card in both themes, and no single
    // token does that: `surfaceAlt` is a hair off the light page background
    // (#F8FAFC on #F7F8FB) so the card would vanish, while `borderSoft` is
    // lighter than `surface` in dark mode, which would put the quiet card above
    // the loud one. One token per theme, picked for the same relationship.
    clientCard: {
      maxWidth: 1000,
      margin: '16px auto 0',
      boxSizing: 'border-box',
      border: 'none',
      borderRadius: 18,
      padding: '22px 32px 26px',
      background: isDark ? c.surfaceAlt : c.borderSoft,
    },
    clientTitle: {
      fontSize: '1.02rem',
      fontWeight: 600,
      color: c.text,
      margin: '0 0 16px',
    },
    clientItem: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      fontSize: '0.95rem',
      color: c.textMuted,
      lineHeight: 1.4,
    },
    // Flat, currentColor, same weight as the text it sits beside. The gradient
    // chips this replaces colour-coded photographer vs client — a code used
    // nowhere else on a page that is otherwise deliberately flat.
    clientIcon: { color: c.textSubtle, display: 'inline-flex', flexShrink: 0, marginTop: 1 },

    // ─── Feature mini-visuals ──────────────────────────────────
    // Each feature card earns its height with a small product preview instead
    // of empty space — a shared "list of rows" language so the four cards read
    // as one system.
    // Was `marginTop: 'auto'`, which pinned the preview to the bottom of a tile
    // whose height came from `grid-auto-rows: 1fr` — so a short card showed its
    // copy at the top, its preview at the floor, and 150–200px of nothing in
    // between. That reads as unfinished rather than airy. The preview now sits
    // directly under the copy it illustrates, separated by a hairline, and the
    // tile is as tall as what is in it.
    mini: {
      marginTop: 18,
      paddingTop: 18,
      borderTop: `1px solid ${c.border}`,
      display: 'flex',
      flexDirection: 'column',
      gap: 7,
    },
    miniRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      padding: '9px 11px',
      background: c.surfaceAlt,
      border: `1px solid ${c.border}`,
      borderRadius: 10,
    },
    miniRowActive: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      padding: '9px 11px',
      background: c.primaryBg,
      border: `1px solid ${c.primaryBorder}`,
      borderRadius: 10,
    },
    miniLabel: {
      fontSize: '0.78rem',
      fontWeight: 500,
      color: c.text,
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      minWidth: 0,
    },
    miniPillPrimary: {
      fontSize: '0.66rem',
      fontWeight: 700,
      letterSpacing: '0.02em',
      padding: '3px 8px',
      borderRadius: radius.pill,
      background: c.primaryBg,
      color: c.primaryText,
      border: `1px solid ${c.primaryBorder}`,
      whiteSpace: 'nowrap' as const,
    },
    miniPillSuccess: {
      fontSize: '0.66rem',
      fontWeight: 700,
      letterSpacing: '0.02em',
      padding: '3px 8px',
      borderRadius: radius.pill,
      background: c.successBg,
      color: c.successText,
      border: `1px solid ${c.successBorder}`,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      whiteSpace: 'nowrap' as const,
    },
    miniPillNeutral: {
      fontSize: '0.66rem',
      fontWeight: 700,
      letterSpacing: '0.02em',
      padding: '3px 8px',
      borderRadius: radius.pill,
      background: c.neutralBg,
      color: c.textSubtle,
      whiteSpace: 'nowrap' as const,
    },
    bigBody: { padding: '30px 30px 0' },
    bigTitle: {
      fontFamily: fonts.serif,
      fontSize: '1.5rem',
      fontWeight: 500,
      color: c.text,
      margin: '0 0 10px 0',
    },
    bigText: {
      fontSize: '0.98rem',
      lineHeight: 1.55,
      color: c.textMuted,
      margin: 0,
      maxWidth: 400,
    },
    galleryPrevWrap: { marginTop: 20, padding: '0 30px 30px' },
    // Chrome bar that turns the swatch grid into a believable product screen:
    // the gallery's name, its counts, and the client's primary action.
    galleryBar: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: '14px 0 16px',
      borderTop: `1px solid ${c.border}`,
    },
    galleryBarName: {
      fontSize: '0.9rem',
      fontWeight: 600,
      color: c.text,
      margin: 0,
      lineHeight: 1.3,
    },
    galleryBarMeta: {
      fontSize: '0.75rem',
      color: c.textSubtle,
      marginTop: 2,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    },
    galleryBarAction: {
      flexShrink: 0,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: '0.75rem',
      fontWeight: 600,
      color: c.primaryText,
      background: c.primaryBg,
      border: `1px solid ${c.primaryBorder}`,
      padding: '6px 12px',
      borderRadius: radius.pill,
    },
    gp: {
      borderRadius: 10,
      position: 'relative',
      overflow: 'hidden',
      breakInside: 'avoid',
      marginBottom: 9,
    },
    // Selected frame — the violet ring + tick a client sees after picking a shot.
    gpSel: {
      position: 'absolute',
      inset: 0,
      borderRadius: 10,
      border: `2px solid ${c.primary}`,
      boxShadow: `inset 0 0 0 3px rgba(255,255,255,0.35)`,
      zIndex: 4,
      pointerEvents: 'none',
    },
    gpCheck: {
      position: 'absolute',
      bottom: 6,
      right: 6,
      zIndex: 5,
      width: 20,
      height: 20,
      borderRadius: '50%',
      background: c.primary,
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
    },
    gpShade: {
      position: 'absolute',
      inset: 0,
      background:
        'radial-gradient(120% 80% at 20% 10%, rgba(255,255,255,0.28), transparent 46%),' +
        'radial-gradient(140% 120% at 82% 112%, rgba(0,0,0,0.42), transparent 60%)',
      mixBlendMode: 'soft-light',
    },
    gpFav: { position: 'absolute', top: 6, right: 6, zIndex: 3, color: '#fff' },

    // ─── Workflow band ─────────────────────────────────────────
    band: {
      position: 'relative',
      overflow: 'hidden',
      background: c.surfaceAlt,
      borderTop: `1px solid ${c.border}`,
      borderBottom: `1px solid ${c.border}`,
    },
    bandGlow: {
      content: '""',
      position: 'absolute',
      bottom: -220,
      left: -140,
      width: 580,
      height: 580,
      background: `radial-gradient(circle, ${c.primaryBg}, transparent 68%)`,
      pointerEvents: 'none',
    },
    step: {
      position: 'relative',
      background: c.surface,
      border: `1px solid ${c.border}`,
      borderRadius: 18,
      padding: '22px 20px',
      transition: 'border-color 0.2s, transform 0.2s',
    },
    stepNo: {
      fontFamily: fonts.mono,
      fontWeight: 600,
      fontSize: '0.72rem',
      color: c.primaryText,
      marginBottom: 14,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    },
    stepNoLine: { flex: 1, height: 1, background: c.border, display: 'inline-block' },
    stepIcon: {
      width: 38,
      height: 38,
      borderRadius: 10,
      background: c.primaryBg,
      border: `1px solid ${c.primaryBorder}`,
      color: c.primaryText,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    stepH: {
      fontFamily: fonts.serif,
      fontSize: '1.06rem',
      fontWeight: 500,
      color: c.text,
      margin: '0 0 6px 0',
    },
    stepP: { fontSize: '0.82rem', color: c.textMuted, lineHeight: 1.5, margin: 0 },
    warr: {
      position: 'absolute',
      right: -11,
      top: '50%',
      transform: 'translateY(-50%)',
      zIndex: 3,
      color: c.primaryText,
      opacity: 0.6,
    },

    // ─── Pricing ───────────────────────────────────────────────
    priceSwitch: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      background: c.surface,
      border: `1px solid ${c.border}`,
      borderRadius: radius.pill,
      padding: 5,
      marginTop: 22,
    },
    priceSwitchBtn: {
      fontFamily: fonts.sans,
      fontWeight: 600,
      fontSize: '0.86rem',
      padding: '8px 18px',
      border: 'none',
      background: 'transparent',
      borderRadius: radius.pill,
      cursor: 'pointer',
      color: c.textMuted,
      transition: '0.18s',
    },
    priceSwitchBtnOn: { background: c.primary, color: '#fff' },
    priceSave: {
      fontFamily: fonts.mono,
      fontSize: '0.66rem',
      color: c.success,
      fontWeight: 700,
      marginLeft: 4,
    },
    pricesWrap: { marginTop: 50 },
    priceCard: {
      background: c.surface,
      border: `1px solid ${c.border}`,
      borderRadius: 18,
      padding: '32px 28px',
      position: 'relative',
      transition: 'transform 0.2s ease',
    },
    priceCardHot: { border: `1.5px solid ${c.primary}`, boxShadow: c.elevatedShadow },
    priceBadge: {
      position: 'absolute',
      top: -13,
      left: '50%',
      transform: 'translateX(-50%)',
      background: c.primary,
      color: '#fff',
      fontFamily: fonts.mono,
      fontWeight: 600,
      fontSize: '0.66rem',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      padding: '5px 14px',
      borderRadius: radius.pill,
      whiteSpace: 'nowrap',
      boxShadow: `0 8px 20px -8px ${c.primary}`,
    },
    tier: {
      fontFamily: fonts.mono,
      fontWeight: 600,
      fontSize: '0.72rem',
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: c.textSubtle,
      marginBottom: 16,
    },
    tierPro: { color: c.primaryText },
    amount: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 2,
      marginBottom: 4,
      fontFamily: fonts.serif,
    },
    amountCur: { fontSize: '1.3rem', color: c.textMuted, alignSelf: 'flex-start', marginTop: 8 },
    amountVal: {
      fontSize: '3.1rem',
      fontWeight: 500,
      color: c.text,
      lineHeight: 1,
      fontVariantNumeric: 'tabular-nums',
    },
    amountPer: { fontFamily: fonts.mono, fontSize: '0.9rem', color: c.textSubtle },
    billed: { fontFamily: fonts.mono, fontSize: '0.74rem', color: c.textSubtle, marginBottom: 20 },
    // Hairline above the feature list splits the card into "pick this plan"
    // (tier + price + CTA) and "what's included", so the CTA no longer floats
    // in loose whitespace above the list.
    priceFeatures: {
      listStyle: 'none',
      padding: '20px 0 0',
      margin: '20px 0 0',
      borderTop: `1px solid ${c.border}`,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    },
    // `flex-start`, not `center`: a label long enough to wrap — which German
    // reliably produces, and a "Soon" badge makes likelier — used to centre its
    // 20px marker against two lines of text, leaving the tick floating in the
    // middle of the row. Aligned to the top it sits on the first line, where
    // the eye scans for it.
    priceItem: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 11,
      fontSize: '0.9rem',
      lineHeight: 1.45,
      color: c.text,
    },
    priceChk: {
      width: 20,
      height: 20,
      borderRadius: 6,
      background: c.primaryBg,
      color: c.primaryText,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    // The roadmap counterpart of {@link priceChk}: same footprint so the labels
    // stay in one column, but hollow — an outlined ring carries "not yet" on
    // sight, where a filled tick beside a "Soon" badge said both at once.
    priceChkSoon: {
      width: 20,
      height: 20,
      borderRadius: 6,
      background: 'transparent',
      border: `1.5px dashed ${c.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    // Roadmap labels step back to muted so a card is scannable for what it
    // gives you today without reading every badge.
    priceLabelSoon: { color: c.textMuted },
    // Footnote marker sits tight to the label; the note itself is centred under
    // the whole grid so it reads as a caveat on the pricing, not on one card.
    priceFootMark: { color: c.textMuted, marginLeft: 2, fontWeight: 700 },
    priceFootnote: {
      maxWidth: 720,
      margin: '28px auto 0',
      textAlign: 'center',
      fontSize: '0.8rem',
      lineHeight: 1.6,
      color: c.textMuted,
    },
    // Quieter and tighter than the footnote: it qualifies the prices rather
    // than adding a condition, and it sits directly under the billing switch,
    // so it must not compete with the cards it introduces.
    priceVatNote: {
      marginTop: 14,
      fontSize: '0.78rem',
      color: c.textSubtle,
    },

    // ─── Closing CTA ───────────────────────────────────────────
    // The page's bookend, and the only block on it that is neither a card nor
    // inside the 1180 container. Everything between the hero and here is a
    // contained panel; a closing CTA built as one more panel reads as the next
    // item in the list rather than the end of the argument — which is what the
    // rounded, shadowed box that used to sit here did, one card-width above the
    // footer.
    //
    // So it borrows the hero's own vocabulary instead: full-bleed, the same
    // faint grid, the same drifting aurora, the same serif display line with
    // one word carrying the indigo shimmer, the same primary pill. The page
    // opens and closes in one language.
    //
    // The band's fill runs from the page background to the footer's, so the
    // CTA dissolves into the footer as a single closing unit rather than
    // stopping at an edge one block above it.
    ctaSection: {
      position: 'relative',
      overflow: 'hidden',
      borderTop: `1px solid ${c.border}`,
      background: `linear-gradient(180deg, ${c.bg} 0%, ${c.bg} 42%, ${c.surfaceAlt} 100%)`,
      padding: 'clamp(84px, 9vw, 116px) 0 clamp(88px, 9vw, 120px)',
    },
    // Same grid as the hero, masked to a centred pool so it fades out well
    // before the band's edges — a full-width grid would fight the footer's rule.
    ctaGrid: {
      position: 'absolute',
      inset: 0,
      zIndex: 0,
      pointerEvents: 'none',
      opacity: 0.5,
      backgroundImage: `linear-gradient(${c.border} 1px, transparent 1px), linear-gradient(90deg, ${c.border} 1px, transparent 1px)`,
      backgroundSize: '54px 54px',
      maskImage: 'radial-gradient(closest-side at 50% 44%, #000, transparent 78%)',
      WebkitMaskImage: 'radial-gradient(closest-side at 50% 44%, #000, transparent 78%)',
    },
    // Dimmer than the hero's: this one sits behind body copy and a CTA, not
    // beside them.
    ctaAurora: { opacity: isDark ? 0.6 : 0.34 },
    ctaInner: {
      position: 'relative',
      zIndex: 2,
      maxWidth: 1180,
      margin: '0 auto',
      padding: '0 32px',
      textAlign: 'center',
    },
    // Between the hero's display size and a section title: bigger than the
    // headings it follows, because it is the last thing the page says.
    ctaTitle: {
      fontFamily: fonts.serif,
      fontSize: 'clamp(2.3rem, 4.6vw, 3.4rem)',
      fontWeight: 500,
      letterSpacing: '-0.02em',
      lineHeight: 1.06,
      color: c.text,
      maxWidth: 780,
      margin: '0 auto 20px',
      textWrap: 'balance',
    },
    ctaText: {
      color: c.textMuted,
      fontSize: '1.1rem',
      lineHeight: 1.6,
      maxWidth: 540,
      margin: '0 auto 34px',
      textWrap: 'balance',
    },
    ctaActions: { display: 'flex', justifyContent: 'center' },
    ctaMicro: {
      marginTop: 20,
      fontFamily: fonts.mono,
      fontSize: '0.78rem',
      color: c.textSubtle,
      // On a phone the line wraps; balancing it breaks between the two claims
      // instead of hyphenating "DSGVO-konform" across lines.
      textWrap: 'balance',
    },

    // ─── Footer ────────────────────────────────────────────────
    footer: {
      position: 'relative',
      background: c.surfaceAlt,
      borderTop: `1px solid ${c.border}`,
      padding: '54px 0 34px',
      overflow: 'hidden',
    },
    // Brand-tinted gradient hairline centred on the content column — turns the
    // plain 1px top border into a deliberate, on-brand divider.
    footTopAccent: {
      position: 'absolute',
      top: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'min(1180px, 92%)',
      height: 2,
      background: `linear-gradient(90deg, transparent, ${c.primary}, transparent)`,
      opacity: 0.55,
      pointerEvents: 'none',
    },
    footerInner: { position: 'relative', maxWidth: 1180, margin: '0 auto', padding: '0 32px' },
    footGrid: {
      display: 'grid',
      gridTemplateColumns: '1.6fr 1fr 1fr 1fr',
      gap: 40,
      marginBottom: 46,
    },
    footBrand: {},
    footBrandP: {
      fontSize: '0.88rem',
      color: c.textMuted,
      maxWidth: 270,
      lineHeight: 1.6,
      margin: '14px 0 0',
    },
    footCol: {},
    footColH: {
      fontFamily: fonts.mono,
      fontSize: '0.72rem',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: c.textSubtle,
      marginBottom: 16,
      fontWeight: 600,
    },
    footLink: {
      display: 'block',
      fontSize: '0.9rem',
      color: c.textMuted,
      marginBottom: 11,
      textDecoration: 'none',
      cursor: 'pointer',
    },
    footBottom: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap',
      paddingTop: 26,
      borderTop: `1px solid ${c.border}`,
      fontFamily: fonts.mono,
      fontSize: '0.75rem',
      color: c.textSubtle,
    },
  } satisfies Record<string, React.CSSProperties>;

  return styles as Record<keyof typeof styles, React.CSSProperties>;
};

export type LandingStyles = ReturnType<typeof getLandingStyles>;
