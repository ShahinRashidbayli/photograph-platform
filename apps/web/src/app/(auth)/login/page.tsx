'use client'

import api from '@/lib/api'
import { AuthUser, useAuthStore } from '@/store/authStore'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Alert, Button, Card, Container, Form, Spinner } from 'react-bootstrap'

export default function LoginPage() {
  const router = useRouter()
  const setUser = useAuthStore((s) => s.setUser)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/api/auth/login', { email, password })
      const { data: me } = await api.get<AuthUser>('/api/auth/me')
      setUser(me)
      router.push('/dashboard')
    } catch {
      setError('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-vh-100 bg-light d-flex align-items-center">
      <Container style={{ maxWidth: 440 }}>
        <div className="text-center mb-4">
          <h2 className="fw-bold">📷 Photograph Platform</h2>
          <p className="text-muted">Sign in to your studio</p>
        </div>

        <Card className="shadow-sm border-0">
          <Card.Body className="p-4">
            <h5 className="mb-4 fw-semibold">Welcome back</h5>

            {error && <Alert variant="danger" className="py-2">{error}</Alert>}

            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label>Email address</Form.Label>
                <Form.Control
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </Form.Group>

              <Form.Group className="mb-4">
                <Form.Label>Password</Form.Label>
                <Form.Control
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </Form.Group>

              <Button type="submit" variant="primary" className="w-100" disabled={loading}>
                {loading ? <Spinner animation="border" size="sm" className="me-2" /> : null}
                Sign in
              </Button>
            </Form>
          </Card.Body>
        </Card>

        <p className="text-center mt-3 text-muted small">
          No account?{' '}
          <Link href="/register" className="text-decoration-none fw-semibold">
            Create one
          </Link>
        </p>
      </Container>
    </div>
  )
}
