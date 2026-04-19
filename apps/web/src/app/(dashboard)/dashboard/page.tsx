'use client';

<<<<<<< Updated upstream
import { useAuthStore } from '@/store/authStore';
import { Badge, Card, Col, Row } from 'react-bootstrap';
=======
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardData, Lead, Booking } from '@/types/api';
import { styles } from './dashboard.styles';

type Score = 'HIGH' | 'MED' | 'LOW';
type HistoryItem = { month: string; amount: number };
type MetricItem = {
  label: string;
  value: string;
  sub: string;
  dotColor: string;
  subColor: string;
};

const INIT_COLORS: Record<number, { bg: string; color: string }> = {
  0: { bg: '#DBEAFE', color: '#1E40AF' },
  1: { bg: '#D1FAE5', color: '#065F46' },
  2: { bg: '#FEF3C7', color: '#92400E' },
  3: { bg: '#EDE9FE', color: '#5B21B6' },
  4: { bg: '#F3F4F6', color: '#374151' },
};

const EVENT_LABELS: Record<string, string> = {
  WEDDING: 'Wedding', PORTRAIT: 'Portrait', ENGAGEMENT: 'Engagement',
  FAMILY: 'Family', NEWBORN: 'Newborn', CORPORATE: 'Corporate',
};

const BUDGET_LABELS: Record<string, string> = {
  UNDER_200: 'under €200', '200_500': '€200–499',
  '500_1000': '€500+', OVER_1000: '€1,000+',
};

const SCORE_CONFIG: Record<Score, { dot: string; text: string; label: string }> = {
  HIGH: { dot: '#16A34A', text: '#15803D', label: 'High' },
  MED:  { dot: '#D97706', text: '#B45309', label: 'Medium' },
  LOW:  { dot: '#DC2626', text: '#B91C1C', label: 'Low' },
};

const BADGE_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  DEPOSIT:   { bg: '#DCFCE7', color: '#15803D', label: 'Deposit' },
  CONFIRMED: { bg: '#DBEAFE', color: '#1D4ED8', label: 'Confirmed' },
};

const MOCK: DashboardData = {
  overview: {
    revenueApr: 2840,
    revenueMarChange: 18,
    activeBookingsCount: 12,
    newLeadsCount: 5,
    leadsNeedingReply: 2,
    openGalleriesCount: 3,
    expiredGalleriesCount: 1,
  },
  leads: [
    { id: '1', name: 'Maria & Klaus',  email: 'maria@example.com',  eventDate: '2026-06-14', eventType: 'WEDDING',     budgetRange: '500_1000',  score: 'HIGH', status: 'NEW', createdAt: '2026-04-15' },
    { id: '2', name: 'Sophie Richter', email: 'sophie@example.com', eventDate: '2026-05-02', eventType: 'PORTRAIT',    budgetRange: '200_500',   score: 'MED',  status: 'NEW', createdAt: '2026-04-10' },
    { id: '3', name: 'Thomas Müller',  email: 'thomas@example.com', eventDate: '2026-04-25', eventType: 'FAMILY',      budgetRange: 'UNDER_200', score: 'LOW',  status: 'NEW', createdAt: '2026-04-09' },
    { id: '4', name: 'Laura & Ben',    email: 'laura@example.com',  eventDate: '2026-07-20', eventType: 'ENGAGEMENT',  budgetRange: '500_1000',  score: 'HIGH', status: 'NEW', createdAt: '2026-04-08' },
    { id: '5', name: 'Nina Kraft',     email: 'nina@example.com',   eventDate: '2026-04-30', eventType: 'FAMILY',      budgetRange: 'UNDER_200', score: 'LOW',  status: 'NEW', createdAt: '2026-04-07' },
  ],
  bookings: [
    { id: 'b1', clientName: 'Yilmaz & Chen',       clientEmail: 'yilmaz@example.com',  eventDate: '2026-04-22', packageId: 'pkg-wedding',   depositAmount: 300, totalAmount: 1200, depositPercent: 25,  status: 'DEPOSIT',   createdAt: '2026-04-01' },
    { id: 'b2', clientName: 'Braun family',         clientEmail: 'braun@example.com',   eventDate: '2026-04-26', packageId: 'pkg-family',    depositAmount: 150, totalAmount: 450,  depositPercent: 33,  status: 'CONFIRMED', createdAt: '2026-03-15' },
    { id: 'b3', clientName: 'Stefan & Eva',         clientEmail: 'stefan@example.com',  eventDate: '2026-05-03', packageId: 'pkg-wedding',   depositAmount: 450, totalAmount: 1800, depositPercent: 25,  status: 'DEPOSIT',   createdAt: '2026-02-20' },
    { id: 'b4', clientName: 'Portrait — J. Lange',  clientEmail: 'jlange@example.com',  eventDate: '2026-05-10', packageId: 'pkg-portrait',  depositAmount: 0,   totalAmount: 320,  depositPercent: 0,   status: 'DEPOSIT',   createdAt: '2026-04-10' },
    { id: 'b5', clientName: 'Corp. event — Siemens',clientEmail: 'siemens@example.com', eventDate: '2026-05-17', packageId: 'pkg-corporate', depositAmount: 950, totalAmount: 950,  depositPercent: 100, status: 'CONFIRMED', createdAt: '2026-03-20' },
  ],
  galleries: [],
  revenueHistory: [
    { month: 'Nov', amount: 980  },
    { month: 'Dec', amount: 640  },
    { month: 'Jan', amount: 1100 },
    { month: 'Feb', amount: 1450 },
    { month: 'Mar', amount: 2410 },
    { month: 'Apr', amount: 2840 },
  ],
};

