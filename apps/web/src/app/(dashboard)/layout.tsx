'use client';

import api from '@/lib/api';
import { fetchAllPages } from '@/lib/paging';
import { AuthUser, useAuthStore, useIsPhotographer } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { getColors } from '@/lib/design-tokens';
import { FotolioLogo } from '@/components/FotolioLogo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useTranslation, type TranslationKey } from '@/lib/i18n';
import { useEntitlements } from '@/hooks/useEntitlements';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { PaymentReturnNotice } from '@/components/PaymentReturnNotice';
import { UserAvatar } from '@/components/UserAvatar';
import { AccountLockNotice } from '@/components/AccountLockNotice';

// Nav grouped into sections so the sidebar mirrors the mental model:
// daily-work pages first, content-management after it. Each group renders with
// an uppercase section header for grouping signal without using horizontal
// dividers.
//
// The analytics group is conditional: /revenue and /reports are Studio's
// ANALYTICS capability, so linking to them from a plan that does not include
// it would send a photographer to a screen the API answers with 402. The group
// is filtered out below rather than shown-and-locked — a sidebar is a list of
// places you can go.
type NavLeaf = {
  labelKey: TranslationKey;
  href: string;
  icon: React.ReactNode;
  badgeKey?: 'unrepliedLeads';
};
type NavGroup = {
  titleKey?: TranslationKey;
  items: NavLeaf[];
  /**
   * Plan capability this group needs. Groups without one are always shown;
   * the value is a {@code Capability} name as the API serialises it.
   */
  capability?: string;
};

/**
 * One thing waiting on the photographer, as the bell panel shows it.
 *
 * <p>There is no notifications table behind this: "unread" is derived from the
 * two states that mean nobody has dealt with the thing yet — a lead still
 * {@code NEW} and an inquiry still {@code PENDING}. That is also why marking
 * one read is a real transition rather than a local flag; see the panel.
 */
type AttentionItem = {
  kind: 'LEAD' | 'INQUIRY';
  id: string;
  name: string;
  detail: string | null;
  createdAt: string;
};

type LeadRow = { id: string; name: string; status: string; eventType?: string; createdAt: string };
type InquiryRow = {
  id: string;
  customerName: string;
  status: string;
  eventType?: string;
  createdAt: string;
};

