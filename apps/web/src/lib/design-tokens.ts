/**
 * Design tokens — single source of truth for colors across the dashboard.
 *
 * Semantic tone guide (use the right tone for the right meaning, not the colour):
 *   primary  — interactive surfaces, CTA buttons, focused inputs (INK)
 *   success  — positive outcomes, confirmed/paid states, healthy metrics (GREEN)
 *   warning  — action required from the user (overdue, pending payment) (AMBER)
 *              Do NOT use for "unknown / not yet decided" — use neutral instead.
 *   danger   — destructive actions, errors, cancelled / failed states (RED)
 *   info     — completed / archived terminal states distinct from "success"
 *              (which signals a positive outcome of an *active* flow) (INDIGO)
 *   neutral  — indeterminate states, low-emphasis chips, dividers (STONE)
 *
 * Each tone exposes 4 variants:
 *   <tone>        — solid hue (used for dots, icons, focus rings)
 *   <tone>Bg      — soft tinted background (badges, surface highlights)
 *   <tone>Text    — accessible text color on top of <tone>Bg (WCAG AA+)
 *   <tone>Border  — subtle outline matching the bg tint
 *
 * Light/dark variants are paired so contrast stays AA in both modes:
 *  - Light mode uses Tailwind 600-700 for ink, 100 for tints.
 *  - Dark mode uses 300-400 for ink, low-opacity overlays for tints.
 */

export type Theme = 'light' | 'dark';

/**
 * Typography scale — a single 7-step ramp. Use a semantic step, never a
 * raw px/rem value, so hierarchy stays consistent across every page.
 *   xs      — micro labels, uppercase eyebrows
 *   sm      — meta text, badges, captions
 *   base    — secondary body text
 *   md      — primary body text, inputs, buttons
 *   lg      — card titles, section headings
 *   xl      — panel / page sub-headings
 *   display — page titles
 */
export const fontSize = {
  xs: '11px',
  sm: '12px',
  base: '13px',
  md: '14px',
  lg: '16px',
  xl: '20px',
  display: '30px',
} as const;

/**
 * Spacing scale — a 4px base ramp. Every gap, padding and margin should land
 * on a step: ad-hoc values (5px here, 7px there, 18px somewhere else) are what
 * make an interface read as "slightly off" without the eye being able to name
 * why. Use `space.x` rather than a raw number for anything structural.
 */
export const space = {
  xxs: '2px',
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  xxl: '24px',
  xxxl: '32px',
} as const;

/**
 * Line heights, paired with the type ramp: `tight` for headings and numbers,
 * `snug` for compact meta rows, `normal` for prose that has to be read.
 */
export const leading = {
  tight: 1.15,
  snug: 1.35,
  normal: 1.55,
} as const;

/**
 * Border-radius scale — interactive controls vs. surfaces vs. pills.
 *   control — buttons, inputs, small interactive chrome
 *   card    — cards, panels, modals
 *   pill    — badges, filter tabs, fully-rounded elements
 */
export const radius = {
  control: '8px',
  card: '12px',
  pill: '999px',
} as const;

/**
 * Font stacks. `sans` is the product/UI face used everywhere in the dashboard.
 * `serif` is an editorial *display* face reserved for marketing/brand surfaces
 * (the public landing page headings) — it gives the marketing site more
 * personality without touching the dense, sans-first dashboard UI. `mono` is
 * for data-ish labels, eyebrows and numeric chips.
 *
 * All three are system-font stacks (no webfont fetch), so there is no network
 * request, no layout shift and no license to manage.
 */
/**
 * The two families the app actually loads, plus a mono stack.
 *
 * `--font-sans` (Geist) and `--font-serif` (Instrument Serif) are defined by `next/font` in the root
 * layout, which means they were downloaded on every page — and then used only
 * by the dashboard and the public portfolio, which referenced the CSS variables
 * directly. Everything reading these tokens (the landing page, every auth
 * screen) got a pure system stack instead, so the same product rendered in
 * different typefaces depending on which screen you were on, and the auth
 * headings in particular resolved to Iowan on macOS, Palatino on Windows and
 * Georgia on Android.
 *
 * Referencing the variables here makes the tokens describe what is actually
 * loaded. The system fallbacks stay behind them for the first paint and for
 * anything that renders outside the layout's variable scope.
 */
export const fonts = {
  sans: 'var(--font-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  serif:
    'var(--font-serif), "Instrument Serif", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, "SF Mono", "Cascadia Code", "Roboto Mono", Menlo, Consolas, monospace',
} as const;

