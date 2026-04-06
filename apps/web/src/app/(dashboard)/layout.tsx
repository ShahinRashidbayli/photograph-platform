'use client';

import api from '@/lib/api';
import { AuthUser, useAuthStore } from '@/store/authStore';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Container, Nav, Navbar, Spinner } from 'react-bootstrap';

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
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

      <Container className="py-4">{children}</Container>
    </>
  );
}
