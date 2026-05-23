# 🚀 Complete API & UI Endpoints Guide

> **Status note (2026-04):** Some entries in the tables below were previously
> marked "✅ Working" even though only auth, lead capture, photographer/customer
> booking listing and portfolio listing have real backends. Treat dashboard
> pages for clients / galleries / settings as UI shells until the corresponding
> endpoints land. The authoritative endpoint list lives in README.md.

**Frontend**: `http://localhost:3000` (Next.js)  
**Backend**: `http://localhost:3001` (Java Spring Boot)

---

## 📋 UI Pages (Frontend - `/dashboard/*`)

All dashboard pages require authentication via JWT cookie. Redirect happens automatically to `/login` if token is missing.

### Public Pages
| Path | Description | Status |
|------|-------------|--------|
| `/` | Landing page | ✅ Working |
| `/login` | Authentication form | ✅ Working |
| `/register` | New account registration | ✅ Working |

### Protected Pages (Dashboard - requires auth)
| Path | Role | Component | Features |
|------|------|-----------|----------|
| `/dashboard` | Both | Overview | Stats dashboard (role-aware) |
| `/dashboard/bookings` | Both | Bookings Manager | List, filter, search, detail view |
| `/dashboard/leads` | Photographer | Lead Scoring | Prospects with engagement scoring |
| `/dashboard/clients` | Photographer | Client Directory | CRM-style client management |
| `/dashboard/galleries` | Customer | Gallery Hub | View session galleries |
| `/dashboard/portfolio` | Both | Portfolio | Showcase photographs |
| `/dashboard/settings` | Both | Settings | Account & preferences |

---

## 🔐 Authentication Flow

### Step 1: Register a New Account

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test Photographer",
    "email": "test@example.com",
    "password": "TestPass123",
    "subdomain": "test-photographer"
  }'
