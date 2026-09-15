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
  colors,
  lockedBehind = null,
  badgeCount,
}: {
  item: NavLeaf;
  active: boolean;
  theme: string;
  colors: { text: string; subText: string; primary: string };
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
  const activeColor = theme === 'light' ? '#EEF2FF' : 'rgba(99, 102, 241, 0.14)';
  const hoverColor = theme === 'light' ? '#F8FAFC' : '#1C1C22';
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
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 12px',
        marginBottom: '5px',
        borderRadius: '8px',
        color: active ? colors.text : colors.subText,
        opacity: locked || soon ? 0.62 : 1,
        background: active ? activeColor : 'transparent',
        textDecoration: 'none',
        fontWeight: active ? 700 : 500,
        fontSize: '0.9rem',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        borderLeft: active ? `3px solid ${colors.primary}` : '3px solid transparent',
      }}
      onMouseEnter={(e) => !active && (e.currentTarget.style.background = hoverColor)}
      onMouseLeave={(e) => !active && (e.currentTarget.style.background = 'transparent')}
      aria-current={active ? 'page' : undefined}
    >
      <span
        style={{
          opacity: active ? 1 : 0.65,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: active ? colors.primary : colors.subText,
          transition: 'color 0.3s ease',
        }}
      >
        <NavIcon name={item.icon} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>{t(item.labelKey)}</span>
      {/* The same outline chip a plan lock uses, in the amber that means "not
          built" rather than "not on your plan" — the hue carries the
          difference, the shape carries the fact that neither row is usable
          yet. It is deliberately not the filled `ComingSoon` pill: that badge
          is built to catch the eye once on a landing page, and six filled
          amber blocks in a fifteen-row sidebar out-shouted both the active row
          and the work the photographer actually came here to do. */}
      {soon && (
        <span
          aria-label={t('common.comingSoon')}
          style={{
            padding: '1px 7px',
            borderRadius: '999px',
            border: `1px solid ${c.warningBorder}`,
            color: c.warningText,
            fontSize: '0.6rem',
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
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
            padding: '1px 7px',
            borderRadius: '999px',
            border: `1px solid ${colors.subText}`,
            color: colors.subText,
            fontSize: '0.6rem',
            fontWeight: 800,
            letterSpacing: '0.06em',
          }}
        >
          {lockedBehind}
        </span>
      )}
      {showBadge && (
        <span
          aria-label={t('nav.aria.badgeUnread', { count: badgeCount })}
          style={{
            minWidth: '20px',
            height: '18px',
            padding: '0 6px',
            borderRadius: '999px',
            background: colors.primary,
            color: '#fff',
            fontSize: '0.65rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            letterSpacing: '0.02em',
          }}
        >
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
    </Link>
  );
}

/**
 * Uppercase section header for sidebar groups (Content / Analytics). Skipped
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
        padding: '16px 12px 7px',
        fontSize: '0.65rem',
        fontWeight: 700,
        color: colors.subText,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}
    >
      {title}
    </div>
  );
}
