'use client';

import api from '@/lib/api';
import { AuthUser, useAuthStore, useIsPhotographer } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { getColors } from '@/lib/design-tokens';
import { useTranslation } from '@/lib/i18n';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useAttention } from '@/hooks/useAttention';
import { CLIENT_NAV, PHOTOGRAPHER_NAV, groupsFor, modeForPath, modesIn } from '@/lib/nav';
import type { NavMode } from '@/lib/nav';
import { SidebarLink, SidebarSectionHeader } from '@/components/layout/SidebarLink';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { RouteSlot } from '@/components/layout/RouteSlot';
import { SidebarModeSwitch } from '@/components/layout/SidebarModeSwitch';
import { EmailVerifyToast, VerifyEmailBanner } from '@/components/layout/VerifyEmail';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { PaymentReturnNotice } from '@/components/PaymentReturnNotice';
import { UserAvatar } from '@/components/UserAvatar';
import { AccountLockNotice } from '@/components/AccountLockNotice';
import { PlanUpgradeDialog } from '@/components/PlanUpgradeDialog';
import { planThatGrants } from '@/lib/plan-gate';

/**
 * The dashboard shell: authentication, role routing, the sidebar, and the
 * chrome every page inside {@code (dashboard)} renders into.
 *
 * <p>What it deliberately does <em>not</em> hold: the nav rows themselves
 * ({@code lib/nav}), their drawings ({@code components/layout/NavIcon}), the
 * header and its bell ({@code components/layout/*}), or the polling behind the
 * attention badge ({@code hooks/useAttention}). Those used to live here, and a
 * single 2 000-line file is what made a nav change a risky edit to the one
 * module every screen depends on. Keeping this file about the shell is what
 * lets navigation grow — a second mode included — as data.
 */
