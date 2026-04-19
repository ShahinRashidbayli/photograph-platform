'use client';

import { DashboardData, Lead, Booking } from '@/types/api';
import { useEffect, useState } from 'react';
import { Spinner } from 'react-bootstrap';
import { format, parseISO } from 'date-fns';

const mockDashboardData: DashboardData = {
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
    { id: '1', name: 'Maria & Klaus', email: 'maria@example.com', eventDate: '2026-06-14', eventType: 'WEDDING', budgetRange: '500_1000', score: 'HIGH', status: 'NEW', createdAt: '2026-04-15' },
    { id: '2', name: 'Sophie Richter', email: 'sophie@example.com', eventDate: '2026-05-02', eventType: 'PORTRAIT', budgetRange: '200_500', score: 'MED', status: 'NEW', createdAt: '2026-04-10' },
    { id: '3', name: 'Laura & Ben', email: 'laura@example.com', eventDate: '2026-07-20', eventType: 'ENGAGEMENT', budgetRange: '500_1000', score: 'HIGH', status: 'NEW', createdAt: '2026-04-09' },
  ],
  bookings: [
    { id: 'b1', clientName: 'Yilmaz & Chen', clientEmail: 'yilmaz@example.com', eventDate: '2026-04-22', packageId: 'pkg-wedding', depositAmount: 300, totalAmount: 1200, depositPercent: 25, status: 'DEPOSIT', createdAt: '2026-04-01' },
    { id: 'b2', clientName: 'Braun family', clientEmail: 'braun@example.com', eventDate: '2026-04-26', packageId: 'pkg-family', depositAmount: 150, totalAmount: 450, depositPercent: 33, status: 'CONFIRMED', createdAt: '2026-03-15' },
    { id: 'b3', clientName: 'Stefan & Eva', clientEmail: 'stefan@example.com', eventDate: '2026-05-03', packageId: 'pkg-wedding', depositAmount: 450, totalAmount: 1800, depositPercent: 25, status: 'DEPOSIT', createdAt: '2026-02-20' },
  ],
  galleries: [
    { id: 'g1', clientName: 'Müller', eventType: 'WEDDING', photoCount: 250, isPublished: true, expiresAt: '2026-05-15', createdAt: '2026-04-15' },
    { id: 'g2', clientName: 'Schmidt', eventType: 'PORTRAIT', photoCount: 45, isPublished: true, expiresAt: '2026-04-25', createdAt: '2026-04-15' },
    { id: 'g3', clientName: 'Weber', eventType: 'FAMILY', photoCount: 120, isPublished: false, expiresAt: '2026-06-01', createdAt: '2026-04-01' },
  ],
  revenueHistory: [
    { month: 'Nov', amount: 980 },
    { month: 'Dec', amount: 640 },
    { month: 'Jan', amount: 1100 },
    { month: 'Feb', amount: 1450 },
    { month: 'Mar', amount: 2410 },
    { month: 'Apr', amount: 2840 },
  ],
};

const LEAD_SCORE_STYLE: Record<string, { background: string; color: string }> = {
  HIGH: { background: '#FEF2F2', color: '#991b1b' },
  MED:  { background: '#FFFBEB', color: '#92400e' },
  LOW:  { background: '#F0FDF4', color: '#166534' },
};

const BOOKING_STATUS_STYLE: Record<string, { background: string; color: string }> = {
  DEPOSIT:   { background: '#FFFBEB', color: '#92400e' },
  CONFIRMED: { background: '#F0FDF4', color: '#166534' },
};

