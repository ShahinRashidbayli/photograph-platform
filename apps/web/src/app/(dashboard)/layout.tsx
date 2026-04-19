'use client';

import api from '@/lib/api';
import { AuthUser, useAuthStore } from '@/store/authStore';
<<<<<<< Updated upstream
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Container, Nav, Navbar, Spinner } from 'react-bootstrap';
=======
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Spinner } from 'react-bootstrap';

const NAV_ITEMS = [
  { label: 'Overview', href: '/dashboard', icon: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor"/><rect x="8" y="1" width="5" height="5" rx="1" fill="currentColor" opacity=".5"/><rect x="1" y="8" width="5" height="5" rx="1" fill="currentColor" opacity=".5"/><rect x="8" y="8" width="5" height="5" rx="1" fill="currentColor" opacity=".5"/></svg>
  )},
  { label: 'Bookings', href: '/bookings', icon: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="2.5" width="12" height="9.5" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M1 5.5h12" stroke="currentColor" strokeWidth="1.2"/><path d="M4.5 1v3M9.5 1v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
  )},
  { label: 'Leads', href: '#', icon: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 11l3-3 2 2 3-4 2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  )},
  { label: 'Clients', href: '#', icon: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="5.5" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.2"/><path d="M1 12c0-2.49 2.01-4.5 4.5-4.5S10 9.51 10 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M10 6.5l1.5 1.5L14 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  )},
  { label: 'Portfolio', href: '#', icon: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M3.5 4.5h7M3.5 7h5M3.5 9.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
  )},
];

const FINANCE_ITEMS = [
  { label: 'Payments', href: '#', icon: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/><path d="M7 4.5V6M7 8.5V9.5M5.5 6.5a1.5 1.5 0 013 0c0 .83-.67 1.5-1.5 1.5s-1.5.67-1.5 1.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
  )},
  { label: 'Galleries', href: '#', icon: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 12V6.5l4.5-4 4.5 4V12H9V9H5v3H2.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
  )},
];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}
>>>>>>> Stashed changes

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setUser, clearUser } = useAuthStore();
  const [loading, setLoading] = useState(!user);

  useEffect(() => {
    if (user) return;
    api
      .get<AuthUser>('/api/auth/me')
      .then(({ data }) => {
        setUser(data);
        setLoading(false);
      })
      .catch(() => router.replace('/login'));
  }, [user, setUser, router]);

  async function handleLogout() {
    try {
      await api.post('/api/auth/logout');
    } finally {
      clearUser();
      router.push('/login');
    }
  }

  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  return (
    <>
      <Navbar bg="white" expand="lg" className="border-bottom shadow-sm px-3">
        <Navbar.Brand as={Link} href="/dashboard" className="fw-bold">
          📷 Photograph Platform
        </Navbar.Brand>
        <Navbar.Toggle />
        <Navbar.Collapse className="justify-content-end">
          <Nav>
            <Nav.Item className="d-flex align-items-center me-3 text-muted small">
              {user?.email}
            </Nav.Item>
            <Nav.Link onClick={handleLogout} className="text-danger fw-semibold" role="button">
              Sign out
            </Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Navbar>

<<<<<<< Updated upstream
      <Container className="py-4">{children}</Container>
    </>
=======
        {/* Main nav */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-tertiary)', padding: '8px 16px 4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Main</div>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <a
              key={item.label}
              href={item.href}
              className={`sidebar-link${isActive ? ' sidebar-link-active' : ''}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: isActive ? '10px 16px 10px 14px' : '10px 16px',
                fontSize: 13, textDecoration: 'none',
                color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                background: isActive ? 'var(--color-background-tertiary)' : 'transparent',
                fontWeight: isActive ? 700 : 500,
              }}
            >
              <span className="sidebar-icon" style={{ opacity: isActive ? 1 : 0.5, flexShrink: 0 }}>{item.icon}</span>
              {item.label}
            </a>
          );
        })}

        {/* Finance nav */}
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)', padding: '12px 16px 4px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Finance</div>
        {FINANCE_ITEMS.map((item) => (
          <a
            key={item.label}
            href={item.href}
            className="sidebar-link"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontSize: 12, textDecoration: 'none', color: 'var(--color-text-secondary)' }}
          >
            <span className="sidebar-icon" style={{ opacity: 0.5, flexShrink: 0 }}>{item.icon}</span>
            {item.label}
          </a>
        ))}

        {/* User footer */}
        <div style={{ marginTop: 'auto', padding: '12px 16px', borderTop: '1px solid var(--color-border-tertiary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#E6F1FB', border: '1px solid #C4DCEF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#0C447C', flexShrink: 0 }}>
            {user?.fullName ? getInitials(user.fullName) : '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.fullName}</div>
            <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{user?.tenant?.plan}</div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--color-text-tertiary)', flexShrink: 0 }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 4l3 3-3 3M11 7H5M5 1H2a1 1 0 00-1 1v8a1 1 0 001 1h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </main>
    </div>
    </div>
>>>>>>> Stashed changes
  );
}