export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setUser, clearUser } = useAuthStore();
  const isPhotographer = useIsPhotographer();
  const [loading, setLoading] = useState(!user);
  const [isOpen, setIsOpen] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const { theme } = useThemeStore();
  const { t } = useTranslation();

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

    // Settings is shared — both roles manage their own account there.
    const photographerOnlyPages = [
      '/dashboard',
      '/leads',
      '/clients',
      '/portfolio',
      '/reports',
      '/revenue',
    ];

    const isOnPhotographerPage = photographerOnlyPages.some(
      (page) => pathname === page || pathname.startsWith(page + '/')
    );

    // Customers cannot access photographer-only pages. Previously this silently
    // redirected to /bookings — but a photographer who opens a lead/inquiry
    // email link while a client session is active (both roles share one host
    // and cookie) landed on the *customer* dashboard with no explanation, which
    // read as a bug. Instead show an explicit interstitial (rendered below) that
    // names the signed-in account and offers to switch to the photographer login.
    setAccessDenied(!isPhotographer && isOnPhotographerPage);
  }, [pathname, user?.role, isPhotographer]);

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
      // Land on the public marketing page, not /login — signing out returns
      // the visitor to the top of the funnel, and /me runs client-side there.
      router.replace('/');
      clearUser();
    }
  }

  // Access-denied interstitial action: drop the client session and send the
  // user to the photographer login, so a photographer who followed an email
  // link while signed in as a client can get to the right account in one click.
  async function handleSwitchToPhotographer() {
    setLoggingOut(true);
    try {
      await api.post('/api/auth/logout');
    } catch {
      // best-effort — clear local state regardless
    } finally {
      router.replace('/login');
      clearUser();
    }
  }

  // A group that names a capability the plan lacks is shown locked, not hidden:
  // its rows carry the tier badge and lead to the upgrade section. `has`
  // answers false until the entitlements load, which would flash a lock on
  // every navigation for a photographer who *does* have the capability — so a
  // group only reads as locked once the answer is actually known.
  const { has: hasCapability, entitlements } = useEntitlements();
  const entitlementsKnown = entitlements !== undefined;
  const nav = isPhotographer ? PHOTOGRAPHER_NAV : CLIENT_NAV;

  // Which half of the product the sidebar is showing.
  //
  // Seeded from the route so a shared link to /community/studios opens with
  // the community list already up, and re-derived whenever the route changes
  // so following a link moves the switch with it. `modeForPath` answers null
  // for a path in no group — /settings, reachable from either side — and that
  // is deliberately left alone rather than reset, so opening settings and
  // coming back does not silently drop the photographer on the other half.
  //
  // Switching itself does not navigate. It swaps the list and leaves the page
  // where it is, so looking up what a studio charges does not cost you the
  // booking you were half-way through writing.
  const navModes = modesIn(nav);
  const [navMode, setNavMode] = useState<NavMode>(() => modeForPath(nav, pathname) ?? 'workspace');
  useEffect(() => {
    const routeMode = modeForPath(nav, pathname);
    if (routeMode) setNavMode(routeMode);
  }, [pathname, nav]);
  const navItems = groupsFor(nav, navMode);
  const lockFor = (capability: string | undefined): string | null => {
    if (!capability || !entitlementsKnown || hasCapability(capability)) return null;
    return planThatGrants(capability);
  };

  // Drives both the bell and the sidebar's Leads badge — one list, so the two
  // indicators can never disagree about how much is waiting.
  const {
    items: attention,
    count: attentionCount,
    refresh: refreshAttention,
  } = useAttention(isPhotographer);

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
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: lc.bg,
        }}
      >
        <div suppressHydrationWarning style={{ color: lc.text, fontSize: '0.95rem' }}>
          {t('chrome.loading')}
        </div>
      </div>
    );
  }

  // Map a badgeKey on a NavLeaf to its concrete count. Easy to extend with
  // future badges (unread messages, expiring galleries, …) by adding cases.
  const badgeFor = (key?: 'unrepliedLeads'): number | null => {
    if (key === 'unrepliedLeads') return attentionCount;
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
    // Passed down so the header bar and the two panels it opens sit on the
    // shared elevation ramp instead of each carrying its own light-mode-only
    // shadow string.
    shadowRaised: c.shadowRaised,
    shadowPopover: c.shadowPopover,
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: colors.bg,
        color: colors.text,
        transition: 'background 0.3s ease, color 0.3s ease',
      }}
    >
      {/* Global Styles */}
      <style>{`
        * { box-sizing: border-box; }
        a:focus-visible, button:focus-visible { outline: 2px solid #6366F1; outline-offset: 2px; }
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

      <DashboardHeader
        user={user}
        theme={theme}
        handleLogout={handleLogout}
        colors={colors}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        attentionCount={attentionCount}
        attention={attention}
        onAttentionHandled={refreshAttention}
      />

      <div style={{ display: 'flex', alignItems: 'stretch', height: 'calc(100vh - 60px)' }}>
        <aside
          style={{
            width: 236,
            flexShrink: 0,
            padding: '16px 12px',
            background: colors.sidebarBg,
            borderRight: `1px solid ${colors.border}`,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            position: 'sticky',
            top: 60,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            transition: 'background 0.3s ease, border-color 0.3s ease',
          }}
          role="navigation"
          aria-label={t('nav.aria.main')}
        >
          {navModes.length > 1 && (
            <SidebarModeSwitch
              modes={navModes}
              active={navMode}
              onChange={setNavMode}
              theme={theme}
            />
          )}
          {navItems.map((group, gi) => {
            const groupLock = lockFor(group.capability);
            return (
              <div key={group.titleKey ?? `group-${gi}`}>
                {group.titleKey && (
                  <SidebarSectionHeader title={t(group.titleKey)} colors={colors} />
                )}
                {group.items.map((item) => {
                  const lockedBehind = lockFor(item.capability) ?? groupLock;
                  return (
                    <SidebarLink
                      key={item.labelKey}
                      item={item}
                      active={pathname === item.href}
                      theme={theme}
                      colors={colors}
                      lockedBehind={lockedBehind}
                      // A locked row has nothing of its own waiting on it, and a
                      // count next to a lock would read as work the photographer
                      // is being kept from.
                      badgeCount={lockedBehind ? null : badgeFor(item.badgeKey)}
                    />
                  );
                })}
              </div>
            );
          })}
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
                aria-label={t('nav.aria.profile')}
              >
                <UserAvatar
                  name={user.fullName ?? user.email ?? 'U'}
                  src={user.avatarUrl}
                  size={32}
                  background={theme === 'light' ? '#6366F1' : '#818CF8'}
                  color="#fff"
                />
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
                  {/* Plan tier is the photographer's tenant billing — clients
                      belong to that tenant but must not see its plan. */}
                  {isPhotographer && user.tenant?.plan && (
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
                      {t('nav.plan', { plan: user.tenant.plan })}
                    </div>
                  )}
                </div>
              </Link>
            )}
          </div>
        </aside>

        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            background: colors.pageBg,
            transition: 'background 0.3s ease',
            height: '100%',
          }}
          role="main"
        >
          <div
            style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '0' }}
            className="responsive-container"
          >
            {user && !user.emailVerified ? <VerifyEmailBanner email={user.email} /> : null}
            {/* Stripe returns SCA/3DS payers to whichever page they started
                on, so the "did it go through?" answer lives in the layout
                rather than being duplicated per route. */}
            <Suspense fallback={null}>
              <PaymentReturnNotice />
              {/* Renders nothing unless the account is locked or its
                  trial is nearly up. Mounted in the shell rather than
                  per page because the lock applies to every write in
                  the app, so any page is where someone will hit it. */}
              <AccountLockNotice />
            </Suspense>
            {/* Renders nothing until an API call comes back 402. Mounted in the
                shell for the same reason the lock notice is: a plan gate can be
                met from any page, and the prompt has to reach the photographer
                wherever they were when they hit it. */}
            <PlanUpgradeDialog />
            {accessDenied ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 'calc(100vh - 70px)',
                  padding: '24px',
                }}
              >
                <div
                  style={{
                    maxWidth: 420,
                    width: '100%',
                    textAlign: 'center',
                    background: colors.cardBg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 16,
                    padding: '32px 28px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      color: colors.text,
                      marginBottom: 8,
                    }}
                  >
                    {t('chrome.accessDenied.title')}
                  </div>
                  <div
                    style={{
                      fontSize: '0.9rem',
                      color: colors.subText,
                      lineHeight: 1.5,
                      marginBottom: 22,
                    }}
                  >
                    {t('chrome.accessDenied.body', { email: user?.email ?? '' })}
                  </div>
                  <button
                    type="button"
                    onClick={handleSwitchToPhotographer}
                    style={{
                      width: '100%',
                      padding: '11px 16px',
                      borderRadius: 10,
                      border: 'none',
                      background: colors.primary,
                      color: '#fff',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      marginBottom: 10,
                    }}
                  >
                    {t('chrome.accessDenied.switch')}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.replace('/bookings')}
                    style={{
                      width: '100%',
                      padding: '11px 16px',
                      borderRadius: 10,
                      border: `1px solid ${colors.border}`,
                      background: 'transparent',
                      color: colors.text,
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {t('chrome.accessDenied.myBookings')}
                  </button>
                </div>
              </div>
            ) : (
              <RouteSlot>{children}</RouteSlot>
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