function getInitials(name: string): string {
  return name
    .trim()
    .split(/[\s&—]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function formatEventDate(iso: string): { top: string; bottom: string } {
  const d = new Date(iso);
  return {
    top: d.toLocaleString('en-US', { month: 'short' }),
    bottom: String(d.getDate()),
  };
}

function formatCurrency(n: number): string {
  return '€' + n.toLocaleString('de-DE');
}

function bookingSubtitle(b: Booking): string {
  if (b.status === 'CONFIRMED') return 'Fully confirmed';
  if (b.status === 'DEPOSIT' && b.depositAmount > 0) return `${formatCurrency(b.depositAmount)} deposit paid`;
  return 'Awaiting confirmation';
}

function getRowStyle(isLast: boolean): React.CSSProperties {
  return isLast ? { ...styles.row, ...styles.rowLast } : styles.row;
}

interface MetricCardProps {
  label: string;
  value: string;
  sub: string;
  dotColor: string;
  subColor: string;
}

function MetricCard({ label, value, sub, dotColor, subColor }: Readonly<MetricCardProps>) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue}>{value}</div>
      <div style={{ ...styles.metricSub, color: subColor }}>
        <div style={{ ...styles.metricDot, background: dotColor }} />
        {sub}
      </div>
    </div>
  );
}

function LeadRow({ lead, index, isLast }: Readonly<{ lead: Lead; index: number; isLast: boolean }>) {
  const ic = INIT_COLORS[index % 5];
  const sc = SCORE_CONFIG[lead.score as Score];
  const date = new Date(lead.eventDate).toLocaleString('en-US', { month: 'short', day: 'numeric' });
  return (
    <div style={getRowStyle(isLast)} data-row>
      <div style={{ ...styles.initials, background: ic.bg, color: ic.color }}>
        {getInitials(lead.name)}
      </div>
      <div style={styles.rowInfo}>
        <div style={styles.rowName}>{lead.name}</div>
        <div style={styles.rowMeta}>
          {EVENT_LABELS[lead.eventType]} · {date} · {BUDGET_LABELS[lead.budgetRange]}
        </div>
      </div>
      <div style={styles.statusBadgeWrap}>
        <div style={{ ...styles.statusDot, background: sc.dot }} />
        <span style={{ ...styles.statusLabel, color: sc.text }}>{sc.label}</span>
      </div>
    </div>
  );
}

function BookingRow({ booking, isLast }: Readonly<{ booking: Booking; isLast: boolean }>) {
  const router = useRouter();
  const { top, bottom } = formatEventDate(booking.eventDate);
  const bc = BADGE_CONFIG[booking.status === 'CONFIRMED' ? 'CONFIRMED' : 'DEPOSIT'];
  
  return (
    <button
      style={{ ...getRowStyle(isLast), cursor: 'pointer', border: 'none', background: 'transparent', textAlign: 'left' }}
      data-row
      onClick={() => router.push(`/bookings?selected=${booking.id}`)}
    >
      <div style={styles.bookingDate}>
        <span>{top}</span>
        <span style={styles.bookingDateValue}>{bottom}</span>
      </div>
      <div style={styles.rowInfo}>
        <div style={styles.rowName}>{booking.clientName}</div>
        <div style={styles.rowMeta}>{bookingSubtitle(booking)}</div>
      </div>
      <div style={{ ...styles.badge, background: bc.bg, color: bc.color }}>{bc.label}</div>
      <div style={styles.bookingAmount}>{formatCurrency(booking.totalAmount)}</div>
    </button>
  );
}

function RevenueChart({ history }: Readonly<{ history: HistoryItem[] }>) {
  const max = Math.max(...history.map((h) => h.amount));
  return (
    <div style={styles.chartCard}>
      <div style={styles.cardHeader}>
        <span style={styles.cardTitle}>Revenue — last 6 months</span>
        <span style={styles.chartInfo}>April is running total</span>
      </div>
      {history.map((item, i) => {
        const pct = Math.round((item.amount / max) * 100);
        const isCurrent = i === history.length - 1;
        return (
          <div key={item.month} style={styles.barRow}>
            <span style={styles.barLabel}>{item.month}</span>
            <div style={styles.barTrack}>
              <div style={{
                ...styles.barFill,
                width: `${pct}%`,
                background: isCurrent ? '#93C5FD' : '#BFDBFE',
              }} />
            </div>
            <span style={styles.barValue}>
              €{(item.amount / 1000).toFixed(1)}k
            </span>
          </div>
        );
      })}
    </div>
  );
}
>>>>>>> Stashed changes

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
