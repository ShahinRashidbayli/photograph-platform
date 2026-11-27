'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { AuthUser, useIsPhotographer } from '@/store/authStore';
import { useTranslation, type TranslationKey } from '@/lib/i18n';
import { FotolioLogo } from '@/components/FotolioLogo';
import { LanguageToggle } from '@/components/LanguageToggle';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UserAvatar } from '@/components/UserAvatar';
import { NotificationPanel } from './NotificationPanel';
import type { AttentionItem } from '@/hooks/useAttention';
import { useThemeStore, type ThemePreference } from '@/store/themeStore';

const APPEARANCE: { value: ThemePreference; labelKey: TranslationKey }[] = [
  { value: 'light', labelKey: 'chrome.appearance.light' },
  { value: 'dark', labelKey: 'chrome.appearance.dark' },
  { value: 'system', labelKey: 'chrome.appearance.system' },
];

export function DashboardHeader({
  user,
  theme,
  handleLogout,
  colors,
  isOpen,
  setIsOpen,
  attentionCount,
  attention,
  onAttentionHandled,
}: {
  user: AuthUser | null;
  theme: 'light' | 'dark';
  handleLogout: () => void;
  colors: {
    headerBg: string;
    border: string;
    text: string;
    subText: string;
    cardBg: string;
    surfaceHover: string;
    surfaceActive: string;
    danger: string;
    shadowPopover: string;
  };
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  // Same value the sidebar Leads badge consumes — un-replied leads + pending
  // inquiries. When > 0 the bell shows a numbered red badge. Clicking it
  // navigates to /leads, where those items are acted on. A real notifications
  // stack (announcements, payment events, gallery views) lives in v2.0+; until
  // then this gives the bell semantic weight without inventing fake content.
  attentionCount: number | null;
  /** The items behind the count, or null until the first fetch lands. */
  attention: AttentionItem[] | null;
  /** Called after one is acted on, so the list refetches. */
  onAttentionHandled: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const isPhotographer = useIsPhotographer();
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  const appearanceLabelId = useId();
  const { t, tPlural } = useTranslation();
  const hasAlerts = (attentionCount ?? 0) > 0;
  const count = attentionCount ?? 0;
  const bellLabel = hasAlerts
    ? tPlural('chrome.notifications.alert', count)
    : t('chrome.notifications.none');
  const bellTitle = hasAlerts
    ? tPlural('chrome.notifications.open', count)
    : t('chrome.notifications.none');

  // Close the menu and return focus to the avatar trigger so keyboard
  // users aren't stranded.
  const closeMenu = () => {
    setMenuOpen(false);
    avatarRef.current?.focus();
  };

  useEffect(() => {
    if (!bellOpen) return;
    const onClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBellOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [bellOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [menuOpen]);

  return (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        // Fixed, border included, to match the sidebar's brand row — the two
        // only read as one band if they are the same height to the pixel.
        // No shadow: it would bleed past the sidebar's border where they meet.
        height: 60,
        flexShrink: 0,
        padding: '0 20px',
        background: colors.headerBg,
        borderBottom: `1px solid ${colors.border}`,
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
      role="banner"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        <button
          className="mobile-menu-btn"
          onClick={() => setIsOpen((v) => !v)}
          aria-label={isOpen ? t('chrome.closeMenu') : t('chrome.openMenu')}
          style={{
            width: 34,
            height: 34,
            borderRadius: '8px',
            border: `1px solid ${colors.border}`,
            background: colors.cardBg,
            color: colors.text,
            cursor: 'pointer',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        {/* Fotolio Logo — mobile only; on desktop the sidebar carries it.
            Display is left to the .header-logo rule in the dashboard layout,
            since an inline display would override it. */}
        <div className="header-logo">
          <FotolioLogo theme={theme} showText={true} />
        </div>
      </div>

      <div
        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        role="navigation"
        aria-label={t('chrome.aria.account')}
      >
        {/* Notifications bell — photographer-only, since its only "notification"
            today is the leads inbox (new leads + pending inquiries) and it
            navigates to /leads, a page customers can't open. When a real
            notifications stack lands this becomes a popover; the entry point
            stays the same so users don't re-learn it. */}
        {isPhotographer && (
          <div ref={bellRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setBellOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={bellOpen}
              aria-label={bellLabel}
              title={bellTitle}
              style={{
                width: 34,
                height: 34,
                position: 'relative',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                borderRadius: '8px',
                transition: 'background-color 120ms ease-out',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.text,
                ['--ui-row-hover' as string]: colors.surfaceHover,
              }}
              className="ui-row-hover"
            >
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
              {hasAlerts && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: -1,
                    right: -1,
                    minWidth: 16,
                    height: 16,
                    padding: '0 4px',
                    borderRadius: 999,
                    background: colors.danger,
                    color: '#fff',
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    lineHeight: '16px',
                    textAlign: 'center',
                    border: `2px solid ${colors.headerBg}`,
                    boxSizing: 'content-box',
                  }}
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
            {bellOpen && (
              <NotificationPanel
                items={attention}
                colors={colors}
                theme={theme}
                onClose={() => setBellOpen(false)}
                onHandled={onAttentionHandled}
              />
            )}
          </div>
        )}

        <LanguageToggle variant="bare" />

        <ThemeToggle variant="bare" />

        {/* User menu — avatar opens a dropdown holding the account actions. */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            ref={avatarRef}
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={t('chrome.accountMenu')}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: 'none',
              padding: 0,
              background: colors.surfaceActive,
              boxShadow: `inset 0 0 0 1px ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.text,
              fontWeight: 600,
              fontSize: '0.75rem',
              flexShrink: 0,
              cursor: 'pointer',
            }}
            title={user?.fullName ?? 'User'}
          >
            <UserAvatar
              name={user?.fullName ?? user?.email ?? 'U'}
              src={user?.avatarUrl}
              size={32}
              background="transparent"
              color={colors.text}
            />
          </button>

          {menuOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 8px)',
                minWidth: 220,
                background: colors.cardBg,
                border: `1px solid ${colors.border}`,
                borderRadius: '12px',
                boxShadow: colors.shadowPopover,
                padding: '6px',
                zIndex: 60,
              }}
            >
              <div
                style={{
                  padding: '8px 10px 10px',
                  borderBottom: `1px solid ${colors.border}`,
                  marginBottom: '4px',
                }}
              >
                <div
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: colors.text,
                    lineHeight: 1.3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {user?.fullName ?? user?.email}
                </div>
                {isPhotographer && user?.tenant?.plan && (
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: colors.subText,
                      fontWeight: 600,
                      marginTop: '2px',
                    }}
                  >
                    {t('nav.plan', { plan: user.tenant.plan })}
                  </div>
                )}
              </div>
              {/* Appearance — the only way back to following the system once
                  a toggle has made an explicit choice. Choosing keeps the menu
                  open so the change can be seen. */}
              <div
                role="group"
                aria-labelledby={appearanceLabelId}
                style={{
                  padding: '6px 10px 10px',
                  borderBottom: `1px solid ${colors.border}`,
                  marginBottom: '4px',
                }}
              >
                <div
                  id={appearanceLabelId}
                  style={{ fontSize: '0.75rem', color: colors.subText, marginBottom: '6px' }}
                >
                  {t('chrome.appearance.label')}
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 2,
                    padding: 2,
                    borderRadius: '8px',
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  {APPEARANCE.map((o) => {
                    const checked = preference === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={checked}
                        onClick={() => setPreference(o.value)}
                        className="ui-row-hover"
                        style={{
                          flex: 1,
                          padding: '5px 6px',
                          borderRadius: '6px',
                          border: 'none',
                          fontSize: '0.8rem',
                          fontWeight: checked ? 600 : 500,
                          color: checked ? colors.text : colors.subText,
                          background: checked ? colors.surfaceActive : 'transparent',
                          cursor: 'pointer',
                          ['--ui-row-hover' as string]: checked
                            ? colors.surfaceActive
                            : colors.surfaceHover,
                        }}
                      >
                        {t(o.labelKey)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Link
                href="/settings"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                style={{
                  display: 'block',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  color: colors.text,
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.surfaceHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {t('chrome.settings')}
              </Link>
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  handleLogout();
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  color: colors.text,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.surfaceHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {t('chrome.signOut')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
