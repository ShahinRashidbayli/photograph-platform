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

export const getColors = (theme: Theme) => {
  const isDark = theme === 'dark';
  return {
    isDark,

    // ─── Surfaces & ink ────────────────────────────────────────
    bg: isDark ? '#0B1220' : '#F7F8FB',
    surface: isDark ? '#111A2E' : '#FFFFFF',
    surfaceAlt: isDark ? '#0F1729' : '#F8FAFC',
    surfaceHover: isDark ? '#172238' : '#F8FAFC',
    surfaceActive: isDark ? 'rgba(59, 130, 246, 0.12)' : '#EFF6FF',

    text: isDark ? '#F1F5F9' : '#0F172A',
    // textMuted — body-level secondary text. AA-compliant in both modes.
    textMuted: isDark ? '#94A3B8' : '#64748B',
    // textSubtle — low-emphasis text (meta, eyebrows, placeholders). Bumped
    // to clear WCAG AA for normal text: #6B7280 ≈ 4.8:1 on white.
    textSubtle: isDark ? '#94A3B8' : '#6B7280',

    border: isDark ? '#1F2A44' : '#E5E7EB',
    borderSoft: isDark ? '#172238' : '#F1F5F9',
    borderActive: isDark ? 'rgba(59, 130, 246, 0.45)' : '#BFDBFE',
    divider: isDark ? '#1F2A44' : '#F1F5F9',

    // ─── Primary (interactive / CTA — blue-600) ────────────────
    primary: '#2563EB',
    primaryStrong: isDark ? '#3B82F6' : '#1D4ED8',
    primaryBg: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF',
    primaryText: isDark ? '#93C5FD' : '#1D4ED8',
    primaryBorder: isDark ? 'rgba(59, 130, 246, 0.35)' : '#BFDBFE',
    primarySolid: '#2563EB',
    primarySolidHover: isDark ? '#3B82F6' : '#1D4ED8',

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

    // ─── Info (completed / archived — indigo-700) ──────────────
    info: isDark ? '#A5B4FC' : '#4338CA',
    infoBg: isDark ? 'rgba(99, 102, 241, 0.20)' : '#EEF2FF',
    infoText: isDark ? '#A5B4FC' : '#4338CA',
    infoBorder: isDark ? 'rgba(99, 102, 241, 0.40)' : '#C7D2FE',

    // ─── Neutral (indeterminate / low emphasis — slate-500) ────
    neutral: isDark ? '#94A3B8' : '#64748B',
    neutralBg: isDark ? 'rgba(148, 163, 184, 0.12)' : '#F1F5F9',
    neutralText: isDark ? '#CBD5E1' : '#475569',
    neutralBorder: isDark ? 'rgba(148, 163, 184, 0.28)' : '#E2E8F0',

    // ─── Shadows ───────────────────────────────────────────────
    overlayShadow: isDark
      ? '0 1px 2px rgba(0, 0, 0, 0.4)'
      : '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.04)',
    elevatedShadow: isDark
      ? '0 8px 24px rgba(0, 0, 0, 0.45)'
      : '0 8px 24px rgba(15, 23, 42, 0.06)',
  };
};

export type AppColors = ReturnType<typeof getColors>;
