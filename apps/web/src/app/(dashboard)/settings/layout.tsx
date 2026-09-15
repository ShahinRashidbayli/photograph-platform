'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useIsPhotographer } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { getColors } from '@/lib/design-tokens';
import { useTranslation } from '@/lib/i18n';
import { useEntitlements } from '@/hooks/useEntitlements';
import { isAtLeast } from '@/lib/plan-gate';
import { RouteSlot } from '@/components/layout/RouteSlot';
import { SETTINGS_TABS } from './settings-nav';

/**
 * The frame every settings panel shares: title, tab strip, and the page's
 * width.
 *
 * <p>Owning the heading here rather than in each panel is the point — six
 * copies of an `<h1>` is how the panels start drifting apart in type scale and
 * spacing. Each page below renders only its own content.
 *
 * <p>The tabs are links, not local state, so every panel is addressable,
 * survives a reload, and works with the back button. That is what let the
 * upgrade prompts stop pointing at a `#fragment` and start pointing at
 * `/settings/plan`.
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const c = useMemo(() => getColors(theme), [theme]);
  const isPhotographer = useIsPhotographer();
  const pathname = usePathname();

  const { entitlements } = useEntitlements();
  const tabs = SETTINGS_TABS.filter((tab) => isPhotographer || !tab.photographerOnly);

  // Only once the plan is actually known — `entitlements` is undefined until
  // the query lands, and badging a Studio photographer's own Team tab for a
  // frame is worse than badging it a moment late.
  const lockFor = (tab: (typeof SETTINGS_TABS)[number]) =>
    tab.requiresPlan && entitlements && !isAtLeast(entitlements.plan, tab.requiresPlan)
      ? tab.requiresPlan
      : null;

  return (
    <div
      style={{
        padding: '28px 28px 40px',
        maxWidth: '860px',
        margin: '0 auto',
        fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: c.text,
      }}
    >
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: c.text, marginBottom: '6px' }}>
        {t('settings.title')}
      </h1>
      <p style={{ fontSize: '0.95rem', color: c.textMuted, marginBottom: '22px' }}>
        {isPhotographer ? t('settings.subtitle.photographer') : t('settings.subtitle.client')}
      </p>

      {/* A single tab is not a choice, so a client — who only has Account —
          gets no strip at all rather than a control that does nothing. */}
      {tabs.length > 1 && (
        <nav
          aria-label={t('settings.tab.aria')}
          style={{
            display: 'flex',
            gap: '2px',
            marginBottom: '26px',
            borderBottom: `1px solid ${c.border}`,
            // The strip scrolls rather than wrapping: a second row of tabs
            // reads as a second level of navigation, which it is not.
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            const locked = lockFor(tab);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                title={locked ? t('upgrade.navLocked', { plan: locked }) : undefined}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 14px',
                  fontSize: '0.9rem',
                  fontWeight: active ? 700 : 500,
                  color: active ? c.text : c.textMuted,
                  opacity: locked ? 0.62 : 1,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  borderBottom: `2px solid ${active ? c.primarySolid : 'transparent'}`,
                  marginBottom: '-1px',
                  transition: 'color 0.15s ease',
                }}
              >
                {t(tab.labelKey)}
                {/* Same badge the sidebar uses for Revenue and Reports, so a
                    locked thing looks locked in both places. */}
                {locked && (
                  <span
                    aria-label={t('upgrade.navLocked', { plan: locked })}
                    style={{
                      padding: '1px 6px',
                      borderRadius: '999px',
                      border: `1px solid ${c.textMuted}`,
                      fontSize: '0.58rem',
                      fontWeight: 800,
                      letterSpacing: '0.06em',
                    }}
                  >
                    {locked}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      )}

      <RouteSlot>{children}</RouteSlot>
    </div>
  );
}