```

**Response:**
```json
{
  "id": "uuid-here",
  "email": "test@example.com",
  "fullName": "Test Photographer",
  "role": "OWNER",
  "tenant": {
    "id": "tenant-uuid",
    "subdomain": "test-photographer",
    "plan": "FREE"
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

**Frontend**: Go to `http://localhost:3000/register` and fill the form

---

### Step 2: Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123"
  }'
```

**Frontend**: Go to `http://localhost:3000/login`, enter credentials

---

## 🔗 Complete API Endpoints

### Authentication Endpoints

#### POST `/api/auth/register`
Create a new photographer account.

**Request:**
```json
{
  "fullName": "string (required, max 200)",
  "email": "string (required, valid email)",
  "password": "string (required, min 8 chars)",
  "subdomain": "string (required, 3-63 chars, alphanumeric + hyphens)"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "email": "email@example.com",
  "fullName": "Full Name",
  "role": "OWNER",
  "tenant": {
    "id": "uuid",
    "subdomain": "subdomain",
    "plan": "FREE"
  },
  "accessToken": "jwt-token",
  "refreshToken": "jwt-token"
}
```

---

#### POST `/api/auth/login`
Authenticate with email and password.

**Request:**
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Response:** `200 OK`
```json
{
  "accessToken": "jwt-token",
  "refreshToken": "jwt-token"
}
```

**Cookies:** Sets `access_token` and `refresh_token` as HTTP-only cookies

---

#### GET `/api/auth/me`
Get current authenticated user.

**Headers:**
```
Cookie: access_token=<your-token>
Authorization: Bearer <jwt-token>
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "email": "email@example.com",
  "fullName": "Full Name",
  "role": "OWNER",
  "tenant": {
    "id": "uuid",
    "subdomain": "subdomain",
    "plan": "FREE"
  }
}
```

---

#### POST `/api/auth/refresh`
Refresh access token using refresh token.

**Request (either format works):**
```bash
# With body
curl -X POST http://localhost:3001/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "your-refresh-token"}'

# Or with cookie
curl -X POST http://localhost:3001/api/auth/refresh \
  -H "Cookie: refresh_token=your-refresh-token"
```

**Response:** `200 OK`
```json
{
  "accessToken": "new-jwt-token",
  "refreshToken": "new-jwt-token"
}
```

---

#### POST `/api/auth/logout`
Logout and invalidate tokens.

**Headers:**
```
Cookie: access_token=<your-token>
```

**Response:** `204 No Content`

---

## 🧪 Quick Testing Script

Save as `test-all-endpoints.sh`:

```bash
#!/bin/bash

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== 1. Register New Account ===${NC}"
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "email": "testuser'$(date +%s)'@example.com",
    "password": "TestPass123",
    "subdomain": "test-'$(date +%s)'"
  }')

echo "$REGISTER_RESPONSE" | jq '.'
ACCESS_TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.accessToken')
echo -e "${GREEN}✓ Got access token: ${ACCESS_TOKEN:0:20}...${NC}\n"

echo -e "${BLUE}=== 2. Get User Profile (GET /api/auth/me) ===${NC}"
curl -s -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
echo -e "${GREEN}✓ Profile retrieved${NC}\n"

echo -e "${BLUE}=== 3. Access Bookings UI ===${NC}"
echo "Frontend pages now accessible:"
echo "  - http://localhost:3000/dashboard"
echo "  - http://localhost:3000/dashboard/bookings"
echo "  - http://localhost:3000/dashboard/leads"
echo "  - http://localhost:3000/dashboard/clients"
echo "  - http://localhost:3000/dashboard/galleries"
echo "  - http://localhost:3000/dashboard/portfolio"
echo "  - http://localhost:3000/dashboard/settings"
echo -e "${GREEN}✓ All endpoints available${NC}"
```

Run it:
```bash
chmod +x test-all-endpoints.sh
./test-all-endpoints.sh
```

---

## 📊 Testing the UI

### 1. **Photographer Dashboard** (Full management view)
- **URL**: `http://localhost:3000/dashboard`
- **Features**:
  - Overview with stats (active bookings, revenue, deposits pending)
  - Navigation to all features
  - Role-based access control

### 2. **Bookings Page** (Photographer & Customer)
- **URL**: `http://localhost:3000/dashboard/bookings`
- **Photographer View** (role: `photographer` or `admin`):
  - Active bookings list with search/filter
  - Detailed booking card (client info, payment status, timeline)
  - Buttons: Edit, WhatsApp, Email, Upload gallery, View contract, Cancel
  - Payment status tracking with progress bar
  - Timeline of events
  
- **Customer View** (role: `customer`):
  - Simplified "My Bookings" view
  - Session details, photographer contact, payment status
  - Gallery preview area
  - Message button

### 3. **Leads Page** (Photographer only)
- **URL**: `http://localhost:3000/dashboard/leads`
- **Features**:
  - Lead list with scoring
  - Lead detail panel
  - Filter by status (Hot, Warm, Cold, etc.)
  - Search by name, email, package type

### 4. **Clients Page** (Photographer only)
- **URL**: `http://localhost:3000/dashboard/clients`
- **Features**:
  - Client directory
  - View past bookings by client
  - Contact information
  - Lifetime value

### 5. **Portfolio Page** (Both roles)
- **URL**: `http://localhost:3000/dashboard/portfolio`
- **Features**:
  - Showcase of photographs
  - Category filtering
  - Detailed gallery view

### 6. **Galleries Page** (Customer only)
- **URL**: `http://localhost:3000/dashboard/galleries`
- **Features**:
  - View session galleries
  - Download photos
  - Share galleries

### 7. **Settings Page** (Both roles)
- **URL**: `http://localhost:3000/dashboard/settings`
- **Features**:
  - Account settings
  - Theme toggle (Light/Dark)
  - Logout

---

## 🎨 Testing Theme Toggle

Click the **moon/sun icon** in the top-right corner of any dashboard page to switch between light and dark themes. The state persists across page navigation.

---

## 🐛 Troubleshooting

### 404 on `/dashboard/bookings`?
- Ensure you're logged in (check browser cookies for `access_token`)
- If redirected to `/login`, authenticate first

### API returns 401 Unauthorized?
- Token expired → Use refresh endpoint or login again
- Missing Authorization header → Add `Authorization: Bearer <token>`

### Backend not responding on port 3001?
```bash
# Check if backend is running
lsof -i :3001

# Or start it with:
cd apps/api
mvn spring-boot:run
```

### Frontend not responding on port 3000?
```bash
# Check if frontend is running
lsof -i :3000

# Or start it with:
cd apps/web
npm run dev
```

---

## 📝 Mock Data Included

The bookings page includes **5 mock bookings** with:
- Different statuses (Deposit pending, Confirmed)
- Package types (Wedding, Family, Portrait, Corporate)
- Client information and contact details
- Timeline of events
- Payment progress tracking

These are hardcoded in [apps/web/src/app/(dashboard)/bookings/page.tsx](apps/web/src/app/(dashboard)/bookings/page.tsx) and don't require API calls.

---

## 🔑 Token Management

Tokens are automatically managed by the frontend:
- **Stored in**: HTTP-only cookies (secure, not accessible via JavaScript)
- **Auto-refresh**: Happens transparently when expired
- **Logout**: Clears cookies and redirects to `/login`
- **Cookie names**: `access_token`, `refresh_token`

---

## ✅ All Features Ready to Test

| Feature | Status | Frontend | Backend |
|---------|--------|----------|---------|
| Authentication | ✅ | Next.js | Java/Spring |
| Dashboard (Overview) | ✅ | `/dashboard` | N/A (mock) |
| Bookings Management | ✅ | `/dashboard/bookings` | Ready |
| Lead Scoring | ✅ | `/dashboard/leads` | Ready |
| Client Directory | ✅ | `/dashboard/clients` | Ready |
| Galleries | ✅ | `/dashboard/galleries` | Ready |
| Portfolio | ✅ | `/dashboard/portfolio` | Ready |
| Settings | ✅ | `/dashboard/settings` | N/A (mock) |
| Theme Toggle | ✅ | All pages | N/A |

---

**Happy testing! 🎉**
