"use client";

import api from '@/lib/api';
import { AuthUser, useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { FotolioLogo } from '@/components/FotolioLogo';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const PHOTOGRAPHER_NAV = [
  { label: 'Overview', href: '/dashboard', icon: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor"/><rect x="8" y="1" width="5" height="5" rx="1" fill="currentColor" opacity=".5"/><rect x="1" y="8" width="5" height="5" rx="1" fill="currentColor" opacity=".5"/><rect x="8" y="8" width="5" height="5" rx="1" fill="currentColor" opacity=".5"/></svg>
  )},
  { label: 'Bookings', href: '/bookings', icon: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="2.5" width="12" height="9.5" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M1 5.5h12" stroke="currentColor" strokeWidth="1.2"/><path d="M4.5 1v3M9.5 1v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
  )},
  { label: 'Leads', href: '/leads', icon: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 11l3-3 2 2 3-4 2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  )},
  { label: 'Clients', href: '/clients', icon: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="5.5" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.2"/><path d="M1 12c0-2.49 2.01-4.5 4.5-4.5S10 9.51 10 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M10 6.5l1.5 1.5L14 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  )},
  { label: 'Portfolio', href: '/portfolio', icon: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M3.5 4.5h7M3.5 7h5M3.5 9.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
  )},
];

const PHOTOGRAPHER_FINANCE = [
  { label: 'Payments', href: '#', icon: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/><path d="M7 4.5V6M7 8.5V9.5M5.5 6.5a1.5 1.5 0 013 0c0 .83-.67 1.5-1.5 1.5s-1.5.67-1.5 1.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
  )},
  { label: 'Galleries', href: '#', icon: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 12V6.5l4.5-4 4.5 4V12H9V9H5v3H2.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
  )},
];

const CLIENT_NAV = [
  { label: 'My Bookings', href: '/bookings', icon: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="2.5" width="12" height="9.5" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M1 5.5h12" stroke="currentColor" strokeWidth="1.2"/><path d="M4.5 1v3M9.5 1v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
  )},
  { label: 'Galleries', href: '/galleries', icon: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 12V6.5l4.5-4 4.5 4V12H9V9H5v3H2.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
  )},
  { label: 'Settings', href: '/settings', icon: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2"/><path d="M7 1v2M7 11v2M1 7H3M11 7h2M2.93 2.93l1.41 1.41M9.66 9.66l1.41 1.41M2.93 11.07l1.41-1.41M9.66 4.34l1.41-1.41" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
  )},
];

