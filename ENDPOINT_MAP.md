# 🗺️ Complete Endpoint Map

> **Status note (2026-04):** This document used to mark every dashboard page as
> "✅ Working". That was misleading — only auth, lead capture, photographer
> booking listing and portfolio listing have real backends today. Pages such as
> `/dashboard/clients`, `/dashboard/galleries` and `/dashboard/settings` render
> placeholder data because their backend endpoints are not implemented yet.
> See README.md for the authoritative endpoint list.

## Frontend Routes (http://localhost:3000)

### Public Pages (No Auth Required)
```
/                          Landing page
├── Navigation bar
├── Hero section
├── CTA buttons (Login, Register)
└── Fotolio branding

/login                     Authentication page
├── Email input
├── Password input
├── Submit button
└── Link to register

/register                  New account registration
├── Full name input
├── Email input
├── Password input
├── Subdomain input
└── Submit button (Go live)
```

### Protected Pages (Requires Auth - JWT Cookie)
```
/dashboard                 Overview/Home
├── Stats dashboard
├── Welcome message
├── Quick links to features
└── Theme toggle

/dashboard/bookings        Bookings Management
├── List panel (search, filter, scroll)
├── Detail panel (client info, payment, timeline, notes)
├── Role-aware view (photographer vs customer)
└── Action buttons (edit, email, whatsapp, etc.)

/dashboard/leads           Lead Management (Photographer only)
├── Prospect list
├── Scoring system
├── Search & filter
├── Detail panel with engagement metrics
└── Action buttons

/dashboard/clients         Client Directory (Photographer only)
├── Client list
├── Contact info
├── Booking history
├── Detail panel
└── CRM features

/dashboard/galleries       Gallery Hub (Customer only)
├── Session galleries list
├── Download options
├── Share functionality
└── Photo viewer

/dashboard/portfolio       Portfolio Showcase (Both roles)
├── Photo grid
├── Category filters
├── Lightbox
└── Photo details

/dashboard/settings        Account Settings (Both roles)
├── Profile settings
├── Theme toggle
├── Preferences
└── Logout button
```

---

## Backend API Endpoints (http://localhost:3001)

### Authentication Endpoints

```
POST /api/auth/register
├── Description: Create new photographer account
├── Required Fields:
│   ├── fullName (string, max 200 chars)
│   ├── email (string, valid email)
│   ├── password (string, min 8 chars)
│   └── subdomain (string, 3-63 chars, alphanumeric + hyphens)
├── Response: 201 Created
│   ├── id (uuid)
│   ├── email (string)
│   ├── fullName (string)
│   ├── role (OWNER)
│   ├── tenant (subdomain, plan)
│   ├── accessToken (JWT)
│   └── refreshToken (JWT)
└── Cookies Set: access_token, refresh_token (HTTP-only)

POST /api/auth/login
├── Description: Authenticate with credentials
├── Required Fields:
│   ├── email (string)
│   └── password (string)
├── Response: 200 OK
│   ├── accessToken (JWT)
│   └── refreshToken (JWT)
└── Cookies Set: access_token, refresh_token (HTTP-only)

GET /api/auth/me
├── Description: Get current authenticated user
├── Auth Required: Yes (JWT token or Authorization header)
├── Response: 200 OK
│   ├── id (uuid)
│   ├── email (string)
│   ├── fullName (string)
│   ├── role (OWNER, CUSTOMER, GUEST)
│   └── tenant (id, subdomain, plan)
└── No Cookies Set

POST /api/auth/refresh
├── Description: Refresh access token
├── Auth Required: Yes (refresh_token cookie or body)
├── Request Body (optional):
│   └── refreshToken (string)
├── Response: 200 OK
│   ├── accessToken (JWT)
│   └── refreshToken (JWT)
└── Cookies Set: access_token, refresh_token (HTTP-only)

POST /api/auth/logout
├── Description: Logout and invalidate tokens
├── Auth Required: Yes
├── Response: 204 No Content
└── Cookies Cleared: access_token, refresh_token
```

---

## Role-Based Access Control

```
PUBLIC (No Login)
├── GET /
├── GET /login
├── GET /register
└── POST /api/auth/* (register, login)

AUTHENTICATED (Any User)
├── GET /api/auth/me
├── POST /api/auth/refresh
├── POST /api/auth/logout
├── GET /dashboard
├── GET /dashboard/bookings*
├── GET /dashboard/portfolio*
├── GET /dashboard/galleries*
└── GET /dashboard/settings*

PHOTOGRAPHER/ADMIN ONLY
├── GET /dashboard/leads
├── GET /dashboard/clients
└── Expanded bookings management features

CUSTOMER ONLY
├── Simplified bookings view
└── Galleries access
```

