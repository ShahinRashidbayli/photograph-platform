'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import Link from 'next/link';
import React from 'react';
import api from '@/lib/api';
import { Booking, Lead } from '@/types/api';
import { formatMonthAbbrUpper } from '@/lib/helpers';

const themeColors = {
  light: {
    bg: '#F9FAFB',
    cardBg: '#FFFFFF',
    text: '#111827',
    subText: '#6B7280',
    border: '#E5E7EB',
    hover: '#F3F4F6',
  },
  dark: {
    bg: '#111827',
    cardBg: '#1F2937',
    text: '#F3F4F6',
    subText: '#D1D5DB',
    border: '#374151',
    hover: '#334155',
  },
};

const statusStyles: Record<string, { bg: string; text: string }> = {
  CONFIRMED: { bg: '#D1FAE5', text: '#065F46' },
  DEPOSIT_PAID: { bg: '#FEF3C7', text: '#92400E' },
  FULLY_PAID: { bg: '#DBEAFE', text: '#0284C7' },
  ENQUIRY: { bg: '#F3E8FF', text: '#7C3AED' },
  COMPLETED: { bg: '#E0E7FF', text: '#4338CA' },
  CANCELLED: { bg: '#FECACA', text: '#DC2626' },
};

const scoreColors = {
  HIGH: { badge: '#DCFCE7', text: '#15803D', label: 'High Priority' },
  MED: { badge: '#FEF9C3', text: '#854D0E', label: 'Medium Priority' },
  LOW: { badge: '#FEE2E2', text: '#991B1B', label: 'Low Priority' },
};

function MetricCard({ label, value, trend, sub, colors }: any) {
  return (
    <div style={{
      background: colors.cardBg,
      border: `1px solid ${colors.border}`,
      borderRadius: '12px',
      padding: '20px',
      flex: 1,
      minWidth: '200px',
    }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: colors.subText, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ fontSize: '28px', fontWeight: 800, color: colors.text, letterSpacing: '-0.01em', marginBottom: '4px' }}>
        {value}
      </div>
      {trend && (
        <div style={{ fontSize: '12px', color: '#10B981', fontWeight: 600 }}>
          {trend} <span style={{ color: colors.subText, fontWeight: 500 }}>{sub}</span>
        </div>
      )}
    </div>
  );
}

