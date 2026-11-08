'use client';

import { getColors, type Theme } from '@/lib/design-tokens';
import { useTranslation } from '@/lib/i18n';
import type { NavMode } from '@/lib/nav';

const LABEL_KEY = {
  workspace: 'nav.mode.workspace',
  community: 'nav.mode.community',
} as const;

/**
 * The switch between the two halves of the product.
 *
 * <h2>Why a switch and not more rows</h2>
 * Community started as a group heading, which was right while it held one row.
 * At four it made sixteen rows and three headings, and the sidebar overflowed
 * a 13" laptop — Revenue and Reports fell below the fold, which is the point
 * at which a navigation stops being a map and becomes a list you scroll.
 *
 * <p>The split is not arbitrary tidying. One half is first person — your
 * bookings, your clients, your portfolio, all of it data this tenant owns. The
 * other is third person — locations, studios and teaching that belong to other
 * photographers. Those are different questions, and you are almost never
 * asking both at once, so showing both at once costs height and buys nothing.
 *
 * <p>Switching is not navigation. It changes which list the sidebar shows and
 * leaves the page alone: someone half-way through a booking can look up what a
 * studio charges without losing what they were doing. The route only moves the
 * switch when they actually go somewhere — see the shell.
 */
export function SidebarModeSwitch({
  modes,
  active,
  onChange,
  theme,
}: {
  modes: readonly NavMode[];
  active: NavMode;
  onChange: (_mode: NavMode) => void;
  theme: string;
}) {
  const { t } = useTranslation();
  const c = getColors(theme as Theme);

  return (
    <div
      role="tablist"
      aria-label={t('nav.mode.aria')}
      style={{
        display: 'flex',
        gap: '3px',
        padding: '3px',
        margin: '0 2px 12px',
        // Light mode: a sunken track with the selected tab raised out of it.
        // Dark mode cannot sink below a near-black sidebar, and the light-mode
        // fill is *lighter* than `surface` there — the track would read as
        // raised and the selected tab as a hole — so it falls back to a
        // bordered track with the selected tab filled.
        background: c.isDark ? 'transparent' : c.surfaceActive,
        border: c.isDark ? `1px solid ${c.border}` : '1px solid transparent',
        borderRadius: '9px',
      }}
    >
      {modes.map((mode) => {
        const selected = mode === active;
        return (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(mode)}
            style={{
              flex: 1,
              padding: '6px 4px',
              border: 'none',
              borderRadius: '8px',
              // The same tinted pill the active nav row uses, for the same
              // reason: one way of saying "you are here" per sidebar.
              background: selected ? (c.isDark ? c.surfaceActive : c.surface) : 'transparent',
              boxShadow: selected && !c.isDark ? c.shadowRaised : 'none',
              color: selected ? c.text : c.textMuted,
              fontSize: '0.75rem',
              fontWeight: selected ? 550 : 450,
              cursor: 'pointer',
              transition: 'background-color 120ms ease-out, color 120ms ease-out',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {t(LABEL_KEY[mode])}
          </button>
        );
      })}
    </div>
  );
}
