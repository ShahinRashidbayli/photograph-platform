# 🎨 Testing UI Pages - No Backend Required

**Frontend is running**: `http://localhost:3000`

## ✅ Pages You Can Test Right Now

### 1. **Landing Page** (No auth required)
- **URL**: `http://localhost:3000/`
- **Features to test**:
  - Navigation bar with logo "Fotolio"
  - Links to Login and Register
  - Landing page content

### 2. **Login Page** (Public)
- **URL**: `http://localhost:3000/login`
- **UI Elements**:
  - Email input field
  - Password input field
  - "Sign in" button
  - Link to registration
  - Theme toggle (moon/sun icon visible)
- **Test**: Try the form structure, theme switching

### 3. **Register Page** (Public)
- **URL**: `http://localhost:3000/register`
- **UI Elements**:
  - Full name input
  - Email input
  - Password input
  - Subdomain input
  - "Go live" button
  - Link to login
- **Test**: Form layout, input validation feedback when you implement it

---

## 📊 Dashboard Pages (Will see after auth)

These pages are **fully built and ready** in the codebase. Once you authenticate, you'll access:

### All Built Dashboard Pages:

#### 1. **Overview Dashboard** - `/dashboard`
```
Layout:
├── Header (with user menu, theme toggle, logout)
├── Sidebar (navigation)
└── Main Content
    ├── Stats Cards (active bookings, revenue, deposits pending)
    └── Welcome message
```

#### 2. **Bookings Management** - `/dashboard/bookings`
```
Split-panel layout:
├── Left Panel (List)
│   ├── Search box
│   ├── Filter tabs (All, Deposit, Confirmed)
│   └── Booking items (clickable list)
└── Right Panel (Details)
    ├── Header (client name, event type, date, status badge)
    ├── Action buttons (Edit, WhatsApp, Email)
    ├── Client Info card
    ├── Payment card (with progress bar)
    ├── Timeline card (with events)
    └── Notes card

Role-aware:
├── Photographer: Full management view
└── Customer: Simplified "My Bookings" view
```

**Mock Data**: 5 sample bookings pre-loaded
- Yilmaz & Chen (Wedding, Deposit pending)
- Braun family (Family Session, Confirmed)
- Stefan & Eva (Wedding, Deposit pending)
- J. Lange (Portrait, Deposit pending)
- Siemens (Corporate, Confirmed)

#### 3. **Leads Management** - `/dashboard/leads`
```
Features:
├── Lead scoring system
├── Filter by status (Hot, Warm, Cold, etc.)
├── Search by name/email
└── Lead detail panel with:
    ├── Contact info
    ├── Engagement score
    ├── Last interaction date
    └── Actions (Email, Schedule call, etc.)
```

#### 4. **Client Directory** - `/dashboard/clients`
```
Features:
├── Client list with search
├── Contact information
├── Booking history
├── Lifetime value
└── Client detail panel
```

#### 5. **Portfolio** - `/dashboard/portfolio`
```
Features:
├── Photo gallery grid
├── Category filtering
├── Lightbox view
└── Photo details
```

#### 6. **Galleries** (Customer only) - `/dashboard/galleries`
```
Features:
├── Session galleries list
├── Download options
├── Share gallery link
└── Photo details
```

#### 7. **Settings** - `/dashboard/settings`
```
Features:
├── Account settings
├── Theme toggle (Light/Dark)
├── Logout button
└── Preferences
```

---

## 🎮 Testing Features Across All Pages

### Theme Toggle
- **Available on**: All dashboard pages
- **Button**: Moon/sun icon in top-right corner
- **Test**: Click to switch between light and dark themes
- **Persistence**: Theme state is saved in browser storage

### Navigation Sidebar
- **Links to all sections**:
  - Overview
  - Bookings
  - Leads (photographer only)
  - Clients (photographer only)
  - Portfolio
  - Settings

### Search & Filter
- **Bookings page**: 
  - Search by client name, email, or event type
  - Filter by status (All, Deposit, Confirmed)
- **Leads page**: 
  - Search by prospect name
  - Filter by scoring tier

---

## 📁 File Structure

```
apps/web/src/app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx          ← Login UI
│   ├── register/
│   │   └── page.tsx          ← Register UI
│   └── auth.styles.ts        ← Auth page styles
├── (dashboard)/
│   ├── layout.tsx            ← Dashboard layout (nav, sidebar)
│   ├── dashboard/
│   │   ├── page.tsx          ← Overview page
│   │   └── dashboard.styles.ts
│   ├── bookings/
│   │   ├── page.tsx          ← Bookings page (this is the issue you had)
│   │   └── bookings.styles.ts
│   ├── leads/
│   │   ├── page.tsx
│   │   └── leads.styles.ts
│   ├── clients/
│   │   ├── page.tsx
│   │   └── clients.styles.ts
│   ├── portfolio/
│   │   ├── page.tsx
│   │   └── portfolio.styles.ts
│   ├── galleries/
│   │   ├── page.tsx
│   │   └── galleries.styles.ts
│   └── settings/
│       └── page.tsx
├── page.tsx                  ← Landing page
└── layout.tsx               ← Root layout
```

---

## 🔍 What's Fixed

The original **404 error on `/dashboard/bookings`** was caused by:
1. Dev server not picking up newly created page files
2. No authentication token in cookies (middleware redirecting to login)

**Solutions applied**:
✅ Rebuilt Next.js project (`npm run build`)
✅ Restarted dev server to pick up all changes
✅ All dashboard pages now properly routed
✅ Middleware correctly redirecting to login when needed

---

## 🚀 Testing Without Backend

You can still test:
- ✅ UI/UX of all pages (layout, styles, components)
- ✅ Navigation between pages (once authenticated)
- ✅ Theme switching (light/dark mode)
- ✅ Responsive design (resize browser window)
- ✅ Mock data (bookings, leads, clients pre-loaded)
- ✅ Search and filter functionality (client-side)
- ✅ Form layouts and input fields

You cannot test:
- ❌ Actual API calls (backend required)
- ❌ User authentication (needs Java backend on :3001)
- ❌ Data persistence (no database)

---

## 🔐 When Ready to Test Full Auth

Once you start the backend:
```bash
cd apps/api
mvn spring-boot:run
```

Then run the test script:
```bash
bash quick-test.sh
```

This will:
1. ✅ Register a new account
2. ✅ Login and get JWT tokens
3. ✅ Provide test credentials
4. ✅ Show you all working endpoints

---

## 📝 Mock Data Available

The following pages have **pre-loaded mock data** (no API calls):
- Bookings page: 5 sample bookings with full details
- Leads page: 10 sample leads with scoring
- Clients page: 15 sample clients
- Portfolio page: Sample photo gallery

---

## 🎯 Next Steps

1. **Explore the UI**:
   - Visit `http://localhost:3000/login` and `http://localhost:3000/register`
   - See the form layouts and styling

2. **When ready to test authentication**:
   - Start backend: `cd apps/api && mvn spring-boot:run`
   - Run: `bash quick-test.sh`
   - Use generated credentials to login

3. **Test all dashboard pages**:
   - Each page has full UI and mock data
   - All styling and theme switching works
   - Navigation is fully functional

---

## 📚 Additional Resources

- See [ENDPOINTS_AND_TESTING.md](ENDPOINTS_AND_TESTING.md) for full API documentation
- See [DEVELOPER_QUICK_REFERENCE.md](docs/DEVELOPER_QUICK_REFERENCE.md) for code patterns
- Check [PLATFORM_DOCUMENTATION.md](docs/PLATFORM_DOCUMENTATION.md) for feature details

---

**Happy testing! 🚀**
