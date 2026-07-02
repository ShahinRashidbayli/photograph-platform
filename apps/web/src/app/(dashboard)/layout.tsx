"use client";

import api from '@/lib/api';
import { AuthUser, useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { getColors } from '@/lib/design-tokens';
import { FotolioLogo } from '@/components/FotolioLogo';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

// Nav grouped into sections so the sidebar mirrors the mental model:
// daily-work pages first, content-management in the middle, analytics
// (revenue, reports) at the bottom. Each group renders with an uppercase
// section header for grouping signal without using horizontal dividers.
type NavLeaf = { label: string; href: string; icon: React.ReactNode; badgeKey?: 'unrepliedLeads' };
type NavGroup = { title?: string; items: NavLeaf[] };

const PHOTOGRAPHER_NAV: NavGroup[] = [
  {
    // Untitled first group — primary daily-work pages live here.
    items: [
      { label: 'Overview', href: '/dashboard', icon: (
        <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor"/><rect x="8" y="1" width="5" height="5" rx="1" fill="currentColor" opacity=".5"/><rect x="1" y="8" width="5" height="5" rx="1" fill="currentColor" opacity=".5"/><rect x="8" y="8" width="5" height="5" rx="1" fill="currentColor" opacity=".5"/></svg>
      )},
      { label: 'Bookings', href: '/bookings', icon: (
        <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><rect x="1" y="2.5" width="12" height="9.5" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M1 5.5h12" stroke="currentColor" strokeWidth="1.2"/><path d="M4.5 1v3M9.5 1v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
      )},
      // Leads carries a live count badge of un-replied leads — "you have N
      // enquiries waiting" surfaces from the sidebar without needing to
      // open the page first.
      { label: 'Leads', href: '/leads', badgeKey: 'unrepliedLeads', icon: (
        <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M2 11l3-3 2 2 3-4 2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      )},
      { label: 'Clients', href: '/clients', icon: (
        <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><circle cx="5.5" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.2"/><path d="M1 12c0-2.49 2.01-4.5 4.5-4.5S10 9.51 10 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M10 6.5l1.5 1.5L14 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      )},
    ],
  },
  {
    title: 'Content',
    items: [
      { label: 'Portfolio', href: '/portfolio', icon: (
        <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M3.5 4.5h7M3.5 7h5M3.5 9.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
      )},
      { label: 'Galleries', href: '/galleries', icon: (
        <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M2.5 12V6.5l4.5-4 4.5 4V12H9V9H5v3H2.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
      )},
    ],
  },
  {
    title: 'Analytics',
    items: [
      // Reports + Revenue are stubbed pages today — they render a "coming
      // soon" placeholder. The sidebar entries exist now to validate the
      // information architecture; the real implementations land in later
      // sprints (revenue analytics is Sprint 2.5 in the master plan).
      { label: 'Reports', href: '/reports', icon: (
        <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="1.5" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M4 10V7M7 10V5M10 10V8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
      )},
      { label: 'Revenue', href: '/revenue', icon: (
        <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M10.5 4c0-1.1-1.57-2-3.5-2s-3.5.9-3.5 2 1.57 2 3.5 2 3.5.9 3.5 2-1.57 2-3.5 2-3.5-.9-3.5-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      )},
    ],
  },
];

const CLIENT_NAV: NavGroup[] = [
  {
    items: [
      { label: 'My Bookings', href: '/bookings', icon: (
        <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><rect x="1" y="2.5" width="12" height="9.5" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M1 5.5h12" stroke="currentColor" strokeWidth="1.2"/><path d="M4.5 1v3M9.5 1v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
      )},
      { label: 'Galleries', href: '/galleries', icon: (
        <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M2.5 12V6.5l4.5-4 4.5 4V12H9V9H5v3H2.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
      )},
    ],
  },
];

function getInitials(name: string) {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return 'U';
  const parts = trimmed.split(/\s+/);
  return (parts[0]?.[0] ?? 'U') + (parts[1]?.[0] ?? '');
}

type NavItem = NavLeaf;

function SidebarLink({ item, active, theme, colors, badgeCount }: {
  item: NavItem;
  active: boolean;
  theme: string;
  colors: { text: string; subText: string; primary: string };
  // Optional unread-style count. Rendered as a small pill on the right of
  // the row — null/0 collapses the pill so the row stays clean when there's
  // nothing to flag.
  badgeCount?: number | null;
}) {
  const activeColor = theme === 'light' ? '#EFF6FF' : '#1E293B';
  const hoverColor = theme === 'light' ? '#F8FAFC' : '#334155';
  const showBadge = typeof badgeCount === 'number' && badgeCount > 0;
  return (
    <Link
      href={item.href}
      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', marginBottom: '4px', borderRadius: '8px', color: active ? colors.text : colors.subText, background: active ? activeColor : 'transparent', textDecoration: 'none', fontWeight: active ? 700 : 500, fontSize: '0.9rem', transition: 'all 0.2s ease', cursor: 'pointer', borderLeft: active ? '3px solid #2563EB' : '3px solid transparent' }}
      onMouseEnter={(e) => !active && (e.currentTarget.style.background = hoverColor)}
      onMouseLeave={(e) => !active && (e.currentTarget.style.background = 'transparent')}
      aria-current={active ? 'page' : undefined}
    >
      <span style={{ opacity: active ? 1 : 0.65, display: 'flex', alignItems: 'center', justifyContent: 'center', color: active ? colors.primary : colors.subText, transition: 'color 0.3s ease' }}>{item.icon}</span>
      <span style={{ flex: 1 }}>{item.label}</span>
      {showBadge && (
        <span
          aria-label={`${badgeCount} unread`}
          style={{
            minWidth: '20px',
            height: '18px',
            padding: '0 6px',
            borderRadius: '999px',
            background: '#2563EB',
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
function SidebarSectionHeader({ title, colors }: { title: string; colors: { subText: string } }) {
  return (
    <div
      style={{
        padding: '14px 12px 6px',
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

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setUser, clearUser } = useAuthStore();
  const [loading, setLoading] = useState(!user);
  const [isOpen, setIsOpen] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const { theme, toggleTheme } = useThemeStore();

  useEffect(() => {
    if (user) {
      setLoading(false);
      return;
    }
    if (loggingOut) {
      // Skip the /me fetch while a logout is in progress; cookies are gone.
      return;
    }
    // Fetch user if not in store (e.g., on page refresh)
    const fetchUser = async () => {
      try {
        const { data } = await api.get<AuthUser>('/api/auth/me');
        setUser(data);
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [user, setUser, router, loggingOut]);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!user?.role) return;

    const role = user.role.toUpperCase();
    const isPhotographer = role === 'PHOTOGRAPHER' || role === 'ADMIN';
    // Settings is shared — both roles manage their own account there.
    const photographerOnlyPages = ['/dashboard', '/leads', '/clients', '/portfolio', '/reports', '/revenue'];

    const isOnPhotographerPage = photographerOnlyPages.some(page => pathname === page || pathname.startsWith(page + '/'));

    // Customers cannot access photographer-only pages (redirect to /bookings)
    if (!isPhotographer && isOnPhotographerPage) {
      setAccessDenied(true);
      router.replace('/bookings');
    } else {
      setAccessDenied(false);
    }
  }, [pathname, user?.role, router]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Logout is best-effort: local auth state should still be cleared.
    } finally {
      // Navigate first so the dashboard layout unmounts before we clear the
      // user — otherwise the /api/auth/me effect refires against cleared
      // cookies and produces a spurious 401 in the console.
      router.replace('/login');
      clearUser();
    }
  }

  const role = user?.role?.toUpperCase();
  const isPhotographer = role === 'PHOTOGRAPHER' || role === 'ADMIN';
  const navItems = isPhotographer ? PHOTOGRAPHER_NAV : CLIENT_NAV;
  const [unrepliedLeads, setUnrepliedLeads] = useState<number | null>(null);

  // Sidebar badge: count of leads in NEW status (un-replied). Polled every
  // 60s — cheap and "good enough" for an inbox indicator without a websocket.
  // Failures are silent: an outage shouldn't make the badge flicker.
  useEffect(() => {
    if (!isPhotographer) return;
    let cancelled = false;
    const fetchCount = () => {
      api
        .get<Array<{ status: string }>>('/api/leads')
        .then((res) => {
          if (cancelled) return;
          const list = Array.isArray(res.data) ? res.data : [];
          setUnrepliedLeads(list.filter((l) => l.status === 'NEW').length);
        })
        .catch(() => {
          // Don't clobber a previously-known count on a transient error.
        });
    };
    fetchCount();
    const id = window.setInterval(fetchCount, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isPhotographer]);

  if (loading) {
    // Read the persisted theme directly so the loading screen doesn't flash
    // light before the theme store hydrates. zustand persists under
    // "theme-storage" as { state: { theme }, version }.
    //
    // This intentionally diverges between server (no window → default theme)
    // and client (reads localStorage). The mismatch is by design — the
    // alternative is a guaranteed white-flash on dark-mode users. We
    // suppress the hydration warning on the two affected nodes so React
    // doesn't surface what is *deliberately* server-different content.
    let isDark = theme === 'dark';
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('theme-storage');
        if (raw) isDark = JSON.parse(raw)?.state?.theme === 'dark';
      } catch {
        /* fall back to the store value */
      }
    }
    const lc = getColors(isDark ? 'dark' : 'light');
    return (
      <div
        suppressHydrationWarning
        style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: lc.bg }}
      >
        <div
          suppressHydrationWarning
          style={{ color: lc.text, fontSize: '0.95rem' }}
        >
          Loading dashboard...
        </div>
      </div>
    );
  }

  // Map a badgeKey on a NavLeaf to its concrete count. Easy to extend with
  // future badges (unread messages, expiring galleries, …) by adding cases.
  const badgeFor = (key?: 'unrepliedLeads'): number | null => {
    if (key === 'unrepliedLeads') return unrepliedLeads;
    return null;
  };

  const c = getColors(theme);
  const colors = {
    bg: c.bg,
    pageBg: c.bg,
    text: c.text,
    subText: c.textMuted,
    border: c.border,
    cardBg: c.surface,
    headerBg: c.surface,
    sidebarBg: c.surface,
    primary: c.primary,
    surfaceHover: c.surfaceHover,
  };

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text, transition: 'background 0.3s ease, color 0.3s ease' }}>
      {/* Global Styles */}
      <style>{`
        * { box-sizing: border-box; }
        a:focus-visible, button:focus-visible { outline: 2px solid #0284C7; outline-offset: 2px; }
        body { background: ${colors.bg}; color: ${colors.text}; }
        .mobile-menu-btn { display: none; }
        .mobile-overlay { display: none; }
        @media (max-width: 768px) {
          aside { position: fixed; left: 0; top: 60px; height: calc(100vh - 60px); z-index: 40; transform: translateX(${isOpen ? '0' : '-100%'}); transition: transform 0.3s ease; }
          main { margin-left: 0; }
          .mobile-menu-btn { display: inline-flex; }
          .mobile-overlay { display: block; }
          .user-meta { display: none; }
        }
      `}</style>

      <Header user={user} theme={theme} toggleTheme={toggleTheme} handleLogout={handleLogout} colors={colors} isOpen={isOpen} setIsOpen={setIsOpen} unrepliedLeads={unrepliedLeads} />

      <div style={{ display: 'flex', alignItems: 'stretch', height: 'calc(100vh - 60px)' }}>
        <aside style={{ width: 220, flexShrink: 0, padding: '16px 12px', background: colors.sidebarBg, borderRight: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', height: '100%', position: 'sticky', top: 60, overflowY: 'auto', overscrollBehavior: 'contain', transition: 'background 0.3s ease, border-color 0.3s ease' }} role="navigation" aria-label="Main navigation">
          {navItems.map((group, gi) => (
            <div key={group.title ?? `group-${gi}`}>
              {group.title && <SidebarSectionHeader title={group.title} colors={colors} />}
              {group.items.map((item) => (
                <SidebarLink
                  key={item.label}
                  item={item}
                  active={pathname === item.href}
                  theme={theme}
                  colors={colors}
                  badgeCount={badgeFor(item.badgeKey)}
                />
              ))}
            </div>
          ))}
          {/* Profile card pinned to the bottom for every role. */}
          <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
            <div style={{ height: '1px', background: colors.border, margin: '0 -4px 8px' }} />
            {user && (
              <Link
                href="/settings"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 8px',
                  marginTop: '6px',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'background 0.2s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = colors.surfaceHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                aria-label="Open settings — current account"
              >
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: theme === 'light' ? '#3B82F6' : '#60A5FA',
                    color: '#fff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    flexShrink: 0,
                  }}
                  aria-hidden
                >
                  {getInitials(user.fullName ?? user.email ?? 'U')}
                </span>
                <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                  <div
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: colors.text,
                      lineHeight: 1.2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {user.fullName ?? user.email}
                  </div>
                  {user.tenant?.plan && (
                    <div
                      style={{
                        fontSize: '0.65rem',
                        color: colors.subText,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        marginTop: '2px',
                      }}
                    >
                      {user.tenant.plan} plan
                    </div>
                  )}
                </div>
              </Link>
            )}
          </div>
        </aside>

        <main style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', background: colors.pageBg, transition: 'background 0.3s ease', height: '100%' }} role="main">
          <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '0' }} className="responsive-container">
            {user && !user.emailVerified ? <VerifyEmailBanner email={user.email} /> : null}
            {accessDenied ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 70px)', color: colors.subText }}>
                Redirecting...
              </div>
            ) : (
              children
            )}
          </div>
        </main>
      </div>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="mobile-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', zIndex: 30 }}
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <EmailVerifyToast />
    </div>
  );
}