function getInitials(name: string) {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return 'U';
  const parts = trimmed.split(/\s+/);
  return (parts[0]?.[0] ?? 'U') + (parts[1]?.[0] ?? '');
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
    const customerOnlyPages = ['/settings', '/galleries'];
    const photographerOnlyPages = ['/dashboard', '/leads', '/clients', '/portfolio'];

    const isOnCustomerPage = customerOnlyPages.some(page => pathname === page || pathname.startsWith(page + '/'));
    const isOnPhotographerPage = photographerOnlyPages.some(page => pathname === page || pathname.startsWith(page + '/'));

    // Photographers cannot access customer-only pages
    if (isPhotographer && isOnCustomerPage) {
      setAccessDenied(true);
      router.replace('/dashboard');
    }
    // Customers cannot access photographer-only pages (redirect to /bookings)
    else if (!isPhotographer && isOnPhotographerPage) {
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

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F3F4F6' }}>
        <div style={{ color: '#111827', fontSize: '0.95rem' }}>Loading dashboard...</div>
      </div>
    );
  }

  const role = user?.role?.toUpperCase();
  const isPhotographer = role === 'PHOTOGRAPHER' || role === 'ADMIN';
  const navItems = isPhotographer ? PHOTOGRAPHER_NAV : CLIENT_NAV;
  const financeItems = isPhotographer ? PHOTOGRAPHER_FINANCE : [];

  const themeColors = {
    light: {
      bg: '#F9FAFB',
      pageBg: '#F9FAFB',
      text: '#111827',
      subText: '#6B7280',
      border: '#E5E7EB',
      cardBg: '#FFFFFF',
      headerBg: '#FFFFFF',
      sidebarBg: '#FFFFFF',
    },
    dark: {
      bg: '#111827',
      pageBg: '#111827',
      text: '#F3F4F6',
      subText: '#D1D5DB',
      border: '#374151',
      cardBg: '#1F2937',
      headerBg: '#1F2937',
      sidebarBg: '#1F2937',
    },
  };

  const colors = themeColors[theme];

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
          aside { position: fixed; left: 0; top: 70px; height: calc(100vh - 70px); z-index: 40; transform: translateX(${isOpen ? '0' : '-100%'}); transition: transform 0.3s ease; }
          main { margin-left: 0; }
          .mobile-menu-btn { display: inline-flex; }
          .mobile-overlay { display: block; }
          .user-meta { display: none; }
        }
      `}</style>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', background: colors.headerBg, borderBottom: `1px solid ${colors.border}`, boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)', transition: 'background 0.3s ease, border-color 0.3s ease' }} role="banner">
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} role="navigation" aria-label="User account">
          <div className="user-meta" style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: colors.text, lineHeight: 1.2, transition: 'color 0.3s ease' }}>{user?.fullName ?? user?.email}</div>
            <div style={{ fontSize: '0.7rem', color: colors.subText, letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600, transition: 'color 0.3s ease' }}>{user?.tenant?.plan}</div>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: theme === 'light' ? '#3B82F6' : '#60A5FA', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0, transition: 'background 0.3s ease' }} title={user?.fullName ?? 'User'}>
            {getInitials(user?.fullName ?? 'TU')}
          </div>
          <button
            onClick={() => toggleTheme()}
            style={{
              padding: '6px 6px',
              fontSize: '1.2rem',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderRadius: '8px',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.text,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = theme === 'light' ? '#F3F4F6' : '#374151'; }}
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
          <button
            onClick={handleLogout}
            style={{ padding: '8px 16px', fontSize: '0.8rem', color: colors.text, fontWeight: 500, border: `1px solid ${colors.border}`, background: colors.cardBg, cursor: 'pointer', borderRadius: '8px', whiteSpace: 'nowrap', transition: 'all 0.2s ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = theme === 'light' ? '#F3F4F6' : '#374151'; e.currentTarget.style.borderColor = theme === 'light' ? '#D1D5DB' : '#4B5563'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = colors.cardBg; e.currentTarget.style.borderColor = colors.border; }}
            aria-label="Sign out from account"
          >
            Sign out
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', alignItems: 'stretch', height: 'calc(100vh - 70px)' }}>
        <aside style={{ width: 220, flexShrink: 0, padding: '16px 12px', background: colors.sidebarBg, borderRight: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', height: '100%', position: 'sticky', top: 70, overflowY: 'auto', overscrollBehavior: 'contain', transition: 'background 0.3s ease, border-color 0.3s ease' }} role="navigation" aria-label="Main navigation">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const activeColor = theme === 'light' ? '#EFF6FF' : '#1E293B';
            const hoverColor = theme === 'light' ? '#F8FAFC' : '#334155';
            return (
              <Link
                key={item.label}
                href={item.href}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', marginBottom: '4px', borderRadius: '8px', color: active ? colors.text : colors.subText, background: active ? activeColor : 'transparent', textDecoration: 'none', fontWeight: active ? 700 : 500, fontSize: '0.9rem', transition: 'all 0.2s ease', cursor: 'pointer' }}
                onMouseEnter={(e) => !active && (e.currentTarget.style.background = hoverColor)}
                onMouseLeave={(e) => !active && (e.currentTarget.style.background = 'transparent')}
                aria-current={active ? 'page' : undefined}
              >
                <span style={{ opacity: active ? 1 : 0.65, display: 'flex', alignItems: 'center', justifyContent: 'center', color: active ? colors.text : colors.subText, transition: 'color 0.3s ease', fontSize: '0.85rem' }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}

          {financeItems.length > 0 && (
            <>
              <div style={{ marginTop: '14px', marginBottom: '8px', fontSize: '0.65rem', letterSpacing: '0.1em', color: theme === 'light' ? '#94A3B8' : '#64748B', textTransform: 'uppercase', fontWeight: 700, transition: 'color 0.3s ease' }}>Finance</div>
              {financeItems.map((item) => {
                const hoverColor = theme === 'light' ? '#F8FAFC' : '#334155';
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', marginBottom: '4px', borderRadius: '8px', textDecoration: 'none', color: colors.subText, background: 'transparent', fontWeight: 500, fontSize: '0.9rem', transition: 'all 0.2s ease', cursor: 'pointer' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = hoverColor, e.currentTarget.style.color = colors.text)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent', e.currentTarget.style.color = colors.subText)}
                    aria-label={item.label}
                  >
                    <span style={{ opacity: 0.65, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>{item.icon}</span>
                    {item.label}
                  </a>
                );
              })}
            </>
          )}
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
