/**
 * Design tokens — single source of truth for colors across the dashboard.
 *
 * Semantic tone guide (use the right tone for the right meaning, not the colour):
 *   primary  — interactive surfaces, CTA buttons, focused inputs (BLUE)
 *   success  — positive outcomes, confirmed/paid states, healthy metrics (GREEN)
 *   warning  — action required from the user (overdue, pending payment) (AMBER)
 *              Do NOT use for "unknown / not yet decided" — use neutral instead.
 *   danger   — destructive actions, errors, cancelled / failed states (RED)
 *   info     — completed / archived terminal states distinct from "success"
 *              (which signals a positive outcome of an *active* flow) (INDIGO)
 *   neutral  — indeterminate states, low-emphasis chips, dividers (SLATE)
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
  control: '10px',
  card: '14px',
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
 * `--font-inter` and `--font-cormorant` are defined by `next/font` in the root
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
  sans: 'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  serif:
    'var(--font-cormorant), "Cormorant Garamond", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, "SF Mono", "Cascadia Code", "Roboto Mono", Menlo, Consolas, monospace',
} as const;

export const getColors = (theme: Theme) => {
  const isDark = theme === 'dark';
  return {
    isDark,

    // ─── Surfaces & ink ────────────────────────────────────────
    // Dark mode uses a neutral charcoal ramp (not blue-navy) so the violet
    // accent reads as the single source of colour on the page.
    bg: isDark ? '#0A0A0C' : '#F7F8FB',
    surface: isDark ? '#141418' : '#FFFFFF',
    surfaceAlt: isDark ? '#101014' : '#F8FAFC',
    surfaceHover: isDark ? '#1C1C22' : '#F8FAFC',
    surfaceActive: isDark ? 'rgba(99, 102, 241, 0.14)' : '#EEF2FF',

    text: isDark ? '#F4F4F5' : '#0F172A',
    // textMuted — body-level secondary text. AA-compliant in both modes.
    textMuted: isDark ? '#A1A1AA' : '#64748B',
    // textSubtle — low-emphasis text (meta, eyebrows, placeholders). Bumped
    // to clear WCAG AA for normal text: #6B7280 ≈ 4.8:1 on white.
    textSubtle: isDark ? '#A1A1AA' : '#6B7280',

    border: isDark ? '#26262E' : '#E5E7EB',
    borderSoft: isDark ? '#1C1C22' : '#F1F5F9',
    borderActive: isDark ? 'rgba(99, 102, 241, 0.45)' : '#C7D2FE',
    divider: isDark ? '#26262E' : '#F1F5F9',

    // ─── Primary (interactive / CTA — indigo/violet-500) ───────
    primary: '#6366F1',
    primaryStrong: isDark ? '#818CF8' : '#4F46E5',
    primaryBg: isDark ? 'rgba(99, 102, 241, 0.16)' : '#EEF2FF',
    primaryText: isDark ? '#A5B4FC' : '#4F46E5',
    primaryBorder: isDark ? 'rgba(99, 102, 241, 0.38)' : '#C7D2FE',
    primarySolid: '#6366F1',
    // A deepening sweep of the primary, for the one surface on a screen that
    // carries its headline figure. Kept as a token rather than written at the
    // call site because a gradient is the easiest thing in a design to end up
    // with four slightly different versions of, and because the direction has
    // to differ by theme: `primaryStrong` gets *lighter* in dark mode, so
    // reusing it here would run the sweep backwards on half the app's users.
    primaryGradient: isDark
      ? 'linear-gradient(135deg, #4F46E5 0%, #4338CA 55%, #3730A3 100%)'
      : 'linear-gradient(135deg, #6366F1 0%, #4F46E5 55%, #4338CA 100%)',
    primarySolidHover: isDark ? '#818CF8' : '#4F46E5',

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
    // Sky, kept distinct from the violet primary so "completed/archived"
    // terminal states don't read as an interactive/CTA colour.
    info: isDark ? '#7DD3FC' : '#0369A1',
    infoBg: isDark ? 'rgba(14, 165, 233, 0.18)' : '#E0F2FE',
    infoText: isDark ? '#7DD3FC' : '#0369A1',
    infoBorder: isDark ? 'rgba(14, 165, 233, 0.38)' : '#BAE6FD',

    // ─── Neutral (indeterminate / low emphasis — zinc-500) ─────
    neutral: isDark ? '#A1A1AA' : '#64748B',
    neutralBg: isDark ? 'rgba(161, 161, 170, 0.12)' : '#F1F5F9',
    neutralText: isDark ? '#D4D4D8' : '#475569',
    neutralBorder: isDark ? 'rgba(161, 161, 170, 0.26)' : '#E2E8F0',

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
      : '0 1px 2px rgba(15, 23, 42, 0.05), 0 2px 6px -2px rgba(15, 23, 42, 0.06)',
    shadowFloating: isDark
      ? '0 2px 4px rgba(0, 0, 0, 0.55), 0 10px 24px -8px rgba(0, 0, 0, 0.6)'
      : '0 2px 4px rgba(15, 23, 42, 0.05), 0 10px 24px -8px rgba(15, 23, 42, 0.12)',
    shadowPopover: isDark
      ? '0 4px 8px rgba(0, 0, 0, 0.6), 0 16px 40px -12px rgba(0, 0, 0, 0.7)'
      : '0 4px 8px rgba(15, 23, 42, 0.06), 0 16px 40px -12px rgba(15, 23, 42, 0.18)',
    shadowModal: isDark
      ? '0 8px 16px rgba(0, 0, 0, 0.65), 0 32px 72px -20px rgba(0, 0, 0, 0.8)'
      : '0 8px 16px rgba(15, 23, 42, 0.08), 0 32px 72px -20px rgba(15, 23, 42, 0.26)',

    // The two names the app already used, now pointing at ramp steps so every
    // existing surface picks up the two-layer treatment without being edited.
    // Prefer the ramp names above in new code; these stay because renaming 40
    // call sites would be a change with no visible result.
    overlayShadow: isDark
      ? '0 1px 2px rgba(0, 0, 0, 0.5), 0 2px 6px -2px rgba(0, 0, 0, 0.45)'
      : '0 1px 2px rgba(15, 23, 42, 0.05), 0 2px 6px -2px rgba(15, 23, 42, 0.06)',
    elevatedShadow: isDark
      ? '0 2px 4px rgba(0, 0, 0, 0.55), 0 10px 24px -8px rgba(0, 0, 0, 0.6)'
      : '0 2px 4px rgba(15, 23, 42, 0.05), 0 10px 24px -8px rgba(15, 23, 42, 0.12)',
  };
};

export type AppColors = ReturnType<typeof getColors>;