function BookingCard({ booking, colors }: any) {
  const statusStyle = statusStyles[booking.status] || statusStyles.ENQUIRY;
  const dateObj = new Date(booking.eventDate);
  const month = formatMonthAbbrUpper(dateObj);
  const day = dateObj.getDate();
  const totalAmount = Math.round((booking.totalAmountCents || 0) / 100);

  return (
    <div
      style={{
        background: colors.cardBg,
        border: `1px solid ${colors.border}`,
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        gap: '14px',
        alignItems: 'flex-start',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = colors.hover;
        e.currentTarget.style.borderColor = '#2563EB';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = colors.cardBg;
        e.currentTarget.style.borderColor = colors.border;
      }}
    >
      {/* Date Box */}
      <div style={{
        background: 'rgba(37, 99, 235, 0.1)',
        border: '1px solid rgba(37, 99, 235, 0.2)',
        borderRadius: '10px',
        padding: '10px 12px',
        textAlign: 'center',
        minWidth: '56px',
      }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#2563EB', letterSpacing: '0.05em' }}>
          {month}
        </div>
        <div style={{ fontSize: '16px', fontWeight: 800, color: '#2563EB' }}>
          {day}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: colors.text, marginBottom: '4px' }}>
          {booking.clientName}
        </div>
        <div style={{ fontSize: '12px', color: colors.subText, marginBottom: '8px' }}>
          {booking.eventType || 'Event'}
        </div>
        <div style={{
          display: 'inline-block',
          background: statusStyle.bg,
          color: statusStyle.text,
          padding: '4px 10px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: 700,
        }}>
          {booking.status === 'CONFIRMED' ? '✓ Confirmed' : booking.status === 'FULLY_PAID' ? '✓ Paid' : '⏳ Pending'}
        </div>
      </div>

      {/* Amount */}
      <div style={{ textAlign: 'right', minWidth: '110px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: colors.text }}>
          €{totalAmount.toLocaleString()}
        </div>
        <div style={{ fontSize: '11px', color: colors.subText, marginTop: '2px' }}>
          {booking.status === 'FULLY_PAID' || booking.status === 'COMPLETED' ? 'Paid' : 'Pending'}
        </div>
      </div>
    </div>
  );
}

function LeadCard({ lead, colors }: any) {
  const scoreKey = (lead.score || 'LOW') as keyof typeof scoreColors;
  const scoreStyle = scoreColors[scoreKey];
  const budgetLabel = lead.budgetRange === 'OVER_1000' ? '€1000+' : lead.budgetRange === '500_1000' ? '€500–999' : lead.budgetRange === '200_500' ? '€200–499' : 'under €200';

  return (
    <div
      style={{
        background: colors.cardBg,
        border: `1px solid ${colors.border}`,
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = colors.hover;
        e.currentTarget.style.borderColor = scoreStyle.text;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = colors.cardBg;
        e.currentTarget.style.borderColor = colors.border;
      }}
    >
      {/* Priority Dot */}
      <div style={{
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        background: scoreStyle.text,
        flexShrink: 0,
        marginTop: '4px',
      }} />

      {/* Content */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: colors.text, marginBottom: '4px' }}>
          {lead.name}
        </div>
        <div style={{ fontSize: '12px', color: colors.subText, marginBottom: '8px' }}>
          {lead.eventType}
        </div>
        <div style={{
          display: 'inline-block',
          background: scoreStyle.badge,
          color: scoreStyle.text,
          padding: '4px 10px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: 700,
        }}>
          {scoreStyle.label}
        </div>
      </div>

      {/* Budget */}
      <div style={{ textAlign: 'right', minWidth: '100px', fontSize: '11px', color: colors.subText, fontWeight: 500 }}>
        {budgetLabel}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const colors = themeColors[theme];

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);

  // Check if customer or photographer
  const isPhotographer = user?.role?.toUpperCase() === 'PHOTOGRAPHER' || user?.role?.toUpperCase() === 'ADMIN';

  useEffect(() => {
    if (!isPhotographer) return;
    Promise.all([
      api.get<Booking[]>('/api/bookings?size=3'),
      api.get<Lead[]>('/api/leads?size=5&sort=createdAt,desc'),
    ])
      .then(([bookingsRes, leadsRes]) => {
        setBookings(bookingsRes.data);
        setLeads(leadsRes.data);
      })
      .catch(() => {
        // Handle error silently
      });
  }, [isPhotographer]);

  const stats = {
    bookingsThisMonth: bookings.length,
    bookingsChange: bookings.length > 0 ? '+18%' : '0%',
    revenueApr: Math.round(bookings.reduce((sum, b) => sum + (b.totalAmountCents || 0), 0) / 100),
    revenueChange: '+12%',
    activeClients: bookings.length,
    newClients: leads.length,
    newLeads: leads.filter(l => l.score === 'HIGH').length,
  };

  const upcomingBookings = bookings.slice(0, 3);
  const recentLeads = leads.slice(0, 3);

  if (!isPhotographer) {
    // Customer dashboard
    return (
      <div style={{ padding: '22px', background: colors.bg, minHeight: 'calc(100vh - 80px)', transition: 'background 0.3s ease' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: colors.text, margin: '0 0 4px 0' }}>
              Welcome back, {user?.fullName?.split(' ')[0]}! 👋
            </h1>
            <p style={{ fontSize: '13px', color: colors.subText, margin: 0 }}
            >
              Your sessions with Anna Müller
            </p>
          </div>

          {/* Simplified Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            <MetricCard label="Upcoming Sessions" value="1" sub="Next: Jun 14" colors={colors} />
            <MetricCard label="Photos Delivered" value="48" sub="ready to download" colors={colors} />
            <MetricCard label="Total Spent" value="€350" sub="all sessions" colors={colors} />
          </div>

          {/* View Portfolio Link */}
          <div style={{ textAlign: 'center' }}>
            <Link
              href="/portfolio"
              style={{
                display: 'inline-block',
                padding: '12px 28px',
                background: '#2563EB',
                color: '#FFFFFF',
                textDecoration: 'none',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '14px',
                transition: 'background 0.2s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#1d4ed8'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#2563EB'; }}
            >
              📸 View Portfolio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Photographer dashboard
  return (
    <div style={{ padding: '22px', background: colors.bg, minHeight: 'calc(100vh - 80px)', transition: 'background 0.3s ease, color 0.3s ease' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Page Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: colors.text, margin: '0 0 4px 0' }}>
            Welcome back, {user?.fullName?.split(' ')[0]}! 👋
          </h1>
          <p style={{ fontSize: '13px', color: colors.subText, margin: 0 }}>
            Your studio overview
          </p>
        </div>

        {/* Metric Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}>
          <MetricCard
            label="Bookings (April)"
            value={stats.bookingsThisMonth}
            trend={`↑ ${stats.bookingsChange}`}
            sub="from last month"
            colors={colors}
          />
          <MetricCard
            label="Revenue (April)"
            value={`€${stats.revenueApr}`}
            trend={`↑ ${stats.revenueChange}`}
            sub="from last month"
            colors={colors}
          />
          <MetricCard
            label="Active Clients"
            value={stats.activeClients}
            trend={`${stats.newClients} new`}
            sub="this month"
            colors={colors}
          />
          <MetricCard
            label="New Leads"
            value={stats.newLeads}
            trend="3 high priority"
            sub="need follow-up"
            colors={colors}
          />
        </div>

        {/* Two Column Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Upcoming Bookings */}
          <div style={{
            background: colors.cardBg,
            border: `1px solid ${colors.border}`,
            borderRadius: '16px',
            padding: '24px',
            transition: 'all 0.3s ease',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: colors.text, margin: 0 }}>
                📅 Upcoming Bookings
              </h2>
              <Link
                href="/bookings"
                style={{
                  fontSize: '12px',
                  color: '#2563EB',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                View all →
              </Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {upcomingBookings.length > 0 ? (
                upcomingBookings.map((booking) => (
                  <Link
                    key={booking.id}
                    href="/bookings"
                    style={{ textDecoration: 'none' }}
                  >
                    <BookingCard booking={booking} colors={colors} />
                  </Link>
                ))
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '32px 0',
                  color: colors.subText,
                  fontSize: '14px',
                }}>
                  No upcoming bookings
                </div>
              )}
            </div>
          </div>

          {/* Recent Leads */}
          <div style={{
            background: colors.cardBg,
            border: `1px solid ${colors.border}`,
            borderRadius: '16px',
            padding: '24px',
            transition: 'all 0.3s ease',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: colors.text, margin: 0 }}>
                🔥 Recent Leads
              </h2>
              <Link
                href="/leads"
                style={{
                  fontSize: '12px',
                  color: '#2563EB',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                View all →
              </Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentLeads.length > 0 ? (
                recentLeads.map((lead) => (
                  <Link
                    key={lead.id}
                    href="/leads"
                    style={{ textDecoration: 'none' }}
                  >
                    <LeadCard lead={lead} colors={colors} />
                  </Link>
                ))
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '32px 0',
                  color: colors.subText,
                  fontSize: '14px',
                }}>
                  No recent leads
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginTop: '24px',
          justifyContent: 'center',
        }}>
          <Link
            href="/bookings"
            style={{
              padding: '12px 24px',
              background: '#2563EB',
              color: '#FFFFFF',
              textDecoration: 'none',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '14px',
              transition: 'background 0.2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#1d4ed8'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#2563EB'; }}
          >
            + New Booking
          </Link>
          <Link
            href="/portfolio"
            style={{
              padding: '12px 24px',
              background: colors.hover,
              color: colors.text,
              textDecoration: 'none',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '14px',
              border: `1px solid ${colors.border}`,
              transition: 'all 0.2s ease',
            }}
          >
            📸 Manage Portfolio
          </Link>
        </div>
      </div>
    </div>
  );
}
