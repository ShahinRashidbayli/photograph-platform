'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AuthUser, useIsPhotographer } from '@/store/authStore';
import { useTranslation } from '@/lib/i18n';
import { FotolioLogo } from '@/components/FotolioLogo';
import { LanguageToggle } from '@/components/LanguageToggle';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UserAvatar } from '@/components/UserAvatar';
import { NotificationPanel } from './NotificationPanel';
import type { AttentionItem } from '@/hooks/useAttention';

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
    shadowRaised: string;
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
        padding: '12px 20px',
        background: colors.headerBg,
        borderBottom: `1px solid ${colors.border}`,
        boxShadow: colors.shadowRaised,
        transition: 'background 0.3s ease, border-color 0.3s ease',
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
        {/* Fotolio Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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
                transition: 'background 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.text,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.surfaceHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
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
                    background: '#DC2626',
                    color: '#fff',
                    fontSize: '0.62rem',
                    fontWeight: 700,
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
              background: theme === 'light' ? '#6366F1' : '#818CF8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.8rem',
              flexShrink: 0,
              cursor: 'pointer',
              transition: 'background 0.3s ease',
            }}
            title={user?.fullName ?? 'User'}
          >
            <UserAvatar
              name={user?.fullName ?? user?.email ?? 'U'}
              src={user?.avatarUrl}
              size={36}
              background="transparent"
              color="#fff"
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
                      fontSize: '0.7rem',
                      color: colors.subText,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      marginTop: '2px',
                    }}
                  >
                    {t('nav.plan', { plan: user.tenant.plan })}
                  </div>
                )}
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
