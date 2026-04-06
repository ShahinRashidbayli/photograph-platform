'use client';

import api from '@/lib/api';
import { AuthUser, useAuthStore } from '@/store/authStore';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert, Button, Card, Container, Form, Spinner } from 'react-bootstrap';

export default function RegisterPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [form, setForm] = useState({ fullName: '', email: '', password: '', subdomain: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/api/auth/register', form);
      const { data: me } = await api.get<AuthUser>('/api/auth/me');
      setUser(me);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Registration failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-vh-100 bg-light d-flex align-items-center">
      <Container style={{ maxWidth: 480 }}>
        <div className="text-center mb-4">
          <h2 className="fw-bold">📷 Photograph Platform</h2>
          <p className="text-muted">Create your studio account</p>
        </div>

        <Card className="shadow-sm border-0">
          <Card.Body className="p-4">
            <h5 className="mb-4 fw-semibold">Get started</h5>

            {error && (
              <Alert variant="danger" className="py-2">
                {error}
              </Alert>
            )}

            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label>Full name</Form.Label>
                <Form.Control
                  placeholder="Anna Foto"
                  value={form.fullName}
                  onChange={update('fullName')}
                  required
                  autoComplete="name"
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Email address</Form.Label>
                <Form.Control
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={update('email')}
                  required
                  autoComplete="email"
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Password</Form.Label>
                <Form.Control
                  type="password"
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={update('password')}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </Form.Group>

              <Form.Group className="mb-4">
                <Form.Label>Studio subdomain</Form.Label>
                <div className="input-group">
                  <Form.Control
                    placeholder="my-studio"
                    value={form.subdomain}
                    onChange={update('subdomain')}
                    required
                    pattern="^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$"
                    title="3-63 chars, start and end with alphanumeric, hyphens allowed in between"
                  />
                  <span className="input-group-text text-muted">.photographplatform.com</span>
                </div>
                <Form.Text className="text-muted">
                  3-63 lowercase letters, numbers or hyphens. Cannot start or end with a hyphen.
                </Form.Text>
              </Form.Group>

              <Button type="submit" variant="primary" className="w-100" disabled={loading}>
                {loading ? <Spinner animation="border" size="sm" className="me-2" /> : null}
                Create account
              </Button>
            </Form>
          </Card.Body>
        </Card>

        <p className="text-center mt-3 text-muted small">
          Already have an account?{' '}
          <Link href="/login" className="text-decoration-none fw-semibold">
            Sign in
          </Link>
        </p>
      </Container>
    </div>
  );
}