function getInitials(name: string) {
  const parts = name.trim().split(/[\s&]+/).filter(Boolean);
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function eventTypeLabel(et: string) {
  const map: Record<string, string> = { WEDDING: 'Wedding', PORTRAIT: 'Portrait', ENGAGEMENT: 'Engagement', FAMILY: 'Family' };
  return map[et] ?? et;
}

const INIT_COLORS = [
  { bg: '#E6F1FB', color: '#0C447C' },
  { bg: '#E1F5EE', color: '#085041' },
  { bg: '#EEEDFE', color: '#3C3489' },
  { bg: '#FAEEDA', color: '#633806' },
];

const s = {
  card: {
    background: 'var(--color-background-primary)',
    border: '1px solid var(--color-border-secondary)',
    borderRadius: 'var(--border-radius-lg)',
    padding: '16px',
    boxShadow: 'var(--shadow-sm)',
  } as React.CSSProperties,
  cardTitle: {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--color-text-tertiary)',
    marginBottom: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  } as React.CSSProperties,
  row: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px', borderBottom: '0.5px solid var(--color-border-tertiary)', margin: '0 -6px' } as React.CSSProperties,
  rowLast: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px', margin: '0 -6px' } as React.CSSProperties,
  name: { fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 } as React.CSSProperties,
  sub: { fontSize: 11, color: 'var(--color-text-tertiary)', margin: 0 } as React.CSSProperties,
  badge: { fontSize: 10, padding: '3px 8px', borderRadius: 20, fontWeight: 600, flexShrink: 0, letterSpacing: '0.03em' } as React.CSSProperties,
  amt: { fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', marginLeft: 'auto', flexShrink: 0 } as React.CSSProperties,
};

function LeadRow({ lead, index, isLast }: Readonly<{ lead: Lead; index: number; isLast: boolean }>) {
  const ic = INIT_COLORS[index % INIT_COLORS.length];
  const sc = LEAD_SCORE_STYLE[lead.score] ?? LEAD_SCORE_STYLE.LOW;
  return (
    <div className="list-row" style={isLast ? s.rowLast : s.row}>
      <div style={{ width: 30, height: 30, borderRadius: '50%', background: ic.bg, color: ic.color, border: `1px solid ${ic.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0, letterSpacing: '0.02em' }}>
        {getInitials(lead.name)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={s.name}>{lead.name}</p>
        <p style={s.sub}>{eventTypeLabel(lead.eventType)} · {format(parseISO(lead.eventDate), 'MMM d')}</p>
      </div>
      <span style={{ ...s.badge, ...sc }}>{lead.score}</span>
    </div>
  );
}

function BookingRow({ booking, isLast }: Readonly<{ booking: Booking; isLast: boolean }>) {
  const sc = BOOKING_STATUS_STYLE[booking.status] ?? BOOKING_STATUS_STYLE.CONFIRMED;
  return (
    <div className="list-row" style={isLast ? s.rowLast : s.row}>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)', width: 44, flexShrink: 0 }}>
        {format(parseISO(booking.eventDate), 'MMM d')}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={s.name}>{booking.clientName}</p>
        <p style={s.sub}>{booking.status === 'DEPOSIT' ? `€${booking.depositAmount} deposit paid` : 'Fully confirmed'}</p>
      </div>
      <span style={{ ...s.badge, ...sc }}>{booking.status === 'DEPOSIT' ? 'Deposit' : 'Confirmed'}</span>
      <span style={s.amt}>€{booking.totalAmount.toLocaleString()}</span>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setData(mockDashboardData);
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <Spinner animation="border" />
      </div>
    );
  }

  if (!data) return null;

  const { overview, leads, bookings, revenueHistory } = data;
  const maxRevenue = Math.max(...revenueHistory.map((h) => h.amount));

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`
        .list-row { border-radius: 6px; transition: background 0.1s; }
        .list-row:hover { background: var(--color-background-secondary); }
        .bar-fill { transition: width 0.5s ease; }
      `}</style>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid var(--color-border-tertiary)', flexShrink: 0, background: 'var(--color-background-primary)' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>Overview</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 1 }}>{format(new Date(), 'EEEE, MMMM d, yyyy')}</div>
        </div>
        <button style={{ padding: '8px 16px', borderRadius: 'var(--border-radius-md)', border: 'none', background: '#185FA5', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 3px rgba(24,95,165,0.35)', letterSpacing: '0.01em' }}>
          + New booking
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* KPI metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {/* Primary KPI — Revenue */}
          <div style={{ background: 'var(--color-background-primary)', border: '1px solid #C4DCEF', borderRadius: 'var(--border-radius-md)', padding: '16px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Revenue (Apr)</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#185FA5', lineHeight: 1, letterSpacing: '-0.02em' }}>€{overview.revenueApr.toLocaleString()}</div>
            <div style={{ fontSize: 11, marginTop: 6, color: 'var(--color-text-success)', fontWeight: 600 }}>↑ {overview.revenueMarChange}% vs March</div>
          </div>
          {/* Secondary KPIs */}
          {[
            { label: 'Active bookings', value: String(overview.activeBookingsCount), sub: '3 this week', subColor: 'var(--color-text-success)' },
            { label: 'New leads', value: String(overview.newLeadsCount), sub: `${overview.leadsNeedingReply} need reply`, subColor: 'var(--color-text-danger)' },
            { label: 'Open galleries', value: String(overview.openGalleriesCount), sub: `${overview.expiredGalleriesCount} expiring`, subColor: 'var(--color-text-danger)' },
          ].map((m) => (
            <div key={m.label} style={{ background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)', padding: '16px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{m.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-secondary)', letterSpacing: '-0.01em' }}>{m.value}</div>
              <div style={{ fontSize: 11, marginTop: 6, color: m.subColor, fontWeight: 500 }}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Leads + Bookings */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={s.card}>
            <div style={s.cardTitle}>New leads</div>
            {leads.map((lead, i) => (
              <LeadRow key={lead.id} lead={lead} index={i} isLast={i === leads.length - 1} />
            ))}
          </div>
          <div style={s.card}>
            <div style={s.cardTitle}>Upcoming bookings</div>
            {bookings.map((booking, i) => (
              <BookingRow key={booking.id} booking={booking} isLast={i === bookings.length - 1} />
            ))}
          </div>
        </div>

        {/* Revenue chart */}
        <div style={s.card}>
          <div style={s.cardTitle}>Revenue — last 6 months</div>
          {revenueHistory.map((item, idx) => (
            <div key={item.month} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: idx === revenueHistory.length - 1 ? 0 : 10 }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)', width: 28, textAlign: 'right', flexShrink: 0 }}>{item.month}</span>
              <div style={{ flex: 1, height: 20, borderRadius: 4, background: 'var(--color-background-secondary)', overflow: 'hidden' }}>
                <div
                  className="bar-fill"
                  style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #7AB8F0 0%, #185FA5 100%)', width: `${Math.round((item.amount / maxRevenue) * 100)}%` }}
                />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#0C447C', width: 48, textAlign: 'right', flexShrink: 0 }}>€{item.amount >= 1000 ? `${(item.amount / 1000).toFixed(1)}k` : item.amount}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