function Header({ user, theme, toggleTheme, handleLogout, colors, isOpen, setIsOpen, unrepliedLeads }: {
  user: AuthUser | null;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  handleLogout: () => void;
  colors: { headerBg: string; border: string; text: string; subText: string; cardBg: string; surfaceHover: string };
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  // Same value the sidebar Leads badge consumes — when > 0 the bell shows a
  // red dot. Clicking the bell navigates to /leads since that's where the
  // attention is actually needed today. A real notifications stack
  // (announcements, payment events, gallery views) lives in v2.0+; until
  // then this gives the bell semantic weight without inventing fake content.
  unrepliedLeads: number | null;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const hasAlerts = (unrepliedLeads ?? 0) > 0;

  // Close the menu and return focus to the avatar trigger so keyboard
  // users aren't stranded.
  const closeMenu = () => {
    setMenuOpen(false);
    avatarRef.current?.focus();
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') closeMenu(); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [menuOpen]);

  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', background: colors.headerBg, borderBottom: `1px solid ${colors.border}`, boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)', transition: 'background 0.3s ease, border-color 0.3s ease', position: 'sticky', top: 0, zIndex: 50 }} role="banner">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        <button
          className="mobile-menu-btn"
          onClick={() => setIsOpen((v) => !v)}
          aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
          style={{ width: 34, height: 34, borderRadius: '8px', border: `1px solid ${colors.border}`, background: colors.cardBg, color: colors.text, cursor: 'pointer', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
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

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} role="navigation" aria-label="User account">
        {/* Notifications bell. Today's only "notification" is unreplied leads
            (mirrors the sidebar Leads badge); clicking the bell navigates to
            the page where the user can actually act. When a real
            notifications stack lands this becomes a popover; the entry point
            stays the same so users don't re-learn it. */}
        <button
          onClick={() => router.push('/leads')}
          aria-label={hasAlerts ? `${unrepliedLeads} unreplied lead${unrepliedLeads === 1 ? '' : 's'}` : 'No new notifications'}
          title={hasAlerts ? `${unrepliedLeads} unreplied lead${unrepliedLeads === 1 ? '' : 's'} — open Leads` : 'No new notifications'}
          style={{
            width: 34, height: 34,
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
          onMouseEnter={(e) => { e.currentTarget.style.background = colors.surfaceHover; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {hasAlerts && (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                top: 6,
                right: 7,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#DC2626',
                border: `2px solid ${colors.headerBg}`,
                boxSizing: 'content-box',
              }}
            />
          )}
        </button>

        <button
          onClick={() => toggleTheme()}
          style={{
            width: 34, height: 34,
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
          onMouseEnter={(e) => { e.currentTarget.style.background = colors.surfaceHover; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        >
          {theme === 'light' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          )}
        </button>

        {/* User menu — avatar opens a dropdown holding the account actions. */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            ref={avatarRef}
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Account menu"
            style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: theme === 'light' ? '#3B82F6' : '#60A5FA', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0, cursor: 'pointer', transition: 'background 0.3s ease' }}
            title={user?.fullName ?? 'User'}
          >
            {getInitials(user?.fullName ?? 'TU')}
          </button>

          {menuOpen && (
            <div
              role="menu"
              style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', minWidth: 220, background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: '12px', boxShadow: '0 12px 32px rgba(15, 23, 42, 0.16)', padding: '6px', zIndex: 60 }}
            >
              <div style={{ padding: '8px 10px 10px', borderBottom: `1px solid ${colors.border}`, marginBottom: '4px' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: colors.text, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.fullName ?? user?.email}</div>
                {user?.tenant?.plan && (
                  <div style={{ fontSize: '0.7rem', color: colors.subText, letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600, marginTop: '2px' }}>{user.tenant.plan} plan</div>
                )}
              </div>
              <Link
                href="/settings"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                style={{ display: 'block', padding: '8px 10px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 500, color: colors.text, textDecoration: 'none' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = colors.surfaceHover; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                Settings
              </Link>
              <button
                role="menuitem"
                onClick={() => { setMenuOpen(false); handleLogout(); }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 500, color: colors.text, border: 'none', background: 'transparent', cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = colors.surfaceHover; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function EmailVerifyToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setMessage(detail?.message ?? 'Please verify your email before performing this action.');
      window.setTimeout(() => setMessage(null), 6000);
    };
    window.addEventListener('app:email-not-verified', handler);
    return () => window.removeEventListener('app:email-not-verified', handler);
  }, []);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        right: 20,
        bottom: 24,
        zIndex: 60,
        maxWidth: 360,
        background: '#0F172A',
        color: '#F8FAFC',
        padding: '14px 18px',
        borderRadius: 10,
        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.35)',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        fontSize: 14,
        lineHeight: 1.5,
        animation: 'toast-in 0.2s ease-out',
      }}
    >
      <style>{`@keyframes toast-in { from { transform: translateY(8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
      <span style={{ flex: '0 0 auto', marginTop: 2 }}>⚠️</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>Verify your email</div>
        <div style={{ color: '#CBD5E1' }}>{message}</div>
      </div>
      <button
        onClick={() => setMessage(null)}
        aria-label="Dismiss"
        style={{
          flex: '0 0 auto',
          width: 24,
          height: 24,
          border: 'none',
          background: 'transparent',
          color: '#CBD5E1',
          cursor: 'pointer',
          fontSize: 18,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

function VerifyEmailBanner({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function resend() {
    setState('sending');
    setMessage('');
    try {
      await api.post('/api/auth/resend-verification');
      setState('sent');
      setMessage(`We sent a fresh verification link to ${email}. It expires in 24 hours.`);
    } catch (err: unknown) {
      const apiMessage = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setState('error');
      setMessage(apiMessage ?? 'Could not send verification email. Please try again later.');
    }
  }

  return (
    <div
      role="status"
      style={{
        margin: '12px 16px 0',
        padding: '12px 16px',
        borderRadius: 10,
        border: '1px solid #FCD34D',
        background: '#FFFBEB',
        color: '#78350F',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        fontSize: 14,
      }}
    >
      <span style={{ flex: 1, minWidth: 220 }}>
        <strong>Confirm your email.</strong>{' '}
        {state === 'sent' || state === 'error'
          ? message
          : `We sent a verification link to ${email}. Some features will stay locked until you confirm.`}
      </span>
      <button
        type="button"
        onClick={resend}
        disabled={state === 'sending' || state === 'sent'}
        style={{
          padding: '8px 14px',
          borderRadius: 8,
          border: '1px solid #B45309',
          background: state === 'sent' ? '#FDE68A' : '#FFFFFF',
          color: '#78350F',
          fontWeight: 600,
          fontSize: 13,
          cursor: state === 'sending' || state === 'sent' ? 'not-allowed' : 'pointer',
        }}
      >
        {state === 'sending' ? 'Sending…' : state === 'sent' ? 'Email sent' : 'Resend email'}
      </button>
    </div>
  );
}
