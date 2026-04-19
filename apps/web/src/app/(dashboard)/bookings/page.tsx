'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Booking } from '@/types/api';
import { bookingStyles as styles } from './bookings.styles';

type BookingStatus = 'All' | 'Deposit' | 'Confirmed' | 'Pending';
type TimelineEvent = {
  title: string;
  date: string;
  completed: boolean;
};

const MOCK_BOOKINGS: Booking[] = [
  {
    id: 'b1',
    clientName: 'Yilmaz & Chen',
    clientEmail: 'yilmaz@example.com',
    eventDate: '2026-04-22',
    packageId: 'pkg-wedding',
    depositAmount: 300,
    totalAmount: 1200,
    depositPercent: 25,
    status: 'DEPOSIT',
    createdAt: '2026-04-01',
  },
  {
    id: 'b2',
    clientName: 'Braun family',
    clientEmail: 'braun@example.com',
    eventDate: '2026-04-26',
    packageId: 'pkg-family',
    depositAmount: 150,
    totalAmount: 450,
    depositPercent: 33,
    status: 'CONFIRMED',
    createdAt: '2026-03-15',
  },
  {
    id: 'b3',
    clientName: 'Stefan & Eva',
    clientEmail: 'stefan@example.com',
    eventDate: '2026-05-03',
    packageId: 'pkg-wedding',
    depositAmount: 450,
    totalAmount: 1800,
    depositPercent: 25,
    status: 'DEPOSIT',
    createdAt: '2026-02-20',
  },
  {
    id: 'b4',
    clientName: 'Portrait — J. Lange',
    clientEmail: 'jlange@example.com',
    eventDate: '2026-05-10',
    packageId: 'pkg-portrait',
    depositAmount: 0,
    totalAmount: 320,
    depositPercent: 0,
    status: 'DEPOSIT',
    createdAt: '2026-04-10',
  },
  {
    id: 'b5',
    clientName: 'Corp. event — Siemens',
    clientEmail: 'siemens@example.com',
    eventDate: '2026-05-17',
    packageId: 'pkg-corporate',
    depositAmount: 950,
    totalAmount: 950,
    depositPercent: 100,
    status: 'CONFIRMED',
    createdAt: '2026-03-20',
  },
];

const TIMELINE_EVENTS: Record<string, TimelineEvent[]> = {
  b1: [
    { title: 'Inquiry received', date: 'Apr 10', completed: true },
    { title: 'Contract sent', date: 'Apr 11', completed: true },
    { title: 'Deposit paid', date: 'Apr 15', completed: true },
    { title: 'Session day', date: 'Apr 22', completed: false },
    { title: 'Photos delivered', date: 'May 6', completed: false },
  ],
  b2: [
    { title: 'Inquiry received', date: 'Mar 10', completed: true },
    { title: 'Contract sent', date: 'Mar 12', completed: true },
    { title: 'Full payment', date: 'Mar 20', completed: true },
    { title: 'Session day', date: 'Apr 26', completed: false },
    { title: 'Photos delivered', date: 'May 10', completed: false },
  ],
  b3: [
    { title: 'Inquiry received', date: 'Feb 15', completed: true },
    { title: 'Contract sent', date: 'Feb 18', completed: true },
    { title: 'Deposit paid', date: 'Mar 01', completed: true },
    { title: 'Session day', date: 'May 03', completed: false },
    { title: 'Photos delivered', date: 'May 17', completed: false },
  ],
  b4: [
    { title: 'Inquiry received', date: 'Apr 10', completed: true },
    { title: 'Contract sent', date: 'Apr 11', completed: true },
    { title: 'Awaiting deposit', date: 'Apr 12', completed: false },
    { title: 'Session day', date: 'May 10', completed: false },
    { title: 'Photos delivered', date: 'May 24', completed: false },
  ],
  b5: [
    { title: 'Inquiry received', date: 'Mar 15', completed: true },
    { title: 'Contract sent', date: 'Mar 18', completed: true },
    { title: 'Full payment', date: 'Mar 25', completed: true },
    { title: 'Session day', date: 'May 17', completed: false },
    { title: 'Photos delivered', date: 'Jun 01', completed: false },
  ],
};

const BOOKING_NOTES: Record<string, string> = {
  b1: 'Wedding ceremony at St. Michael Church, reception at Hotel Adlon. 6 hours coverage. Standard package.',
  b2: 'Family portrait session. Studio location. 2 hours, includes 50 edited photos.',
  b3: 'Wedding - ceremony and reception. 8 hours coverage. Premium package with album and prints.',
  b4: 'Business headshots + LinkedIn profile. 2h session. Studio, Frankfurt.',
  b5: 'Corporate event - Siemens annual conference. 4 hours coverage, full team.',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  'pkg-wedding': 'Wedding',
  'pkg-family': 'Family Session',
  'pkg-portrait': 'Portrait Session',
  'pkg-corporate': 'Corporate Event',
};

