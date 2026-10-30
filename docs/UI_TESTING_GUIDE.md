# UI Testing Guide

## Available Pages for Testing

All UI pages are ready for testing at `http://localhost:3001`. Use the following guide to test each page systematically.

---

## 📋 Testing Checklist

### 1. **Authentication Flow** (Start here)

#### Login Page: `http://localhost:3001/login`
- [ ] Page loads without errors
- [ ] Email field accepts input
- [ ] Password field accepts input
- [ ] "Sign in" button is clickable
- [ ] Error message shows for invalid credentials
- [ ] Successful login redirects to `/dashboard`

**Test with existing account:**
```bash
Email: anna@fotografie.de
Password: TestPass123
```

#### Register Page: `http://localhost:3001/register`
- [ ] Role selection screen shows (Photographer/Client cards)
- [ ] Photographer button opens account form
- [ ] Client button opens account form
- [ ] Form validation works (email, password)
- [ ] Successful registration redirects to `/dashboard`
- [ ] Error handling for duplicate subdomain

**Test Photographer Registration:**
```
Email: [unique-email]@fotografie.de (e.g., test-2026@fotografie.de)
Password: TestPass123
Subdomain: unique-subdomain-[timestamp]
```

---

### 2. **Dashboard Pages** (After login)

Once logged in, navigate to these pages:

#### Dashboard Home: `http://localhost:3001/dashboard`
- [ ] Page loads after auth redirect
- [ ] Shows authentication success message
- [ ] Lists available API endpoints
- [ ] "Try Register" and "Try Login" links work

---

### 3. **Photographer Dashboard** (Full feature pages)

After logging in as a photographer, test these pages:

#### Bookings: `http://localhost:3001/dashboard/bookings`
- [ ] Page loads without errors
- [ ] Booking list displays with mock data
- [ ] Clicking booking shows detail panel
- [ ] Status filters work (All, Deposit, Confirmed)
- [ ] Search functionality filters bookings
- [ ] Payment information displays correctly
- [ ] Timeline shows booking status
- [ ] Buttons are clickable (Edit, WhatsApp, Email, etc.)
- [ ] Dark mode toggle affects colors

**Key interactions:**
- Click each booking in the list
- Use filter tabs (All, Deposit, Confirmed)
- Type in search box to filter bookings
- Verify responsive layout

#### Leads: `http://localhost:3001/dashboard/leads`
- [ ] Leads list displays with mock data
- [ ] Lead cards show name, budget, score badge
- [ ] Clicking lead shows detail panel
- [ ] Score filter works (All, High, Medium, Low)
- [ ] Contact information displays
- [ ] Message content shows clearly
- [ ] Action buttons work (Reply, Call, Move to Booking)

**Key interactions:**
- Click each lead card
- Use score filters
- Verify color-coded score badges (HIGH/MED/LOW)

#### Clients: `http://localhost:3001/dashboard/clients`
- [ ] Client list displays with mock data
- [ ] Client cards show name, email, spending info
- [ ] Clicking client shows detail panel
- [ ] Client history and stats display
- [ ] Notes field shows client information

**Key interactions:**
- Click each client
- Review total spent and bookings completed
- Check upcoming bookings

#### Galleries: `http://localhost:3001/dashboard/galleries`
- [ ] Gallery list displays with thumbnails/placeholders
- [ ] Gallery cards show booking name, photo count
- [ ] Settings toggles (download, watermark) work
- [ ] Expiration dates display
- [ ] Access link can be copied
- [ ] View count shows engagement

**Key interactions:**
- Click each gallery
- Toggle download/watermark settings
- Verify different gallery states

#### Portfolio: `http://localhost:3001/dashboard/portfolio`
- [ ] Portfolio sections display
- [ ] Images/placeholders load
- [ ] Gallery arrangement is clear
- [ ] Publishing controls work

#### Settings: `http://localhost:3001/dashboard/settings`
- [ ] Settings form displays
- [ ] Profile information shows
- [ ] Theme toggle (dark/light mode) works globally
- [ ] Save button is functional

---

## 🧪 Testing Sequence