*Bookings and Portfolio have different UI based on role

---

## Data Flow Architecture

```
┌─────────────────┐
│  Browser/UI     │ (localhost:3000)
│ (Next.js App)   │
└────────┬────────┘
         │
         │ HTTP/HTTPS
         │ (JWT in Cookie or Authorization Header)
         │
         ▼
┌─────────────────────────┐
│  Frontend (Next.js)     │
│ ├─ Auth Pages           │
│ ├─ Dashboard Pages      │
│ ├─ Theme Store          │
│ ├─ Auth Store           │
│ └─ Middleware           │
└────────┬────────────────┘
         │
         │ API Calls
         │
         ▼
┌─────────────────────────┐
│  Backend (Spring Boot)  │ (localhost:3001)
│ ├─ Auth Controller      │
│ ├─ JWT Filter           │
│ ├─ User Service         │
│ ├─ Database (PostgreSQL)│
│ └─ Cache (Redis)        │
└─────────────────────────┘
```

---

## Cookie Management

```
After Login:
├── access_token
│   ├── Type: HTTP-only
│   ├── Expiry: 24 hours
│   ├── Secure: Yes (HTTPS)
│   └── SameSite: Strict
└── refresh_token
    ├── Type: HTTP-only
    ├── Expiry: 30 days
    ├── Secure: Yes (HTTPS)
    └── SameSite: Strict

Middleware Check:
├── Request to /dashboard*
├── Middleware checks for access_token cookie
├── If missing → Redirect to /login
└── If valid → Allow access

Auto-Refresh:
├── Token expiring soon?
├── Call POST /api/auth/refresh
├── New tokens issued
└── Cookies updated
```

---

## Component Structure

```
Layout Hierarchy:

RootLayout (app/layout.tsx)
├── Provides HTML/Body structure
└── Imports global styles

Public Layout
├── Auth pages (login, register)
├── Landing page
└── No navigation

DashboardLayout (app/(dashboard)/layout.tsx)
├── Header
│   ├── Logo/Branding
│   ├── User menu
│   ├── Theme toggle
│   └── Logout button
├── Sidebar Navigation
│   ├── Overview link
│   ├── Bookings link
│   ├── Leads link (photographer only)
│   ├── Clients link (photographer only)
│   ├── Portfolio link
│   ├── Galleries link (customer only)
│   └── Settings link
└── Main content area
    └── Page-specific content
```

---

## Pages with Mock Data

These pages work **without backend API calls**:

```
/dashboard/bookings
├── 5 mock bookings loaded
├── Search functionality (client-side)
├── Filter by status (client-side)
├── Timeline events
├── Payment information
└── All UI components functional

/dashboard/leads
├── 10 mock leads loaded
├── Scoring system implemented
├── Search by name/email
├── Filter by status
└── Detail panel with metrics

/dashboard/clients
├── 15 mock clients loaded
├── Contact information
├── Booking history
├── Search functionality
└── Client details

/dashboard/portfolio
├── Sample photo gallery
├── Category filtering
├── Image grid layout
└── Lightbox view

All pages include:
├── Theme switching (light/dark)
├── Responsive design
├── Navigation integration
└── Mock data for testing
```

---

## Available Ports

```
Frontend:  http://localhost:3000
Backend:   http://localhost:3001

Check if running:
$ lsof -i :3000    (Frontend)
$ lsof -i :3001    (Backend)
```

---

## Token Format

```
JWT Structure: header.payload.signature

Header:
{
  "alg": "HS256",
  "typ": "JWT"
}

Payload:
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "OWNER",
  "iat": 1234567890,
  "exp": 1234654290
}

Signature: HMACSHA256(...)
```

---

## Authentication Flow

```
1. User visits /login
   ↓
2. Enters email & password
   ↓
3. Clicks "Sign in"
   ↓
4. POST /api/auth/login
   ↓
5. Backend validates credentials
   ↓
6. Returns access_token & refresh_token (in cookies)
   ↓
7. Frontend stores tokens (browser cookies)
   ↓
8. Middleware checks for access_token
   ↓
9. Redirects to /dashboard
   ↓
10. User can now access all protected pages
   ↓
11. All API calls include JWT token automatically
```

---

## Quick Reference

| What | Where |
|------|-------|
| Frontend running? | `curl http://localhost:3000` |
| Backend running? | `curl http://localhost:3001/api/health` |
| Start Frontend | `cd apps/web && npm run dev` |
| Start Backend | `cd apps/api && mvn spring-boot:run` |
| Test All Endpoints | `bash quick-test.sh` |
| Full Documentation | `ENDPOINTS_AND_TESTING.md` |
| UI Testing Guide | `TESTING_UI_PAGES.md` |

---

**All endpoints are now mapped and documented! 🎉**
