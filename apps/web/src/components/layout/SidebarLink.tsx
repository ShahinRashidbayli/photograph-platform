'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { UPGRADE_HREF } from '@/lib/plan-gate';
import { getColors, type Theme } from '@/lib/design-tokens';
import type { NavLeaf } from '@/lib/nav';
import { NavIcon } from './NavIcon';

export function SidebarLink({
  item,
  active,
  theme,
  lockedBehind = null,
  badgeCount,
}: {
  item: NavLeaf;
  active: boolean;
  theme: string;
  /** Plan that would unlock this row, when the current plan does not. */
  lockedBehind?: string | null;
  // Optional unread-style count. Rendered as a small pill on the right of
  // the row — null/0 collapses the pill so the row stays clean when there's
  // nothing to flag.
  badgeCount?: number | null;
}) {
  const { t } = useTranslation();
  // "Not built" outranks "not on your plan". Both say the row cannot be used,
  // but only one of them is something the photographer could do anything
  // about, and offering an upgrade to reach a page that does not exist is the
  // worse of the two answers.
  const soon = Boolean(item.soon);
  const locked = !soon && Boolean(lockedBehind);
  const c = getColors(theme as Theme);
  const showBadge = typeof badgeCount === 'number' && badgeCount > 0;
  return (
    <Link
      href={locked ? UPGRADE_HREF : item.href}
      title={
        soon
          ? t('common.comingSoon')
          : locked
            ? t('upgrade.navLocked', { plan: lockedBehind as string })
            : undefined
      }
      // Hover lives in globals.css so it is gated on a hover-capable pointer;
      // the old mouseenter handler left a row lit after a tap on a phone.
      className={active ? undefined : 'ui-row-hover'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        minHeight: 34,
        padding: '0 10px',
        marginBottom: '1px',
        borderRadius: '8px',
        color: active ? c.text : c.textMuted,
        opacity: locked || soon ? 0.55 : 1,
        background: active ? c.primaryBg : 'transparent',
        textDecoration: 'none',
        fontWeight: active ? 550 : 450,
        fontSize: '0.875rem',
        letterSpacing: '-0.005em',
        transition: 'background-color 120ms ease-out, color 120ms ease-out',
        cursor: 'pointer',
        ['--ui-row-hover' as string]: c.surfaceHover,
      }}
      aria-current={active ? 'page' : undefined}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: active ? c.text : c.textSubtle,
        }}
      >
        <NavIcon name={item.icon} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>{t(item.labelKey)}</span>
      {/* "Not built" and "not on your plan" are both quiet text, not chips: a
          sidebar of six outlined pills out-shouted the active row and the
          work the photographer came here to do. The dimmed row already says
          "unavailable"; the word only says why. */}
      {soon && (
        <span
          aria-label={t('common.comingSoon')}
          style={{
            color: c.textSubtle,
            fontSize: '0.6875rem',
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          {t('common.soon')}
        </span>
      )}
      {locked && (
        <span
          aria-label={t('upgrade.navLocked', { plan: lockedBehind as string })}
          style={{
            padding: '0 6px',
            borderRadius: '4px',
            border: `1px solid ${c.border}`,
            color: c.textMuted,
            fontSize: '0.625rem',
            fontWeight: 600,
            letterSpacing: '0.02em',
            lineHeight: '16px',
          }}
        >
          {lockedBehind}
        </span>
      )}
      {showBadge && (
        <span
          aria-label={t('nav.aria.badgeUnread', { count: badgeCount })}
          data-numeric
          style={{
            minWidth: '18px',
            height: '18px',
            padding: '0 5px',
            borderRadius: '999px',
            background: c.primarySolid,
            color: c.onPrimary,
            fontSize: '0.6875rem',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
    </Link>
  );
}

/**
 * Section header for sidebar groups (Content / Analytics). Skipped
 * when the group has no title — the first group is the untitled "primary
 * pages" cluster which renders without a header for visual lightness.
 */
export function SidebarSectionHeader({
  title,
  colors,
}: {
  title: string;
  colors: { subText: string };
}) {
  return (
    <div
      style={{
        padding: '18px 10px 6px',
        fontSize: '0.75rem',
        fontWeight: 500,
        color: colors.subText,
      }}
    >
      {title}
    </div>
  );
}