const PHOTOGRAPHER_NAV: NavGroup[] = [
  {
    // Untitled first group — primary daily-work pages live here.
    items: [
      {
        labelKey: 'nav.overview',
        href: '/dashboard',
        icon: (
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor" />
            <rect x="8" y="1" width="5" height="5" rx="1" fill="currentColor" opacity=".5" />
            <rect x="1" y="8" width="5" height="5" rx="1" fill="currentColor" opacity=".5" />
            <rect x="8" y="8" width="5" height="5" rx="1" fill="currentColor" opacity=".5" />
          </svg>
        ),
      },
      {
        labelKey: 'nav.bookings',
        href: '/bookings',
        icon: (
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
            <rect
              x="1"
              y="2.5"
              width="12"
              height="9.5"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <path d="M1 5.5h12" stroke="currentColor" strokeWidth="1.2" />
            <path
              d="M4.5 1v3M9.5 1v3"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        ),
      },
      // Leads carries a live count badge of un-replied leads — "you have N
      // enquiries waiting" surfaces from the sidebar without needing to
      // open the page first.
      {
        labelKey: 'nav.leads',
        href: '/leads',
        badgeKey: 'unrepliedLeads',
        icon: (
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
            <path
              d="M2 11l3-3 2 2 3-4 2 2"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
      {
        labelKey: 'nav.clients',
        href: '/clients',
        icon: (
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
            <circle cx="5.5" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
            <path
              d="M1 12c0-2.49 2.01-4.5 4.5-4.5S10 9.51 10 12"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <path
              d="M10 6.5l1.5 1.5L14 5.5"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
    ],
  },
  {
    titleKey: 'nav.section.content',
    items: [
      {
        labelKey: 'nav.portfolio',
        href: '/portfolio',
        icon: (
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
            <rect
              x="1"
              y="1"
              width="12"
              height="12"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <path
              d="M3.5 4.5h7M3.5 7h5M3.5 9.5h3"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        ),
      },
      {
        labelKey: 'nav.galleries',
        href: '/galleries',
        icon: (
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
            <path
              d="M2.5 12V6.5l4.5-4 4.5 4V12H9V9H5v3H2.5z"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
    ],
  },
  // Both pages read real figures now — revenue from issued invoices and
  // succeeded payments, reports from bookings, leads and packages — so they
  // are linked. Filtered out entirely on a plan without ANALYTICS.
  {
    titleKey: 'nav.section.analytics',
    capability: 'ANALYTICS',
    items: [
      {
        labelKey: 'nav.revenue',
        href: '/revenue',
        icon: (
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
            <path
              d="M2 11.5V8m3.33 3.5V5.5M8.67 11.5v-5M12 11.5v-9"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        ),
      },
      {
        labelKey: 'nav.reports',
        href: '/reports',
        icon: (
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
            <path
              d="M3 1.5h5l3 3v8a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5z"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <path
              d="M8 1.5v3h3M4.75 8h4.5M4.75 10.25h3"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        ),
      },
    ],
  },
];

// Payments is linked and reads REAL data — it derives every amount from the
// client's own bookings (deposit paid, balance due, totals), so there are no
// invented invoices. Documents stays UNLINKED: unlike Payments it is still built
// against hard-coded sample data (a contract awaiting signature) with no
// e-signature backend, and a "Soon" badge would not stop a client from opening
// it and reading a fabricated contract as their own. It stays in the tree —
// re-linking it is a one-line change once the document flow lands.
const CLIENT_NAV: NavGroup[] = [
  {
    items: [
      {
        labelKey: 'nav.myBookings',
        href: '/bookings',
        icon: (
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
            <rect
              x="1"
              y="2.5"
              width="12"
              height="9.5"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <path d="M1 5.5h12" stroke="currentColor" strokeWidth="1.2" />
            <path
              d="M4.5 1v3M9.5 1v3"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        ),
      },
      {
        labelKey: 'nav.payments',
        href: '/payments',
        icon: (
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
            <rect
              x="1"
              y="3"
              width="12"
              height="8"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <path d="M1 5.5h12" stroke="currentColor" strokeWidth="1.2" />
            <path d="M3.5 8.5h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        labelKey: 'nav.galleries',
        href: '/galleries',
        icon: (
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
            <path
              d="M2.5 12V6.5l4.5-4 4.5 4V12H9V9H5v3H2.5z"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
    ],
  },
];

type NavItem = NavLeaf;

function SidebarLink({
  item,
  active,
  theme,
  colors,
  badgeCount,
}: {
  item: NavItem;
  active: boolean;
  theme: string;
  colors: { text: string; subText: string; primary: string };
  // Optional unread-style count. Rendered as a small pill on the right of
  // the row — null/0 collapses the pill so the row stays clean when there's
  // nothing to flag.
  badgeCount?: number | null;
}) {
  const { t } = useTranslation();
  const activeColor = theme === 'light' ? '#EEF2FF' : 'rgba(99, 102, 241, 0.14)';
  const hoverColor = theme === 'light' ? '#F8FAFC' : '#1C1C22';
  const showBadge = typeof badgeCount === 'number' && badgeCount > 0;
  return (
    <Link
      href={item.href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 10px',
        marginBottom: '4px',
        borderRadius: '8px',
        color: active ? colors.text : colors.subText,
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
        {item.icon}
      </span>
      <span style={{ flex: 1 }}>{t(item.labelKey)}</span>
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

  // Groups that name a capability drop out unless the plan grants it. `has`
  // answers false until the entitlements load, so a gated group appears when
  // it is confirmed rather than flashing in and out on every navigation.
  const { has: hasCapability } = useEntitlements();
  const navItems = (isPhotographer ? PHOTOGRAPHER_NAV : CLIENT_NAV).filter(
    (group) => !group.capability || hasCapability(group.capability)
  );
  const [attention, setAttention] = useState<AttentionItem[] | null>(null);
  // Null until the first fetch lands, so the bell shows nothing rather than a
  // confident zero it has not checked.
  const attentionCount = attention === null ? null : attention.length;

  // Attention badge (bell + sidebar Leads): everything new that landed in the
  // leads inbox and still needs the photographer — un-replied form leads
  // (status NEW) plus un-triaged customer inquiries (status PENDING). Both
  // surface on /leads, so a single count drives both indicators. Polled every
  // 60s — cheap and "good enough" without a websocket; failures are silent so
  // an outage doesn't make the badge flicker.
  // Bumped when the photographer acts on an item from the panel, so the list
  // refetches instead of waiting out the 60s poll with a row it just cleared.
  const [attentionNonce, setAttentionNonce] = useState(0);
  const refreshAttention = useCallback(() => setAttentionNonce((n) => n + 1), []);

  useEffect(() => {
    if (!isPhotographer) return;
    let cancelled = false;
    const fetchCount = () => {
      // Paged, not a bare GET: `/api/leads` caps at 20 by default, so the
      // badge stopped counting new leads once the 20 most recent rows were
      // no longer all NEW — i.e. it under-reported exactly when there was a
      // backlog to flag.
      Promise.all([
        fetchAllPages<LeadRow>('/api/leads').catch(() => null),
        fetchAllPages<InquiryRow>('/api/inquiries').catch(() => null),
      ]).then(([leads, inquiries]) => {
        if (cancelled) return;
        // If both calls failed, leave the previous list untouched.
        if (leads === null && inquiries === null) return;
        const items: AttentionItem[] = [
          ...(Array.isArray(leads) ? leads : [])
            .filter((l) => l.status === 'NEW')
            .map((l) => ({
              kind: 'LEAD' as const,
              id: l.id,
              name: l.name,
              detail: l.eventType ?? null,
              createdAt: l.createdAt,
            })),
          ...(Array.isArray(inquiries) ? inquiries : [])
            .filter((i) => i.status === 'PENDING')
            .map((i) => ({
              kind: 'INQUIRY' as const,
              id: i.id,
              name: i.customerName,
              detail: i.eventType ?? null,
              createdAt: i.createdAt,
            })),
        ];
        // Newest first, so the panel reads like an inbox rather than like two
        // lists stapled together.
        items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        setAttention(items);
      });
    };
    fetchCount();
    const id = window.setInterval(fetchCount, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isPhotographer, attentionNonce]);

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

      <Header
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
            width: 220,
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
          {navItems.map((group, gi) => (
            <div key={group.titleKey ?? `group-${gi}`}>
              {group.titleKey && <SidebarSectionHeader title={t(group.titleKey)} colors={colors} />}
              {group.items.map((item) => (
                <SidebarLink
                  key={item.labelKey}
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

function Header({
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
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
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
                boxShadow: '0 12px 32px rgba(15, 23, 42, 0.16)',
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

/**
 * What is waiting on the photographer, opened from the bell.
 *
 * <p>The bell used to navigate straight to /leads. That answered "how many"
 * with a page load and never answered "which" — you had to leave whatever you
 * were doing to find out whether the five items were worth interrupting for.
 *
 * <h2>What "mark as read" means here</h2>
 * There is no notifications table and no read flag: an item is unread because
 * it is still in the state that means nobody has dealt with it. So marking a
 * lead read is the real transition {@code LeadService#markReplied} already
 * exposes — "I have replied to this person" — which is the same thing that
 * clears it from the badge, and it is recorded as LEAD_REPLIED in the audit
 * trail rather than as a UI preference.
 *
 * <p>Inquiries deliberately have no such button. Clearing one means accepting
 * or rejecting it, and that creates a booking or sends the customer a refusal
 * — not something to do from a dropdown with the customer's message out of
 * sight. Those rows link to /leads instead, where the decision is made with
 * everything in view.
 */
function NotificationPanel({
  items,
  colors,
  onClose,
  onHandled,
}: {
  items: AttentionItem[] | null;
  colors: { border: string; text: string; subText: string; cardBg: string; surfaceHover: string };
  onClose: () => void;
  onHandled: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<string | null>(null);
  // Removed here as soon as the API confirms, so the row goes at the moment
  // the photographer acts rather than when the next refetch lands.
  const [cleared, setCleared] = useState<string[]>([]);

  const visible = (items ?? []).filter((i) => !cleared.includes(i.id));

  async function markRead(item: AttentionItem) {
    setBusy(item.id);
    try {
      await api.patch(`/api/leads/${item.id}/status`, { status: 'REPLIED' });
      setCleared((ids) => [...ids, item.id]);
      onHandled();
    } catch {
      // Left in the list: a row that silently vanished on a failed write would
      // say the lead was handled when it was not.
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      role="menu"
      aria-label={t('chrome.notifications.title')}
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        width: 320,
        maxHeight: 400,
        overflowY: 'auto',
        background: colors.cardBg,
        border: `1px solid ${colors.border}`,
        borderRadius: '12px',
        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.16)',
        padding: '8px',
        zIndex: 50,
      }}
    >
      <div
        style={{
          padding: '6px 8px 8px',
          fontSize: '0.78rem',
          fontWeight: 700,
          color: colors.subText,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {t('chrome.notifications.title')}
      </div>

      {items === null ? (
        <div style={{ padding: '12px 8px', fontSize: '0.85rem', color: colors.subText }}>
          {t('chrome.notifications.loading')}
        </div>
      ) : visible.length === 0 ? (
        <div style={{ padding: '12px 8px', fontSize: '0.85rem', color: colors.subText }}>
          {t('chrome.notifications.none')}
        </div>
      ) : (
        visible.map((item) => (
          <div
            key={`${item.kind}-${item.id}`}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '8px',
              borderRadius: '8px',
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: item.kind === 'LEAD' ? '#6366F1' : '#0EA5E9',
                  letterSpacing: '0.04em',
                }}
              >
                {t(
                  item.kind === 'LEAD'
                    ? 'chrome.notifications.kind.lead'
                    : 'chrome.notifications.kind.inquiry'
                )}
              </div>
              <div
                style={{
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  color: colors.text,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.name}
              </div>
              {item.detail && (
                <div style={{ fontSize: '0.76rem', color: colors.subText }}>{item.detail}</div>
              )}
            </div>
            {item.kind === 'LEAD' ? (
              <button
                role="menuitem"
                onClick={() => markRead(item)}
                disabled={busy === item.id}
                style={{
                  flexShrink: 0,
                  border: `1px solid ${colors.border}`,
                  background: 'transparent',
                  color: colors.text,
                  borderRadius: '7px',
                  padding: '4px 8px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: busy === item.id ? 'default' : 'pointer',
                  opacity: busy === item.id ? 0.5 : 1,
                }}
              >
                {t('chrome.notifications.markRead')}
              </button>
            ) : (
              <Link
                role="menuitem"
                href="/leads"
                onClick={onClose}
                style={{
                  flexShrink: 0,
                  borderRadius: '7px',
                  padding: '4px 8px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  color: colors.text,
                  textDecoration: 'none',
                  border: `1px solid ${colors.border}`,
                }}
              >
                {t('chrome.notifications.review')}
              </Link>
            )}
          </div>
        ))
      )}

      <div style={{ borderTop: `1px solid ${colors.border}`, marginTop: '6px', paddingTop: '6px' }}>
        <Link
          role="menuitem"
          href="/leads"
          onClick={onClose}
          style={{
            display: 'block',
            padding: '8px',
            borderRadius: '8px',
            fontSize: '0.82rem',
            fontWeight: 600,
            color: colors.text,
            textDecoration: 'none',
          }}
        >
          {t('chrome.notifications.viewAll')}
        </Link>
      </div>
    </div>
  );
}

function EmailVerifyToast() {
  // Holds the server-supplied message, or an empty string when the event
  // carried none — the fallback is resolved at render so it follows the
  // active language rather than the one in effect when the event fired.
  const [toast, setToast] = useState<{ text: string } | null>(null);
  const { t } = useTranslation();

  // One timer, restarted per event. Scheduling a fresh un-tracked timeout on
  // every event meant they stacked: a dashboard page fires several gated
  // requests at once, so three 403s scheduled three dismissals, and the first
  // to expire cleared the *latest* toast — the message vanished a second after
  // appearing, precisely when it fired most often. Tracking it in a ref also
  // lets the unmount cleanup cancel a pending dismissal.
  const dismissTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setToast({ text: detail?.message ?? '' });
      if (dismissTimer.current !== undefined) window.clearTimeout(dismissTimer.current);
      dismissTimer.current = window.setTimeout(() => setToast(null), 6000);
    };
    window.addEventListener('app:email-not-verified', handler);
    return () => {
      window.removeEventListener('app:email-not-verified', handler);
      if (dismissTimer.current !== undefined) window.clearTimeout(dismissTimer.current);
    };
  }, []);

  if (!toast) return null;
  const message = toast.text || t('verify.toastDefault');

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
        <div style={{ fontWeight: 600, marginBottom: 2 }}>{t('verify.toastTitle')}</div>
        <div style={{ color: '#CBD5E1' }}>{message}</div>
      </div>
      <button
        onClick={() => setToast(null)}
        aria-label={t('verify.dismiss')}
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
  const { t } = useTranslation();

  async function resend() {
    setState('sending');
    setMessage('');
    try {
      await api.post('/api/auth/resend-verification');
      setState('sent');
      setMessage(t('verify.bannerSent', { email }));
    } catch (err: unknown) {
      const apiMessage = (err as { response?: { data?: { error?: string } } })?.response?.data
        ?.error;
      setState('error');
      setMessage(apiMessage ?? t('verify.bannerError'));
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
        <strong>{t('verify.bannerTitle')}</strong>{' '}
        {state === 'sent' || state === 'error' ? message : t('verify.bannerBody', { email })}
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
        {state === 'sending'
          ? t('verify.sending')
          : state === 'sent'
            ? t('verify.sent')
            : t('verify.resend')}
      </button>
    </div>
  );
}