### Quick Path (5 minutes)
1. Go to `/login`
2. Login with test credentials
3. Navigate to `/dashboard/bookings`
4. Click a booking to see detail
5. Try filters and search
6. Toggle theme (dark/light mode)

### Complete Path (15 minutes)
1. Test `/login` page (login success)
2. Test `/register` page (photographer registration flow)
3. Test all dashboard pages in order:
   - `/dashboard` (home/overview)
   - `/dashboard/bookings` (filter, search, detail)
   - `/dashboard/leads` (score filtering)
   - `/dashboard/clients` (client details)
   - `/dashboard/galleries` (image management)
   - `/dashboard/portfolio` (portfolio view)
   - `/dashboard/settings` (settings & theme)

---

## 🎨 UI Elements to Verify

### Colors (Light Mode)
- Background: `#F7F8FA` (light gray)
- Card: `#FFFFFF` (white)
- Text: `#111827` (dark)
- Subtext: `#6B7280` (gray)
- Accent: `#2563EB` (blue)

### Colors (Dark Mode)
- Background: `#111827` (dark)
- Card: `#1F2937` (dark gray)
- Text: `#F3F4F6` (light)
- Subtext: `#D1D5DB` (light gray)
- Accent: `#2563EB` (blue)

### Interactive Elements
- [ ] Buttons have hover states
- [ ] Inputs have focus states
- [ ] Dropdowns/selects work
- [ ] Toggle switches work
- [ ] Theme toggle affects all pages
- [ ] Responsive layout on mobile

---

## 🔍 What to Look For

### Performance
- [ ] Pages load within 2 seconds
- [ ] No console errors (F12 Dev Tools)
- [ ] No memory leaks
- [ ] Smooth transitions and animations

### Data Display
- [ ] Mock data displays correctly
- [ ] Currency formatting (€) is correct
- [ ] Dates format consistently
- [ ] Numbers display with proper formatting

### User Experience
- [ ] All buttons are clickable
- [ ] Form inputs accept text
- [ ] Search filters work smoothly
- [ ] Page transitions are smooth
- [ ] Theme toggle works globally

### Responsive Design
- [ ] Desktop (1920px): All columns visible
- [ ] Tablet (768px): Layout adapts
- [ ] Mobile (375px): Stack layout, touch-friendly

---

## ⚠️ Known Issues & Notes

### Pending Backend Implementation
The following features are UI-ready but need backend endpoints:
- [ ] Real API calls for leads (currently using mock data)
- [ ] Real API calls for clients (currently using mock data)
- [ ] Real API calls for galleries (currently using mock data)
- [ ] Gallery image uploads
- [ ] Portfolio management
- [ ] Client communication endpoints

### Current Limitations
- Mock data only - no real data from backend
- Theme toggle is local (not persisted to backend)
- No real image uploads
- No real email/messaging integration
- No real payment processing

---

## 📊 Testing Form

### Fill Out While Testing

```
Page Name: _________________
Status: ☐ Pass ☐ Fail ☐ Partial
Issues Found: _________________________________________

Page Name: _________________
Status: ☐ Pass ☐ Fail ☐ Partial
Issues Found: _________________________________________
```

---

## 🚀 After Testing

Once you've verified all pages:
1. Check console for errors (F12)
2. Test theme toggle on each page
3. Note any visual inconsistencies
4. Report any performance issues
5. Commit the working code: `git add -A && git commit -m "feat: complete dashboard UI implementation"`

---

## 🔗 Quick Links

- **Login**: `http://localhost:3001/login`
- **Register**: `http://localhost:3001/register`
- **Dashboard Home**: `http://localhost:3001/dashboard`
- **Bookings**: `http://localhost:3001/dashboard/bookings`
- **Leads**: `http://localhost:3001/dashboard/leads`
- **Clients**: `http://localhost:3001/dashboard/clients`
- **Galleries**: `http://localhost:3001/dashboard/galleries`
- **Portfolio**: `http://localhost:3001/dashboard/portfolio`
- **Settings**: `http://localhost:3001/dashboard/settings`

---

## 📝 Notes

- All pages use mock data for testing
- Theme store (dark/light mode) persists in localStorage
- Auth state stored in Zustand store
- All styles use CSSProperties (inline styles)
- No external CSS files required

Last updated: 2026-04-24