const CONTACT_INFO: Record<string, { phone: string; location: string }> = {
  b1: { phone: '+49 176 333 2211', location: 'Berlin, Germany' },
  b2: { phone: '+49 162 444 3322', location: 'Munich, Germany' },
  b3: { phone: '+49 178 555 4433', location: 'Vienna, Austria' },
  b4: { phone: '+49 151 666 5544', location: 'Studio, Frankfurt' },
  b5: { phone: '+49 175 777 6655', location: 'Siemens HQ, Munich' },
};

function formatCurrency(value: number): string {
  return `€${value.toLocaleString('de-DE')}`;
}

function formatEventDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric' });
}

function BookingListItem({
  booking,
  isActive,
  onSelect,
}: Readonly<{ booking: Booking; isActive: boolean; onSelect: () => void }>) {
  const badgeConfig = {
    DEPOSIT: { bg: '#FEF3C7', color: '#92400E', label: 'Deposit' },
    CONFIRMED: { bg: '#DBEAFE', color: '#1D4ED8', label: 'Confirmed' },
  };
  const badge = badgeConfig[booking.status as keyof typeof badgeConfig] || badgeConfig.DEPOSIT;

  const statusText = booking.depositAmount > 0 ? 'Deposit paid' : 'Awaiting deposit';

  return (
    <button
      style={{
        ...styles.listItem,
        ...(isActive ? styles.listItemActive : {}),
        border: 'none',
        background: 'transparent',
        textAlign: 'left',
        cursor: 'pointer',
      }}
      onClick={onSelect}
    >
      <div style={styles.listItemDate}>
        <span>{new Date(booking.eventDate).toLocaleString('en-US', { month: 'short' })}</span>
        <span style={styles.listItemDateValue}>{new Date(booking.eventDate).toLocaleString('en-US', { day: '2-digit' })}</span>
      </div>
      <div style={styles.listItemContent}>
        <div style={styles.listItemName}>{booking.clientName}</div>
        <div style={styles.listItemMeta}>{EVENT_TYPE_LABELS[booking.packageId] || 'Event'} · {statusText}</div>
      </div>
      <div style={styles.listItemRight}>
        <div style={styles.listItemAmount}>{formatCurrency(booking.totalAmount)}</div>
        <span
          style={{
            ...styles.listItemBadge,
            background: badge.bg,
            color: badge.color,
          }}
        >
          {badge.label}
        </span>
      </div>
    </button>
  );
}