/**
 * The page title every dashboard screen opens with. One definition, because
 * seventeen screens each restating "1.6rem / 800" is how a type scale drifts:
 * they had settled on four different sizes between them.
 *
 * Set in the UI's own face (Geist), tight and semibold. It was a display
 * serif until 2026-11: beside a sans interface it read as a different product
 * stitched on top of each screen. The serif now lives only on the studio's
 * public portfolio, which is the photographer's site rather than the app.
 */
export const pageTitle = {
  fontFamily: fonts.sans,
  fontSize: '1.875rem',
  fontWeight: 600,
  letterSpacing: '-0.025em',
  lineHeight: 1.15,
  margin: '0 0 6px',
} as const;

export const getColors = (theme: Theme) => {
  const isDark = theme === 'dark';
  return {
    isDark,

    // ─── Surfaces & ink ────────────────────────────────────────
    // A warm graphite ramp, close to the paper and darkroom neutrals the
    // photographs on these screens are printed on, rather than the blue-grey
    // slate every UI kit ships. The interface is deliberately colourless: the
    // only saturated pixels on a gallery or a booking should be the
    // photographer's own pictures and the status colours below, which carry
    // meaning. Three neutral layers — page, sidebar (a step deeper, so the
    // chrome reads as frame and not as content) and surface.
    bg: isDark ? '#0E0E0D' : '#FAFAF9',
    sidebarBg: isDark ? '#0A0A09' : '#F4F3F1',
    surface: isDark ? '#161615' : '#FFFFFF',
    surfaceAlt: isDark ? '#121211' : '#F7F7F5',
    surfaceHover: isDark ? '#1E1E1C' : '#F3F2F0',
    surfaceActive: isDark ? '#252523' : '#ECEBE8',

    text: isDark ? '#F5F5F4' : '#1C1917',
    // textMuted — body-level secondary text. ≥7:1 on surface in both modes.
    textMuted: isDark ? '#A8A29E' : '#57534E',
    // textSubtle — meta, captions, placeholders. Still ≥4.5:1 on surface and
    // on the page background, measured, so it never needs a "large text" pass.
    textSubtle: isDark ? '#8C8681' : '#6F6964',

    border: isDark ? '#2A2927' : '#E7E5E2',
    borderSoft: isDark ? '#1F1F1D' : '#F0EFEC',
    borderActive: isDark ? '#57534E' : '#A8A29E',
    divider: isDark ? '#232321' : '#EFEEEB',

    // ─── Primary (interactive / CTA — ink) ─────────────────────
    // The brand mark is ink on paper, and so is the primary action: a filled
    // near-black button in light mode, a filled near-white one in dark mode.
    // That inversion is why `onPrimary` exists — text on a primary fill must
    // read it rather than assume white, which in dark mode was white-on-white.
    primary: isDark ? '#F5F5F4' : '#1C1917',
    primaryStrong: isDark ? '#FFFFFF' : '#0C0A09',
    // Selected rows, active tabs, the current nav item: a neutral tint, not a
    // brand wash, so "you are here" never competes with a status colour.
    primaryBg: isDark ? 'rgba(255, 255, 255, 0.07)' : '#EFEEEB',
    primaryText: isDark ? '#F5F5F4' : '#1C1917',
    primaryBorder: isDark ? 'rgba(255, 255, 255, 0.2)' : '#D6D3CF',
    primarySolid: isDark ? '#F5F5F4' : '#1C1917',
    onPrimary: isDark ? '#1C1917' : '#FFFFFF',
    // Kept as a token for the one surface on a screen that carries its
    // headline figure, but flat: a gradient is the first thing that makes a
    // product read as a template, and the figure is what should stand out.
    primaryGradient: isDark ? '#F5F5F4' : '#1C1917',
    primarySolidHover: isDark ? '#E7E5E4' : '#36322F',
    // Keyboard focus. Ink like the primary, drawn as an outline with an
    // offset so it reads on a primary fill as well as on a surface.
    focusRing: isDark ? '#F5F5F4' : '#1C1917',

    // ─── Success (positive outcome — green-600) ────────────────
    success: isDark ? '#34D399' : '#16A34A',
    successBg: isDark ? 'rgba(16, 185, 129, 0.18)' : '#DCFCE7',
    successText: isDark ? '#6EE7B7' : '#15803D',
    successBorder: isDark ? 'rgba(16, 185, 129, 0.32)' : '#BBF7D0',

    // ─── Warning (action required — amber-600) ─────────────────
    warning: isDark ? '#FBBF24' : '#D97706',
    warningBg: isDark ? 'rgba(217, 119, 6, 0.20)' : '#FEF3C7',
    warningText: isDark ? '#FCD34D' : '#92400E',
    warningBorder: isDark ? 'rgba(217, 119, 6, 0.40)' : '#FDE68A',

    // ─── Danger (destructive / cancelled — red-600) ────────────
    danger: isDark ? '#F87171' : '#DC2626',
    dangerBg: isDark ? 'rgba(220, 38, 38, 0.15)' : '#FEE2E2',
    dangerText: isDark ? '#FCA5A5' : '#B91C1C',
    dangerBorder: isDark ? 'rgba(220, 38, 38, 0.35)' : '#FECACA',

    // ─── Info (completed / archived — sky-600) ─────────────────
    // Sky: the one blue in the app, so "completed/archived" reads as a
    // settled state and never as something to click.
    info: isDark ? '#7DD3FC' : '#0369A1',
    infoBg: isDark ? 'rgba(14, 165, 233, 0.18)' : '#E0F2FE',
    infoText: isDark ? '#7DD3FC' : '#0369A1',
    infoBorder: isDark ? 'rgba(14, 165, 233, 0.38)' : '#BAE6FD',

    // ─── Neutral (indeterminate / low emphasis — stone-500) ────
    neutral: isDark ? '#A8A29E' : '#78716C',
    neutralBg: isDark ? 'rgba(168, 162, 158, 0.12)' : '#F1F0EE',
    neutralText: isDark ? '#D6D3D1' : '#57534E',
    neutralBorder: isDark ? 'rgba(168, 162, 158, 0.26)' : '#E2E0DD',

    // ─── Elevation ─────────────────────────────────────────────
    // A four-step ramp, not a set of one-off shadows. Every step is two
    // layers: a tight *contact* shadow that pins the element to the surface
    // under it, and a wide, soft *ambient* one that gives it height. A single
    // blurred layer is what makes a card read as a grey smudge rather than as
    // something lifted — the contact layer is the part the eye actually uses
    // to judge "this sits on top of that".
    //
    // The ramp is the whole point. Elevation only reads as depth when the
    // steps are ordered and few: sixteen hand-written `boxShadow` strings
    // across the app meant a dropdown could sit lower than the card it opened
    // from, and nothing in the code said that was wrong.
    //
    //   raised   — resting cards and panels, barely off the page
    //   floating — hover, and anything that lifts in response to a pointer
    //   popover  — dropdowns, menus, the notification panel
    //   modal    — dialogs over a scrim, the only step that should feel far
    //
    // Dark mode carries more of the weight in opacity than in spread: a large
    // black blur on a near-black surface is invisible, so the steps deepen
    // rather than widen.
    shadowRaised: isDark
      ? '0 1px 2px rgba(0, 0, 0, 0.5), 0 2px 6px -2px rgba(0, 0, 0, 0.45)'
      : '0 1px 2px rgba(28, 25, 23, 0.05), 0 2px 6px -2px rgba(28, 25, 23, 0.06)',
    shadowFloating: isDark
      ? '0 2px 4px rgba(0, 0, 0, 0.55), 0 10px 24px -8px rgba(0, 0, 0, 0.6)'
      : '0 2px 4px rgba(28, 25, 23, 0.05), 0 10px 24px -8px rgba(28, 25, 23, 0.12)',
    shadowPopover: isDark
      ? '0 4px 8px rgba(0, 0, 0, 0.6), 0 16px 40px -12px rgba(0, 0, 0, 0.7)'
      : '0 4px 8px rgba(28, 25, 23, 0.06), 0 16px 40px -12px rgba(28, 25, 23, 0.18)',
    shadowModal: isDark
      ? '0 8px 16px rgba(0, 0, 0, 0.65), 0 32px 72px -20px rgba(0, 0, 0, 0.8)'
      : '0 8px 16px rgba(28, 25, 23, 0.08), 0 32px 72px -20px rgba(28, 25, 23, 0.26)',

    // The two names the app already used, now pointing at ramp steps so every
    // existing surface picks up the two-layer treatment without being edited.
    // Prefer the ramp names above in new code; these stay because renaming 40
    // call sites would be a change with no visible result.
    overlayShadow: isDark
      ? '0 1px 2px rgba(0, 0, 0, 0.5), 0 2px 6px -2px rgba(0, 0, 0, 0.45)'
      : '0 1px 2px rgba(28, 25, 23, 0.05), 0 2px 6px -2px rgba(28, 25, 23, 0.06)',
    elevatedShadow: isDark
      ? '0 2px 4px rgba(0, 0, 0, 0.55), 0 10px 24px -8px rgba(0, 0, 0, 0.6)'
      : '0 2px 4px rgba(28, 25, 23, 0.05), 0 10px 24px -8px rgba(28, 25, 23, 0.12)',
  };
};

export type AppColors = ReturnType<typeof getColors>;
