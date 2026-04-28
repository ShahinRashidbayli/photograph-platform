# Fotolio Platform Documentation

## Table of Contents
1. [Platform Overview](#platform-overview)
2. [User Roles](#user-roles)
3. [Photographer Dashboard](#photographer-dashboard)
4. [Customer Dashboard](#customer-dashboard)
5. [Navigation & Routing](#navigation--routing)
6. [Features by Role](#features-by-role)
7. [Data Models](#data-models)
8. [Mock Data](#mock-data)
9. [Theming & Styling](#theming--styling)
10. [Testing Guide](#testing-guide)

---

## Platform Overview

**Fotolio** is a photography management platform designed for photographers to manage their business and for customers to track their photo sessions.

### Key Concept
- **Business Model**: Photographers bring their own customers to the platform
- **Platform Purpose**: Simplify workflow, booking management, and client communication
- **Not a Marketplace**: Customers don't discover photographers; they're invited by photographers

### Architecture
- **Frontend**: Next.js 14+ with React 18+
- **Styling**: Inline CSS-in-JS with theme support
- **Theme System**: Light/Dark mode toggle via `useThemeStore`
- **Authentication**: Role-based access control (photographer vs customer)
- **State Management**: Zustand stores (`authStore`, `themeStore`)

---

## User Roles

### 1. Photographer Role
```ts
user?.role === 'photographer' || user?.role === 'admin'
```

**Responsibilities**:
- Manage client bookings and sessions
- Track leads and conversions
- Build and showcase portfolio
- Monitor payments and deposits
- Communicate with clients
- Upload and deliver photo galleries

**Access Level**: Full platform features, management capabilities

### 2. Customer Role
```ts
user?.role === 'customer'
```

**Responsibilities**:
- Browse and view photographer's portfolio
- Track upcoming sessions
- Monitor payment status
- Download delivered photos
- View galleries

**Access Level**: View-only for most features, no management capabilities

---

## Photographer Dashboard

### Route: `/dashboard` (Photographer View)

#### Page Structure
```
┌─────────────────────────────────────────────────────────┐
│  Header: Welcome, [Name]! | Your studio overview         │
│  [View Portfolio] [+ Create Booking]                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Metric Cards Grid (4 columns)                           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │
│  │ Bookings     │ │ Revenue      │ │ Active       │ ... │
│  │ this month   │ │ (Apr)        │ │ clients      │     │
│  │ 14  ↑ +18%   │ │ €4,720 ↑ +12%│ │ 32 8 new    │     │
│  └──────────────┘ └──────────────┘ └──────────────┘     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Two-Column Layout                                       │
│  ┌──────────────────────────┐ ┌──────────────────────┐ │
│  │ Upcoming Bookings        │ │ Recent Leads         │ │
│  ├──────────────────────────┤ ├──────────────────────┤ │
│  │ [APR]  Braun family      │ │ 🔴 Maria & Klaus   │ │
│  │ [02]   Family Session    │ │     Wedding        │ │
│  │        Confirmed        │ │     €500+ High     │ │
│  │                          │ │                    │ │
│  │ [MAY]  Stefan & Eva      │ │ 🟡 Sophie Richter │ │
│  │ [03]   Wedding           │ │     Portrait       │ │
│  │        Deposit pending   │ │     €200–499 Med   │ │
│  └──────────────────────────┘ └──────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

#### Key Features

**Metrics**
- **Bookings this month**: Total active bookings in current month
- **Revenue (Month)**: Total income from bookings
- **Active clients**: Number of clients with upcoming sessions
- **New leads**: Count of new prospects to follow up on
- Trend indicators show month-over-month changes

**Upcoming Bookings Section**
- Shows next 3 upcoming bookings
- Displays booking date (in calendar box), client name, event type
- Status badge (Confirmed/Deposit pending)
- Click to navigate to `/bookings` for full management

**Recent Leads Section**
- Shows last 3 leads received
- Color-coded priority dots (green = high, yellow = medium, red = low)
- Budget range displayed
- Shows event type
- Click to navigate to `/leads` for full lead management

---

## Customer Dashboard

### Route: `/dashboard` (Customer View)

#### Page Structure
```
┌─────────────────────────────────────────────────────────┐
│  Header: Welcome, [Name]! | Your sessions with [Photographer]
│  [View Portfolio]                                        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Simplified Metric Cards (3 columns)                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │
│  │ Upcoming     │ │ Photos       │ │ Total Spent  │     │
│  │ Sessions     │ │ Delivered    │ │              │     │
│  │ 1            │ │ 48           │ │ €350         │     │
│  │ Next: Jun 14 │ │ ready to dl  │ │ all sessions │     │
│  └──────────────┘ └──────────────┘ └──────────────┘     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Two-Column Layout                                       │
│  ┌──────────────────────────┐ ┌──────────────────────┐ │
│  │ Upcoming Sessions        │ │ Your Galleries       │ │
│  ├──────────────────────────┤ ├──────────────────────┤ │
│  │ [JUN]  Wedding Session   │ │ [MAY]  Portrait      │ │
│  │ [14]   Wedding           │ │ [02]   Session       │ │
│  │        Confirmed        │ │        48 photos     │ │
│  │                          │ │        ✓ Ready       │ │
│  └──────────────────────────┘ └──────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

#### Key Features

**Metrics**
- **Upcoming Sessions**: Number of scheduled future sessions
- **Photos Delivered**: Total photos available from completed sessions
- **Total Spent**: Cumulative amount paid across all sessions

**Upcoming Sessions Section**
- Shows next scheduled sessions
- Displays session type, date, status
- Photographer name displayed in header
- Click to view detailed booking info at `/bookings`

**Your Galleries Section**
- Quick preview of latest gallery
- Shows photo count and download status
- Status indicator (Ready, Processing, etc.)
- Click to view all galleries at `/galleries`

---

## Photographer Pages

### 1. Bookings Page
**Route**: `/bookings` (Photographer View)

#### Layout
```
┌─────────────────────────────────────────────────────────┐
│ Bookings | Manage active bookings, payments, & interactions
│ [Calendar] [New booking]                                │
└─────────────────────────────────────────────────────────┘

┌───────────────────┬───────────────────┬──────────────────┐
│ Active bookings: 5│ Revenue: €5,970   │ Deposits pending: 3
└───────────────────┴───────────────────┴──────────────────┘

┌─────────────────────┐  ┌──────────────────────────────────┐
│ LEFT: Bookings List │  │ RIGHT: Booking Detail            │
│ [Search...]        │  │                                  │
│ All|Deposit|Confirmed
│ [APR 22] Yilmaz...│  │ Yilmaz & Chen                    │
│ [APR 26] Braun...  │  │ Wedding • Apr 22 | Deposit paid  │
│ [MAY 03] Stefan...│  │ [Edit][WhatsApp][Email]          │
│ [MAY 10] Portrait..│  │                                  │
│ [MAY 17] Corp...  │  │ ┌─────────────┬────────────────┐ │
│                    │  │ │ Client Info │ Payment        │ │
│                    │  │ ├─────────────┼────────────────┤ │
│                    │  │ │ Name        │ Total: €1,200  │ │
│                    │  │ │ Email       │ Paid: €300     │ │
│                    │  │ │ Phone       │ Remaining: €900│ │
│                    │  │ │ Location    │ Progress: 25%  │ │
│                    │  │ │             │ ▓░░░░░░░░░░░░ │ │
│                    │  │ └─────────────┴────────────────┘ │
│                    │  │                                  │
│                    │  │ Timeline | Notes | Actions       │
│                    │  │ [Upload gallery][View contract] │
│                    │  │                           [Cancel]
└─────────────────────┘  └──────────────────────────────────┘
```

#### Features
- **List Panel**:
  - Search bookings by client name, email, event type
  - Filter by status (All, Deposit pending, Confirmed)
  - Date calendar boxes for quick visual identification
  - Amount and status badge on each item

- **Detail Panel**:
  - **Client Info**: Name, email, phone, location
  - **Payment Section**: 
    - Total amount, deposit paid, outstanding balance
    - Visual progress bar showing deposit percentage
    - Payment method options (Card, SEPA)
  - **Timeline**: Visual timeline of booking stages
  - **Notes**: Internal notes about the booking
  - **Actions**: 
    - Edit booking details
    - Upload photo gallery
    - View/manage contract
    - Cancel booking (danger action)
    - WhatsApp/Email quick contact

---

### 2. Leads Page
**Route**: `/leads` (Photographer Only)

#### Layout
```
┌─────────────────────────────────────────────────────────┐
│ Leads | Qualify leads, track priorities, convert to bookings
│ Header Stats: [Total Leads: 15] [High Priority: 8] [Conversion: 12%]
└─────────────────────────────────────────────────────────┘

┌─────────────────────┐  ┌──────────────────────────────────┐
│ LEFT: Leads List    │  │ RIGHT: Lead Detail               │
│ [Search...]        │  │                                  │
│ All|High|Medium|Low│ │ Maria & Klaus                    │
│ [APR 10]Wedding... │  │ Wedding • Budget: €500+ | HIGH   │
│ [APR 12]Portrait.. │  │ [Score: 9/10]                   │
│ [APR 15]Family...  │  │                                  │
│ [APR 18]Corporate..│  │ Contact Info:                    │
│                    │  │ Email: maria@example.com         │
│                    │  │ Phone: +49 176 333 2211          │
│                    │  │ Date: April 10                   │
│                    │  │                                  │
│                    │  │ Event Details:                   │
│                    │  │ Type: Wedding                    │
│                    │  │ Date: June 15, 2026              │
│                    │  │ Budget: €500+                    │
│                    │  │ Message: Beautiful location...  │
│                    │  │                                  │
│                    │  │ Internal Notes:                  │
│                    │  │ [Text area...]                   │
│                    │  │                                  │
│                    │  │ [Reply with message]             │
│                    │  │ [Convert to booking]             │
│                    │  │ [Archive]                        │
└─────────────────────┘  └──────────────────────────────────┘
```

#### Features
- **Scoring System**: Leads ranked by quality (HIGH/MED/LOW)
- **Status Tracking**: Track lead through pipeline (NEW → REPLIED → BOOKED → REJECTED)
- **Contact Information**: Email, phone, location
- **Event Details**: Type, proposed date, budget range
- **Internal Notes**: Add notes about the lead for team reference
- **Actions**:
  - Reply to lead with custom message
  - Convert lead to booking (creates new booking entry)
  - Archive/reject lead
  - Track conversion metrics

---

### 3. Clients Page
**Route**: `/clients` (Photographer Only)

#### Layout
```
┌─────────────────────────────────────────────────────────┐
│ Clients | Manage relationships, track sessions, build connections
│ Header Stats: [Total Clients: 5] [Active Bookings: 2] [Avg Spend: €354]
└─────────────────────────────────────────────────────────┘

┌──────────────────────┐  ┌──────────────────────────────────┐
│ LEFT: Clients List   │  │ RIGHT: Client Detail             │
│ [Search...]        │  │                                  │
│ All|Active|Repeat   │ │ Maria & Klaus                    │
│ [MK] Maria & Klaus  │  │ Berlin, Germany • Joined Apr '25│
│ 1 booking • €850    │  │ [New Booking]                   │
│ Berlin, Germany     │  │                                  │
│                    │  │ Stats:                           │
│ [SR] Sophie Richter │  │ ┌──────┬──────┬──────┬────────┐ │
│ 1 booking • €350    │  │ │Total │Books │Upcoming│Last  │ │
│ Munich, Germany     │  │ │Spent │ings  │ │Session│ │
│                    │  │ │€850  │1     │0       │Jun 14│ │
│ [TM] Thomas Müller │  │ │      │      │       │      │ │
│ 1 booking • €150    │  │ └──────┴──────┴──────┴────────┘ │
│ Upcoming: 1        │  │                                  │
│ Hamburg, Germany    │  │ Contact Information:            │
│                    │  │ Email: maria@example.com         │
│ [LB] Laura & Ben   │  │ Phone: +49 176 333 2211          │
│ 1 booking • €1,200  │  │ Location: Berlin, Germany        │
│ Upcoming: 1        │  │                                  │
│ Cologne, Germany    │  │ Client Notes:                    │
│                    │  │ [Notes text area...]             │
│                    │  │ [Save Notes]                     │
│                    │  │                                  │
│                    │  │ [💬 WhatsApp] [📧 Email]         │
└──────────────────────┘  └──────────────────────────────────┘
```

#### Features
- **Client Overview**:
  - Total spent with photographer
  - Number of completed bookings
  - Upcoming sessions count
  - Last booking date
  - Join date tracking

- **Client Details**:
  - Contact info (email, phone, location)
  - Booking history with amounts
  - Upcoming sessions
  - Last session date

- **Client Notes**:
  - Add internal notes about client preferences
  - Track special requests or feedback
  - Editable with save functionality

- **Quick Actions**:
  - WhatsApp messaging
  - Email contact
  - New booking for client

---

### 4. Portfolio Page
**Route**: `/portfolio` (Photographer & Customer View)

#### Layout
```
┌─────────────────────────────────────────────────────────┐
│ Portfolio | Showcase your best work, organize collections
│ Header Stats: [Collections: 5] [Total Photos: 8] [Total Likes: 892]
└─────────────────────────────────────────────────────────┘

┌──────────────────────┐  ┌──────────────────────────────────┐
│ LEFT: Collections    │  │ RIGHT: Collection Detail         │
│ [Search...]        │  │                                  │
│ All|Featured        │ │ Portraits                        │
│ ☆ Weddings         │  │ 18 photos in this collection     │
│ 24 photos          │  │ [📥 Download] [✏️ Edit]          │
│                    │  │                                  │
│ ☆ Portraits        │  │ Stats:                           │
│ 18 photos          │  │ ┌──────┬──────┬──────┬────────┐ │
│                    │  │ │Photos│Total │Avg   │Top     │ │
│ ☆ Events          │  │ │      │Likes │Likes │Photo   │ │
│ 15 photos          │  │ │18    │287   │36    │92 ❤️   │ │
│                    │  │ └──────┴──────┴──────┴────────┘ │
│ ☆ Fashion         │  │                                  │
│ 12 photos          │  │ Portfolio Grid (4 columns):      │
│                    │  │ ┌─────────────┐ ┌─────────────┐ │
│ ☆ Nature          │  │ │             │ │             │ │
│ 21 photos          │  │ │  [Image]    │ │  [Image]    │ │
│                    │  │ │             │ │             │ │
│                    │  │ │ Corporate H │ │ Studio Port │ │
│                    │  │ │ ❤️ 32 • ... │ │ ❤️ 41 • ... │ │
│                    │  │ └─────────────┘ └─────────────┘ │
│                    │  │                                  │
│                    │  │ ┌─────────────┐ ┌─────────────┐ │
│                    │  │ │             │ │             │ │
│                    │  │ │  [Image]    │ │  [Image]    │ │
│                    │  │ │             │ │             │ │
│                    │  │ └─────────────┘ └─────────────┘ │
└──────────────────────┘  └──────────────────────────────────┘
```

#### Features
- **Collections Panel**:
  - Browse through photography collections
  - Collections can be marked as featured
  - Shows photo count per collection
  - Search collections by name
  - Filter: All or Featured only

- **Collection Detail**:
  - Collection statistics (photos, likes, avg engagement)
  - Responsive grid of portfolio items
  - Each card shows image placeholder, title, like count, date

- **Both Roles**:
  - Photographer can edit/organize collections
  - Customer can browse photographer's portfolio

---

## Customer Pages

### 1. My Bookings
**Route**: `/bookings` (Customer View)

#### Layout
```
┌─────────────────────────────────────────────────────────┐
│ My Bookings | Track your sessions, payments, and gallery access
└─────────────────────────────────────────────────────────┘

┌──────────────────────┐  ┌──────────────────────────────────┐
│ LEFT: Your Sessions  │  │ RIGHT: Booking Detail            │
│ [Search...]        │  │                                  │
│ All|Deposit|Confirm│ │ Wedding                          │
│ [APR 22] Yilmaz...│  │ Jun 14 • Confirmed | Booking #001│
│ 1200€ Confirmed    │  │                                  │
│                    │  │ Photographer:                    │
│ [MAY 03] Stefan...│  │ Anna Müller                      │
│ 1800€ Deposit      │  │ +49 176 123 4567                │
│                    │  │                                  │
│ [MAY 10] Portrait..│  │ Payment:                         │
│ 320€ Deposit       │  │ Total: €1,700                    │
│                    │  │ Paid: €850                       │
│                    │  │ Remaining: €850                  │
│                    │  │ Progress: 50% ▓▓░░░░░░░░░░░░  │
│                    │  │                                  │
│                    │  │ Session Status:                  │
│                    │  │ ✓ Booking confirmed (Apr 15)    │
│                    │  │ ○ Session day (Jun 14)           │
│                    │  │ ○ Photos delivered (Coming soon)│
│                    │  │                                  │
│                    │  │ Gallery:                         │
│                    │  │ Photos will be available here   │
│                    │  │ after the session                │
│                    │  │                                  │
│                    │  │ [💬 Message]                     │
└──────────────────────┘  └──────────────────────────────────┘
```

#### Features
- **Your Sessions List**:
  - Shows customer's own bookings only
  - Date, type, total amount, status
  - Search and filter functionality
  - Visual date indicators

- **Booking Detail (Read-Only)**:
  - Photographer name and contact info
  - Session date and type
  - Payment status with progress bar
  - Session timeline with milestones
  - Gallery availability (when ready)
  - Message photographer button

---

### 2. Galleries
**Route**: `/galleries` (Customer Only)

#### Layout
```
┌─────────────────────────────────────────────────────────┐
│ Your Galleries | View, download, and manage your photo galleries
│ Header Stats: [Galleries: 2] [Total Photos: 120] [1 active]
└─────────────────────────────────────────────────────────┘

┌──────────────────────┐  ┌──────────────────────────────────┐
│ LEFT: Your Galleries │  │ RIGHT: Gallery Detail            │
│ [Search...]        │  │                                  │
│ All|Active|Expired  │ │ Portrait Session                │
│ [MAY 02]Portrait   │  │ Portrait • Shot on May 02, 2026 │
│ 48 photos          │  │ [👁️ View Gallery] [⬇️ Download All]
│ ✓ 63 days left     │  │                                  │
│                    │  │ Stats:                           │
│ [APR 25]Family     │  │ ┌──────┬──────┬──────────────┐ │
│ 72 photos          │  │ │Photos│Views │Expires      │ │
│ ⏰ 63 days left     │  │ │48    │12    │63 days      │ │
│                    │  │ └──────┴──────┴──────────────┘ │
│                    │  │                                  │
│                    │  │ Access Information:              │
│                    │  │ Download: ✓ Enabled             │
│                    │  │ Watermark: ✕ Disabled           │
│                    │  │ Expires: May 02, 2026            │
│                    │  │           ✓ 63 days remaining   │
│                    │  │                                  │
│                    │  │ Gallery Link:                    │
│                    │  │ gallery.fotolio.app/gal-abc123  │
│                    │  │ [📋 Copy Link]                   │
└──────────────────────┘  └──────────────────────────────────┘
```

#### Features
- **Gallery List**:
  - Shows all galleries accessible to customer
  - Photo count per gallery
  - Expiry status with countdown
  - Filter: All, Active (not expired), Expired
  - Search by booking name or event type

- **Gallery Detail**:
  - Photo count and view count
  - Access settings (download enabled/disabled, watermark status)
  - Expiry date with colored badge:
    - 🟢 Green: >7 days remaining
    - 🟡 Yellow: <7 days (warning)
    - 🔴 Red: Expired
  - Shareable gallery link (copyable)
  - View & Download buttons

---

## Navigation & Routing

### URL Structure

#### Photographer Routes
```
/dashboard              → Overview (metrics, upcoming, leads)
/bookings              → List + manage bookings
/leads                 → Lead management & scoring
/clients               → Client relationship management
/portfolio             → Portfolio showcase & management
/settings              → Account & studio settings
```

#### Customer Routes
```
/dashboard             → Simplified overview (sessions, photos)
/bookings              → View own bookings & payment status
/galleries             → View & download photo galleries
/settings              → Account settings
```

#### Shared Routes (Role-Aware)
- `/dashboard` - Different UI based on user role
- `/bookings` - Different UI based on user role

### Navigation Structure

**Photographer Sidebar (PHOTOGRAPHER_NAV)**
```
Main:
├── Overview           /dashboard
├── Bookings          /bookings
├── Leads             /leads
├── Clients           /clients
└── Portfolio         /portfolio

Finance:
├── Payments          # (not implemented)
└── Galleries         # (photographer view)
```

**Customer Sidebar (CLIENT_NAV)**
```
Main:
├── My Bookings       /bookings
└── Galleries         /galleries
```

---

## Features by Role

### Photographer Capabilities

| Feature | Access | Description |
|---------|--------|-------------|
| **Dashboard** | Full | View all metrics, leads, bookings |
| **Bookings** | Full | Create, edit, cancel bookings |
| **Payment Management** | Full | Track deposits, set payment terms |
| **Leads** | Full | Manage prospects, score leads, convert |
| **Clients** | Full | Manage client relationships, notes |
| **Portfolio** | Full | Organize, edit, showcase collections |
| **Gallery Upload** | Full | Upload and deliver photos |
| **Contact Management** | Full | Email, WhatsApp, internal notes |
| **Settings** | Full | Studio profile, business info |

### Customer Capabilities

| Feature | Access | Description |
|---------|--------|-------------|
| **Dashboard** | View | See upcoming sessions, galleries |
| **Bookings** | View | View own bookings, payment status |
| **Portfolio** | View | Browse photographer's work |
| **Galleries** | Download | View and download photos |
| **Contact** | Limited | Message photographer |
| **Settings** | Limited | Account settings only |

---

## Data Models

### Booking
```ts
interface Booking {
  id: string;                    // Unique identifier
  clientName: string;            // Name of the customer
  clientEmail: string;           // Customer email
  eventDate: string;             // ISO date of the session
  packageId: string;             // Reference to service type
  depositAmount: number;         // Amount paid as deposit
  totalAmount: number;           // Total booking cost
  depositPercent: number;        // Percentage of deposit (0-100)
  status: 'DEPOSIT' | 'CONFIRMED'; // Payment status
  createdAt: string;             // Booking creation date
}
```

### Lead
```ts
interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  message: string;               // Inquiry message
  eventDate: string;             // Proposed event date
  eventType: 'WEDDING' | 'ENGAGEMENT' | 'PORTRAIT' | ...; // Type
  budgetRange: 'UNDER_200' | '200_500' | '500_1000' | 'OVER_1000';
  score: 'HIGH' | 'MED' | 'LOW'; // Lead quality score
  status: 'NEW' | 'REPLIED' | 'BOOKED' | 'REJECTED';
  internalNotes?: string;        // Photographer notes
  createdAt: string;
}
```

### Client
```ts
interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  totalSpent: number;            // Lifetime spending
  bookingsCompleted: number;     // Count of completed sessions
  upcomingBookings: number;      // Count of scheduled sessions
  lastBookingDate?: string;      // Most recent session date
  notes?: string;                // Photographer notes
  joinedAt: string;              // Registration date
}
```

### Gallery
```ts
interface Gallery {
  id: string;
  bookingId: string;             // Associated booking
  bookingName: string;           // Display name
  eventType: string;             // Wedding, Portrait, etc.
  shootDate: string;             // Session date
  photoCount: number;            // Number of photos
  downloadEnabled: boolean;      // Can customer download?
  watermarkEnabled: boolean;     // Are photos watermarked?
  expiresAt: string;             // Access expiry date
  accessToken: string;           // Shareable link token
  viewCount: number;             // Times gallery viewed
}
```

### Portfolio Item
```ts
interface PortfolioItem {
  id: string;
  title: string;
  collectionId: string;          // Parent collection
  date: string;                  // Shoot date
  likes: number;                 // Engagement metric
  image: string;                 // Image filename/URL
}
```

---

## Mock Data

### Mock Photographers' Bookings
```ts
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
  // ... more bookings
];
```

### Mock Leads
```ts
const MOCK_LEADS = [
  {
    id: '1',
    name: 'Maria & Klaus',
    email: 'maria@example.com',
    eventType: 'WEDDING',
    eventDate: '2026-06-15',
    budgetRange: 'OVER_1000',
    score: 'HIGH',
    status: 'NEW',
    // ...
  },
  // ... more leads
];
```

### Mock Galleries
```ts
const MOCK_GALLERIES: Gallery[] = [
  {
    id: 'g1',
    bookingId: 'b2',
    bookingName: 'Portrait Session',
    shootDate: '2026-05-02',
    photoCount: 48,
    downloadEnabled: true,
    watermarkEnabled: false,
    expiresAt: '2026-08-02',
    accessToken: 'gal-abc123-portrait',
    viewCount: 12,
  },
  // ... more galleries
];
```

---

## Theming & Styling

### Color System

#### Light Theme
```ts
const lightColors = {
  bg: '#F9FAFB',           // Page background
  cardBg: '#FFFFFF',       // Card/component background
  text: '#111827',         // Primary text
  subText: '#6B7280',      // Secondary text
  border: '#E5E7EB',       // Border color
  hover: '#F3F4F6',        // Hover background
};
```

#### Dark Theme
```ts
const darkColors = {
  bg: '#111827',           // Page background
  cardBg: '#1F2937',       // Card/component background
  text: '#F3F4F6',         // Primary text
  subText: '#D1D5DB',      // Secondary text
  border: '#374151',       // Border color
  hover: '#374151',        // Hover background
};
```

### Status Badge Colors

| Status | Background | Text Color | Usage |
|--------|-----------|-----------|-------|
| Confirmed | #D1FAE5 | #065F46 | Payment complete |
| Deposit | #FEF3C7 | #92400E | Awaiting final payment |
| High Lead | #DCFCE7 | #15803D | High quality prospect |
| Medium Lead | #FEF9C3 | #854D0E | Medium priority |
| Low Lead | #FEE2E2 | #991B1B | Low priority |

### Layout Patterns

**List + Detail Panel**
```
┌──────────────────┬─────────────────────┐
│ Fixed Left Panel │ Flexible Right Panel │
│ (280-380px)      │ (flex: 1)            │
└──────────────────┴─────────────────────┘
```

All pages using this pattern:
- Bookings, Leads, Clients, Portfolio, Galleries

---

## Testing Guide

### Prerequisites
1. Access to `apps/web/src/app/(dashboard)/`
2. Mock user with role set in `authStore`
3. Dark/Light theme toggle in header

### Testing Photographer Features

#### 1. Dashboard
- [ ] Verify metrics display correctly
- [ ] Check upcoming bookings show first 3 only
- [ ] Verify leads display with priority badges
- [ ] Click booking → navigate to `/bookings` with selected item
- [ ] Click lead → navigate to `/leads` with selected item
- [ ] Toggle dark mode → colors update
- [ ] Responsive on mobile (grid collapses)

#### 2. Bookings
- [ ] Search filters bookings by name/email/type
- [ ] Status filter (All/Deposit/Confirmed) works
- [ ] List shows date, client, amount, status
- [ ] Click booking → detail panel updates
- [ ] Payment progress bar calculates correctly
- [ ] All action buttons present (Edit, WhatsApp, Email, etc.)
- [ ] Dark mode colors are readable

#### 3. Leads
- [ ] Search filters leads by name/type/email
- [ ] Priority filter shows HIGH/MED/LOW correctly
- [ ] Lead score displays as numeric value
- [ ] Status shows in badge format
- [ ] Internal notes can be edited
- [ ] Actions (Reply, Convert, Archive) are available
- [ ] Lead color dots match priority level

#### 4. Clients
- [ ] List shows client avatars (initials)
- [ ] Booking count and total spent display
- [ ] Upcoming bookings badge shows count
- [ ] Search filters by name/email/location
- [ ] Filter tabs (All/Active/Repeat) work
- [ ] Client detail shows all information
- [ ] Notes can be edited and saved
- [ ] WhatsApp/Email buttons present

#### 5. Portfolio
- [ ] Collections list shows all with photo counts
- [ ] Featured collections can be marked
- [ ] Search filters collections
- [ ] Featured filter works
- [ ] Portfolio grid is responsive
- [ ] Stats show correctly for selected collection
- [ ] Edit and Download buttons available

### Testing Customer Features

#### 1. Switch to Customer Role
```ts
// In layout.tsx useEffect or mock data
user.role = 'customer'; // Instead of 'photographer'
```

#### 2. Dashboard
- [ ] Shows "Welcome, [Name]! Your sessions with [Photographer]"
- [ ] Shows only simplified metrics (3 columns)
- [ ] Upcoming sessions shows customer's bookings only
- [ ] Galleries quick preview shows latest gallery
- [ ] No "Create booking" or "New booking" buttons
- [ ] "View portfolio" button present
- [ ] Photographer name displayed in header

#### 3. Bookings
- [ ] "My Bookings" title shown instead of "Bookings"
- [ ] List shows only customer's own bookings
- [ ] Detail shows read-only payment info
- [ ] No payment method buttons visible
- [ ] No "Edit", "Upload gallery", "Cancel" buttons
- [ ] Timeline shows customer-appropriate milestones
- [ ] Gallery section shows "Photos will be available..."
- [ ] "Message" button available

#### 4. Galleries
- [ ] Page title is "Your Galleries"
- [ ] Gallery list shows customer's galleries only
- [ ] Filter by Active/Expired works
- [ ] Search works by gallery name
- [ ] Detail shows photo count, download status
- [ ] Expiry badge shows:
      - 🟢 Green for >7 days
      - 🟡 Yellow for <7 days
      - 🔴 Red for expired
- [ ] Gallery link is copyable
- [ ] View Gallery and Download All buttons present
- [ ] Days remaining shows correct count

### Dark Mode Testing

For all pages:
- [ ] Background color changes to dark (#111827)
- [ ] Text color changes to light (#F3F4F6)
- [ ] Cards background changes (#1F2937)
- [ ] Borders are visible in dark mode
- [ ] All text is readable (sufficient contrast)
- [ ] Badge colors still distinct
- [ ] Hover states work correctly
- [ ] Toggle button in header works smoothly
- [ ] Transition animation is smooth

### Responsive Testing

Test on breakpoints:
- [ ] Desktop (1440px+) - Full layout
- [ ] Laptop (1024px) - Slightly condensed
- [ ] Tablet (768px) - Stacked layout
- [ ] Mobile (375px) - Single column
- [ ] Navigation responsive on mobile
- [ ] List + detail panels stack properly

### Performance Testing

- [ ] Page loads in <3 seconds
- [ ] Search filters respond immediately
- [ ] Theme toggle switches instantly
- [ ] No lag when scrolling long lists
- [ ] Images load without layout shift

### Accessibility Testing

- [ ] Keyboard navigation works (Tab through elements)
- [ ] Color contrast passes WCAG AA
- [ ] Form inputs have proper labels
- [ ] Buttons have accessible text or aria-labels
- [ ] Page structure makes sense with screen reader
- [ ] Focus indicators are visible

---

## Common Workflows

### Photographer: New Booking Received

1. Lead arrives in Leads page
2. Photographer reviews lead details, score, budget
3. Photographer replies to lead with message
4. Lead status updates to REPLIED
5. Customer confirms booking
6. Photographer converts lead to booking
7. Booking appears in Bookings page
8. Customer becomes visible in Clients page

### Photographer: Manage Session

1. Navigate to Bookings
2. Select booking from list
3. Review client info and payment status
4. When deposit received, status changes to CONFIRMED
5. On session day, photographer takes photos
6. After session, photographer uploads photos to gallery
7. Gallery becomes accessible to customer

### Customer: Track Session

1. Customer logs in to dashboard
2. Sees upcoming session in "Your Sessions"
3. Clicks booking to view details
4. Sees payment progress and photographer contact
5. Timeline shows upcoming milestones
6. After session, gallery appears in Galleries
7. Customer downloads photos from gallery

---

## API Integration Points

### Future Backend Connections

Currently using mock data. When connecting to backend:

**Endpoints to Implement**:
```
GET  /api/bookings              → List photographer's bookings
GET  /api/bookings/:id          → Get booking detail
POST /api/bookings              → Create new booking
PUT  /api/bookings/:id          → Update booking
DELETE /api/bookings/:id        → Cancel booking

GET  /api/leads                 → List photographer's leads
POST /api/leads/:id/reply       → Reply to lead
POST /api/leads/:id/convert     → Convert lead to booking

GET  /api/clients               → List photographer's clients
GET  /api/clients/:id           → Get client detail
PUT  /api/clients/:id           → Update client notes

GET  /api/galleries             → List galleries
GET  /api/galleries/:id         → Get gallery detail
POST /api/galleries             → Create new gallery

GET  /api/portfolio             → List portfolio collections
POST /api/portfolio             → Create collection
PUT  /api/portfolio/:id         → Update collection
```

---

## Summary

**Fotolio** is a dual-role photography management platform where:

- **Photographers** manage their existing customer relationships, track sessions, monitor payments, and showcase portfolios
- **Customers** track their upcoming sessions, monitor payments, and download delivered photos

The platform uses role-based access control to show different UI and features based on user type, ensuring each role sees only what they need while maintaining consistency in design and user experience.

All pages support light/dark theming, responsive design, and follow a cohesive design system built on the list + detail panel pattern.

For questions or issues, refer to this documentation's sections or check the inline code comments in the respective page files.