function BookingDetail({ booking }: Readonly<{ booking: Booking | null }>) {
  if (!booking) {
    return <div style={styles.emptyState}>Booking detail</div>;
  }

  const eventDate = formatEventDate(booking.eventDate);
  const eventType = EVENT_TYPE_LABELS[booking.packageId] || 'Event';
  const contactInfo = CONTACT_INFO[booking.id] || { phone: 'N/A', location: 'N/A' };
  const timeline = TIMELINE_EVENTS[booking.id] || [];
  const notes = BOOKING_NOTES[booking.id] || '';
  const statusConfig = {
    DEPOSIT: {
      bg: '#DCFCE7',
      color: '#15803D',
      label: 'Deposit Pending',
    },
    CONFIRMED: { bg: '#D1FAE5', color: '#065F46', label: 'Confirmed' },
  };
  const status = statusConfig[booking.status as keyof typeof statusConfig] || statusConfig.DEPOSIT;
  const remaining = booking.totalAmount - booking.depositAmount;

  return (
    <>
      {/* Header */}
      <div style={styles.detailHeader}>
        <div>
          <div style={styles.detailTitle}>{booking.clientName}</div>
          <div style={styles.detailSubtitle}>{eventType} Session · {eventDate}</div>
        </div>
        <div style={styles.detailActions}>
          <button style={styles.actionButton}>Edit</button>
          <button style={{ ...styles.actionButton, ...styles.actionButtonPrimary }}>
            Send message
          </button>
          <button style={{ ...styles.actionButton, ...styles.actionButtonDanger }}>Cancel</button>
        </div>
      </div>

      {/* Body */}
      <div style={styles.detailBody}>
        {/* Client Info */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Client Info</div>
          <div style={styles.infoGrid}>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Name</span>
              <span style={styles.infoValue}>{booking.clientName}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Email</span>
              <span style={styles.infoValue}>{booking.clientEmail}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Phone</span>
              <span style={styles.infoValue}>{contactInfo.phone}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Location</span>
              <span style={styles.infoValue}>{contactInfo.location}</span>
            </div>
          </div>
        </div>

        {/* Payment */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Payment</div>
          <div style={styles.paymentGrid}>
            <div style={styles.paymentItem}>
              <span style={styles.paymentLabel}>Total</span>
              <span style={styles.paymentValue}>{formatCurrency(booking.totalAmount)}</span>
            </div>
            <div style={styles.paymentItem}>
              <span style={styles.paymentLabel}>Status</span>
              <span
                style={{
                  ...styles.paymentStatus,
                  ...(booking.status === 'CONFIRMED'
                    ? styles.paymentStatusConfirmed
                    : styles.paymentStatusPending),
                }}
              >
                {status.label}
              </span>
            </div>
            {booking.depositAmount > 0 && (
              <div style={{ ...styles.paymentItem, gridColumn: '1 / -1' }}>
                <div style={styles.depositBarLabel}>
                  <span style={styles.infoLabel}>Deposit paid</span>
                  <span style={styles.depositBarValue}>{booking.depositPercent}%</span>
                </div>
                <div style={styles.depositBar}>
                  <div style={styles.depositBarTrack}>
                    <div
                      style={{
                        ...styles.depositBarFill,
                        width: `${booking.depositPercent}%`,
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6B7280' }}>
                    <span>{formatCurrency(booking.depositAmount)} paid</span>
                    <span>{formatCurrency(remaining)} remaining</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Notes</div>
          <div style={styles.notesBox}>{notes}</div>
        </div>

        {/* Timeline */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Timeline</div>
          <div style={styles.timeline}>
            {timeline.map((event, index) => (
              <div key={`${event.title}-${index}`} style={{ ...styles.timelineItem, position: 'relative' }}>
                {index < timeline.length - 1 && <div style={styles.timelineLine} />}
                <div
                  style={{
                    ...styles.timelineDot,
                    ...(event.completed ? {} : styles.timelineDotInactive),
                  }}
                />
                <div style={styles.timelineContent}>
                  <div style={styles.timelineTitle}>{event.title}</div>
                  <div style={styles.timelineDate}>{event.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default function BookingsPage() {
  const searchParams = useSearchParams();
  const [bookings] = useState<Booking[]>(MOCK_BOOKINGS);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<BookingStatus>('All');

  // Set selected booking from query parameter
  useEffect(() => {
    const selected = searchParams.get('selected');
    if (selected) {
      setSelectedBookingId(selected);
    } else if (!selectedBookingId) {
      setSelectedBookingId(MOCK_BOOKINGS[0]?.id || null);
    }
  }, [searchParams, selectedBookingId]);

  const filteredBookings = useMemo(() => {
    if (filterStatus === 'All') return bookings;
    if (filterStatus === 'Deposit') return bookings.filter((b) => b.status === 'DEPOSIT');
    if (filterStatus === 'Confirmed') return bookings.filter((b) => b.status === 'CONFIRMED');
    return bookings;
  }, [bookings, filterStatus]);

  const selectedBooking = useMemo(
    () => bookings.find((b) => b.id === selectedBookingId) || bookings[0] || null,
    [bookings, selectedBookingId],
  );

  const totalRevenue = useMemo(() => bookings.reduce((sum, b) => sum + b.totalAmount, 0), [bookings]);
  const pendingTotal = useMemo(
    () => bookings.reduce((sum, b) => sum + (b.totalAmount - b.depositAmount), 0),
    [bookings],
  );

  return (
    <div style={styles.pageWrapper}>
      <div style={styles.pageHeader}>
        <div>
          <div style={styles.pageTitle}>Bookings</div>
          <div style={styles.pageSubtitle}>Manage all active bookings, payments, and client details in one place.</div>
        </div>
        <div style={styles.headerActions}>
          <button style={{ ...styles.actionButton, ...styles.actionButtonOutline }}>Calendar</button>
          <button style={{ ...styles.actionButton, ...styles.actionButtonPrimary }}>New booking</button>
        </div>
      </div>

      <div style={styles.summaryRow}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Active bookings</div>
          <div style={styles.statValue}>{bookings.length}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Revenue</div>
          <div style={styles.statValue}>€{totalRevenue.toLocaleString('de-DE')}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Pending</div>
          <div style={styles.statValue}>€{pendingTotal.toLocaleString('de-DE')}</div>
        </div>
      </div>

      <div style={styles.container}>
        {/* Left Panel - List */}
        <div style={styles.listPanel}>
          <div style={styles.listHeader}>
            <div>
              <div style={styles.listTitle}>Search bookings</div>
              <div style={styles.listSubtitle}>Filter and find bookings by status or client.</div>
            </div>
            <input
              type="text"
              placeholder="Search bookings..."
              style={styles.searchBox}
              aria-label="Search bookings"
            />
          </div>

          <div style={styles.filterTabs}>
            {(['All', 'Deposit', 'Confirmed', 'Pending'] as BookingStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                style={{
                  ...styles.filterTab,
                  ...(filterStatus === status ? styles.filterTabActive : {}),
                }}
              >
                {status}
              </button>
            ))}
          </div>

          <div style={styles.listScroll}>
            {filteredBookings.map((booking) => (
              <BookingListItem
                key={booking.id}
                booking={booking}
                isActive={selectedBookingId === booking.id}
                onSelect={() => setSelectedBookingId(booking.id)}
              />
            ))}
          </div>
        </div>

        {/* Right Panel - Detail */}
        <div style={styles.detailPanel}>
          <BookingDetail booking={selectedBooking} />
        </div>
      </div>
    </div>
  );
}
