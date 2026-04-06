'use client';

import { useAuthStore } from '@/store/authStore';
import { Badge, Card, Col, Row } from 'react-bootstrap';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <>
      <div className="mb-4">
        <h4 className="fw-bold mb-1">Welcome back, {user?.fullName ?? user?.email} 👋</h4>
        <p className="text-muted mb-0">
          Studio: <span className="fw-semibold text-dark">{user?.tenant.subdomain}</span>{' '}
          <Badge bg="secondary" className="ms-1">
            {user?.tenant.plan}
          </Badge>
        </p>
      </div>

      <Row className="g-3">
        <Col md={4}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="text-primary fs-3 mb-2">🖼️</div>
              <Card.Title className="fs-6 fw-semibold">Photos</Card.Title>
              <Card.Text className="text-muted small">
                Upload and manage your photo portfolio.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="text-success fs-3 mb-2">📅</div>
              <Card.Title className="fs-6 fw-semibold">Bookings</Card.Title>
              <Card.Text className="text-muted small">
                Track shoot dates and client sessions.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="text-warning fs-3 mb-2">👥</div>
              <Card.Title className="fs-6 fw-semibold">Clients</Card.Title>
              <Card.Text className="text-muted small">
                Manage your client list and galleries.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
}
