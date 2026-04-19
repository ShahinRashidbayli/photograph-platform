'use client';

import { useEffect, useMemo, useState } from 'react';
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
  const { top, bottom } = formatEventDate(booking.eventDate);
  const bc = BADGE_CONFIG[booking.status === 'CONFIRMED' ? 'CONFIRMED' : 'DEPOSIT'];
  return (
    <div style={getRowStyle(isLast)} data-row>
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
    </div>
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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setData(MOCK);
    setLoading(false);
  }, []);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      [data-row]:hover {
        background: #F9FAFB !important;
      }
      [data-action]:hover {
        color: #1D4ED8 !important;
        text-decoration: underline;
      }
    `;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);

  const today = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    [],
  );

  const metrics = useMemo<MetricItem[]>(
    () => {
      if (!data) {
        return [];
      }

      const { overview } = data;
      return [
        {
          label: 'Revenue (April)',
          value: formatCurrency(overview.revenueApr),
          sub: `+${overview.revenueMarChange}% vs March`,
          dotColor: '#16A34A',
          subColor: '#15803D',
        },
        {
          label: 'Active bookings',
          value: String(overview.activeBookingsCount),
          sub: '3 this week',
          dotColor: '#9CA3AF',
          subColor: '#9CA3AF',
        },
        {
          label: 'New leads',
          value: String(overview.newLeadsCount),
          sub: `${overview.leadsNeedingReply} awaiting reply`,
          dotColor: '#DC2626',
          subColor: '#DC2626',
        },
        {
          label: 'Open galleries',
          value: String(overview.openGalleriesCount),
          sub: `${overview.expiredGalleriesCount} expiring soon`,
          dotColor: '#DC2626',
          subColor: '#DC2626',
        },
      ];
    },
    [data],
  );

  if (loading) {
    return (
      <div style={styles.loadingWrapper}>
        <div style={styles.loadingLabel}>Loading…</div>
      </div>
    );
  }

  if (!data) return null;

  const { leads, bookings, revenueHistory } = data;

  return (
    <div style={styles.main}>
      {/* Topbar */}
      <header style={styles.topbar}>
        <div>
          <h1 style={styles.pageTitle}>Overview</h1>
          <p style={styles.pageDate}>{today}</p>
        </div>
        <button style={styles.btnNew}>+ New booking</button>
      </header>

      {/* Scrollable body */}
      <div style={styles.body}>

        {/* Metrics */}
        <div style={styles.metricsGrid}>
          {metrics.map((m) => <MetricCard key={m.label} {...m} />)}
        </div>

        {/* Two-column: Leads + Bookings */}
        <div style={styles.twoCol}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.cardTitle}>New leads</span>
              <span style={styles.cardAction} data-action>View all</span>
            </div>
            <div style={styles.cardList}>
              {leads.map((lead, i) => (
                <LeadRow key={lead.id} lead={lead} index={i} isLast={i === leads.length - 1} />
              ))}
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.cardTitle}>Upcoming bookings</span>
              <span style={styles.cardAction} data-action>Calendar</span>
            </div>
            <div style={styles.cardList}>
              {bookings.map((b, i) => (
                <BookingRow key={b.id} booking={b} isLast={i === bookings.length - 1} />
              ))}
            </div>
          </div>
        </div>

        {/* Revenue chart */}
        <RevenueChart history={revenueHistory} />

      </div>
    </div>
  );
}
