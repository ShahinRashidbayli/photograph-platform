# User Workflows & Feature Matrix

## Feature Comparison Matrix

### Access Control

| Feature | Photographer | Admin | Customer |
|---------|-------------|-------|----------|
| **Dashboard** | ✅ Full | ✅ Full | ✅ Limited |
| **Bookings** | ✅ Manage | ✅ Manage | 👁️ View Only |
| **Leads** | ✅ Full | ✅ Full | ❌ None |
| **Clients** | ✅ Full | ✅ Full | ❌ None |
| **Portfolio** | ✅ Manage | ✅ Manage | 👁️ View Only |
| **Galleries** | 📤 Upload | 📤 Upload | 📥 Download |
| **Settings** | ✅ Studio | ✅ All | 👤 Profile Only |
| **Payment Methods** | ✅ Yes | ✅ Yes | ❌ No |
| **Client Management** | ✅ Yes | ✅ Yes | ❌ No |

---

## Complete User Workflows

### Workflow 1: New Inquiry to Booking

#### Photographer's Perspective

**Step 1: Lead Inquiry Received**
```
Customer visits photographer's website
↓
Fills out inquiry form
↓
Lead appears in Leads page
  - Status: NEW
  - Score calculated (HIGH/MED/LOW)
  - Budget range set
```

**Step 2: Review & Qualify**
```
Navigate: /leads
↓
See incoming lead:
  - Name: Maria & Klaus
  - Event: Wedding
  - Date: June 15, 2026
  - Budget: €500+
  - Score: HIGH
↓
Read inquiry message
↓
Check internal scoring algorithm
```

**Step 3: Respond to Lead**
```
Click "Reply with message"
↓
Compose custom response:
  "Thank you for reaching out! We'd love to photograph your wedding. 
   Let's schedule a call to discuss details."
↓
Send message
↓
Lead status updates: NEW → REPLIED
↓
Lead appears in Recent Leads section of dashboard
```

**Step 4: Customer Responds**
```
Wait for customer to confirm booking details
↓
Customer agrees to terms
↓
...
```

**Step 5: Convert to Booking**
```
Navigate: /leads
↓
Click "Convert to booking"
↓
System creates booking:
  - Booking ID: b-123
  - Client name: Maria & Klaus
  - Event date: June 15, 2026
  - Package: Wedding
  - Proposed amount: €1,200
↓
Lead status updates: BOOKED
↓
New booking appears in:
  - /bookings (management page)
  - /dashboard (upcoming section)
```

**Step 6: Manage Booking**
```
Navigate: /bookings
↓
See new booking in list
↓
Click to view details:
  - Client: Maria & Klaus
  - Date: Jun 15
  - Status: DEPOSIT (awaiting payment)
  - Amount: €1,200
  - Deposit: €300 (25%)
↓
Send payment link to customer
↓
Wait for deposit payment
```

**Step 7: Deposit Received**
```
Customer makes deposit payment
↓
Payment appears in booking:
  - Deposit paid: €300
  - Progress bar: 25% filled
  - Status: CONFIRMED (once full payment received or event date approaches)
↓
Booking appears in:
  - Dashboard upcoming bookings
  - Bookings list as CONFIRMED
↓
Client added to Clients page with:
  - Name: Maria & Klaus
  - Total spent: €300
  - Bookings completed: 0
  - Upcoming bookings: 1
  - Last booking: June 15, 2026
```

**Step 8: On Session Day**
```
June 15, 2026 arrives
↓
Photographer conducts photo session
↓
Captures 500+ photos
```

**Step 9: Post-Processing & Delivery**
```
Photographer edits and selects best photos (100 images)
↓
Navigate: /bookings
↓
Click booking
↓
Click "Upload gallery"
↓
System creates gallery:
  - Booking: Maria & Klaus
  - Photo count: 100
  - Access: Ready
  - Expiry: 90 days from today
  - Gallery link: gallery.fotolio.app/gal-abc123
↓
Gallery added to:
  - Customer's /galleries (ready to download)
  - Dashboard recent galleries section
  - Booking detail: "Photos delivered"
```

**Step 10: Customer Downloads**
```
Customer logs in to /galleries
↓
Sees "Wedding Session" gallery:
  - Photos: 100
  - Status: Ready
  - Expires: 90 days
↓
Clicks "View Gallery"
↓
Downloads photos (single or batch)
↓
Gallery link shared with family/friends (optional)
↓
After 90 days: Gallery link expires, access revoked
```

---

### Workflow 2: New Customer (No Discovery)

**Scenario**: Photographer has existing customer who needs to use platform

**Step 1: Photographer Invites Customer**
```
Photographer wants to use Fotolio with existing client
↓
Sends customer the link with special invite code
↓
Customer clicks link
```

**Step 2: Customer Signs Up**
```
Create account with role: CUSTOMER
↓
Enter name and email
↓
Link to photographer's studio
```

**Step 3: Customer's First Experience**
```
Navigate to /dashboard
↓
See:
  - Photographer name: "Anna Müller"
  - Upcoming sessions: 0
  - Photos delivered: 0
  - Total spent: €0
↓
No bookings yet → "No upcoming sessions"
↓
No galleries yet → "No galleries available"
```

**Step 4: Photographer Creates Booking**
```
Photographer navigates: /bookings
↓
Clicks "New booking"
↓
Fills form:
  - Customer: (existing customer)
  - Event type: Wedding
  - Date: June 14, 2026
  - Amount: €1,700
  - Deposit: 50% (€850)
↓
Booking created
↓
Customer receives notification (email/push)
```

**Step 5: Customer Sees Booking**
```
Customer logs in to /dashboard
↓
New metric:
  - Upcoming sessions: 1
↓
Clicks "View all"
↓
Navigates to /bookings
↓
Sees booking:
  - Type: Wedding
  - Date: Jun 14
  - Status: DEPOSIT PENDING
  - Amount: €1,700
↓
Clicks booking to view:
  - Photographer: Anna Müller
  - Contact: +49 176 123 4567
  - Payment status: €0 paid of €1,700
  - Progress: 0%
  - Timeline:
    ✓ Booking confirmed
    ○ Session day (Jun 14)
    ○ Photos delivered
↓
Clicks "Message" button
↓
Can contact photographer about session details
```

**Step 6: Customer Views Portfolio**
```
On /dashboard
↓
Clicks "View portfolio"
↓
Navigates to /portfolio
↓
Sees photographer's collections:
  - Weddings (24 photos)
  - Portraits (18 photos)
  - Events (15 photos)
  - Fashion (12 photos)
  - Nature (21 photos)
↓
Clicks "Weddings" collection
↓
Sees portfolio items:
  - Previous weddings with photos
  - Like counts and engagement
  - Gives customer confidence in photographer's work
```

---

### Workflow 3: Photographer's Daily Dashboard Check

**Time**: Morning (8 AM)
**Photographer**: Wants daily business overview

**Step 1: Open Dashboard**
```
Log in to /dashboard
↓
See header: "Welcome back, Anna! 👋"
↓
Studio overview: "PRO Plan"
```

**Step 2: Check Metrics**
```
Quickly scan 4 metric cards:

1. Bookings this month: 14 ↑ +18%
   → Know this month is busier than last month
   
2. Revenue (Apr): €4,720 ↑ +12%
   → Track monthly income

3. Active clients: 32 (8 new)
   → Know how many clients to manage

4. New leads: 7 (3 high priority)
   → Priority prospects to follow up on
```

**Step 3: Check Upcoming Sessions**
```
See "Upcoming bookings" section:
- Today at 2 PM: Family portrait session (confirmed)
- Tomorrow: Stefan & Eva (wedding, deposit pending)
- Next week: Corporate event

Use this to prepare for the day
```

**Step 4: Check Hot Leads**
```
See "Recent leads" section:
- Maria & Klaus (HIGH priority, wedding)
- Laura & Ben (HIGH priority, engagement)
- Sophie Richter (MEDIUM priority, portrait)

→ Know which leads need immediate response
```

**Step 5: Drill Down into Details**
```
Click on high-priority lead: Maria & Klaus
↓
Navigate to /leads detail
↓
Review:
  - Contact info
  - Event details
  - Budget: €500+
  - Score: 9/10 (excellent lead)
↓
Read inquiry message
↓
Decide to reply immediately
↓
Click "Reply with message"
↓
Send personalized response
↓
Status updates: NEW → REPLIED
```

---

### Workflow 4: Customer Session Timeline

**Customer**: Maria & Klaus (wedding couple)
**Photographer**: Anna Müller

#### Phase 1: Pre-Session

**Day 1: Booking Confirmed**
```
Customer logs in to Fotolio
↓
Navigates: /bookings
↓
Sees new booking:
  - Wedding session
  - Date: June 14, 2026
  - Status: DEPOSIT PENDING
  - Amount: €1,700
↓
Reads photographer's notes:
  "Ceremony at St. Michael Church, reception at Hotel Adlon.
   6 hours coverage. Standard package includes 150-200 edited photos."
↓
Can message photographer with questions
```

**Day 7: Payment Due**
```
Photographer sends payment reminder
↓
Customer navigates: /bookings
↓
Clicks booking
↓
Sees: "Outstanding: €850"
↓
Makes deposit payment via link
↓
Payment shows in booking:
  - Paid: €850
  - Remaining: €850
  - Progress: 50%
```

**Day 30: Final Payment Due**
```
Customer makes final payment
↓
Booking shows:
  - Paid: €1,700
  - Remaining: €0
  - Status: CONFIRMED ✓
  - Progress: 100%
```

#### Phase 2: Session Day

**June 14: Wedding Day**
```
Customer has session with photographer

In Fotolio, customer sees:
  - Timeline shows: ✓ Confirmed → ○ Session day (today) → ○ Photos delivered
```

#### Phase 3: Post-Session

**June 20: Photos Delivered (6 days post-session)**
```
Photographer edits and uploads gallery
↓
Customer receives notification
↓
Customer logs in to /galleries
↓
Sees new gallery: "Wedding Session"
  - Photos: 150
  - Status: ✓ Ready to download
  - Expires: September 20, 2026 (90 days)
  - Shared: Not shared yet
↓
Clicks "View Gallery"
↓
Sees all wedding photos with photographer's edits
↓
Can download:
  - Individual photos
  - All photos as ZIP
  - Digital delivery to family
```

**July 1: Gallery Viewed (11 days)**
```
Customer shares gallery link with family
↓
Family members view gallery
↓
View count increases: 1 → 5
↓
Photographer can see:
  - Gallery has been viewed
  - View count: 5 views
  - Indicates customer is pleased (sharing with others)
```

**September 20: Gallery Expires**
```
90 days after upload
↓
Gallery expires:
  - Link no longer works
  - Customer can no longer download
  - Photos are archived by photographer
↓
In Fotolio, gallery status changes to "Expired"
```

---

### Workflow 5: Managing Multiple Bookings (Photographer)

**Photographer**: Anna Müller (4 bookings in May)

**Step 1: Navigate to Bookings**
```
/bookings
↓
See stats:
  - Active bookings: 5
  - Revenue: €5,970
  - Deposits pending: 3
↓
List shows:
  - Apr 22 (past) - Yilmaz & Chen (CONFIRMED)
  - Apr 26 - Braun family (CONFIRMED)
  - May 03 - Stefan & Eva (DEPOSIT)
  - May 10 - J. Lange (DEPOSIT)
  - May 17 - Siemens Corp (CONFIRMED)
```

**Step 2: Check Payment Status**
```
Click on each booking to see:
  - Total: €1,200
  - Paid: €300 (DEPOSIT: €1,200)
  - Remaining: €900
  - Progress: 25% ▓░░░░░░░░░░
↓
Identify which deposits are overdue
```

**Step 3: Send Payment Reminders**
```
For overdue deposits:
  - Click booking
  - Click "Email" button
  - Sends payment reminder to customer
↓
Or use "WhatsApp" for quick message
```

**Step 4: Track Session Progress**
```
For confirmed bookings:
  - See timeline in detail
  - Know session is in 10 days
  - Prepare location scouts, equipment
```

**Step 5: Edit Booking Details**
```
If customer requests reschedule:
  - Click "Edit"
  - Change event date
  - Update notes
  - Save
↓
Customer sees updated info in their /bookings view
```

**Step 6: Cancel If Needed**
```
Customer cancels:
  - Click "Cancel"
  - Choose reason
  - Process refund if applicable
↓
Booking status: CANCELLED
↓
Booking moves to archive/past bookings
```

---

### Workflow 6: Portfolio Showcase

#### Photographer's Perspective

**Step 1: Access Portfolio**
```
Navigate: /portfolio
↓
See collections list:
  - Weddings (24 photos) ☆ Featured
  - Portraits (18 photos)
  - Events (15 photos)
  - Fashion (12 photos)
  - Nature (21 photos)
```

**Step 2: Organize Collections**
```
Click "Edit" on collection
↓
Can:
  - Rename collection
  - Mark as featured
  - Reorder items
  - Delete items
↓
Featured collections show with star (☆)
↓
Customers see featured collections first
```

**Step 3: Add New Photos**
```
After session with Maria & Klaus
↓
Create new collection: "Weddings - June 2026"
↓
Upload 100 photos
↓
Select 20 best for portfolio showcase
↓
Portfolio updated for customers to see
```

#### Customer's Perspective

**Step 1: Browse Portfolio**
```
Before booking with Anna
↓
Click "View portfolio" button
↓
Navigate to /portfolio
↓
See Anna's work organized by type:
  - Weddings (featured first)
  - Portraits
  - Events
  - Fashion
  - Nature
```

**Step 2: Explore Collection**
```
Click "Weddings" collection
↓
See 24 wedding photos in gallery grid
↓
See stats:
  - Photos: 24
  - Total likes: 287
  - Avg likes: 12 per photo
  - Top photo: 45 likes
↓
Shows quality of photographer's work
↓
Get inspired for own wedding session
```

**Step 3: Decide to Book**
```
Impressed by portfolio
↓
Click "Book now"
↓
Or contact photographer via message
↓
Eventually schedules session
```

---

## Key Differences: Photographer vs Customer

### Information Visibility

| Information | Photographer Sees | Customer Sees |
|-------------|------------------|--------------|
| **Client email** | ✅ Yes | ❌ No |
| **Client phone** | ✅ Yes | ✅ Photographer's phone |
| **Lead source** | ✅ Yes | ❌ N/A |
| **Internal notes** | ✅ Yes | ❌ No |
| **Payment details** | ✅ All | ✅ Own payment only |
| **Photographer info** | ❌ N/A | ✅ Yes |
| **Portfolio** | ✅ Edit | ✅ View |
| **Gallery links** | ✅ All | ✅ Own galleries |

### Actions Available

| Action | Photographer | Customer |
|--------|-------------|----------|
| **Create booking** | ✅ Yes | ❌ No |
| **Edit booking** | ✅ Yes | ❌ No |
| **Cancel booking** | ✅ Yes | ❌ No |
| **Upload gallery** | ✅ Yes | ❌ No |
| **Download photos** | ✅ Yes | ✅ Yes |
| **Share gallery** | ✅ Yes | ✅ Yes |
| **Send message** | ✅ Yes | ✅ Yes |
| **Add notes** | ✅ Yes | ❌ No |
| **Edit portfolio** | ✅ Yes | ❌ No |
| **View analytics** | ✅ Yes | ❌ No |

---

## Error Scenarios & Recovery

### Photographer Issues

**Issue 1: Customer Doesn't Pay Deposit**
```
Booking shows: DEPOSIT PENDING for 14 days
↓
Photographer receives reminder notification
↓
Options:
  1. Send email reminder
  2. Send WhatsApp message
  3. Call customer
  4. Cancel booking if needed
```

**Issue 2: Wrong Session Date Entered**
```
Photographer realizes mistake day before session
↓
Navigates: /bookings
↓
Clicks "Edit"
↓
Changes date to correct date
↓
Customer is notified of change
↓
Customer can confirm on their end
```

**Issue 3: Gallery Upload Failed**
```
Photographer tries to upload 500MB gallery
↓
System shows: "File too large"
↓
Options:
  - Compress photos
  - Upload in batches
  - Use external link for additional photos
```

### Customer Issues

**Issue 1: Can't Find Payment Link**
```
Customer needs to pay but can't find link
↓
Navigates: /bookings
↓
Clicks booking
↓
Sees: "Outstanding: €850"
↓
Clicks "Make payment"
↓
Directed to payment portal
```

**Issue 2: Gallery Link Expired**
```
Customer wants to re-download photos 100 days after delivery
↓
Navigates: /galleries
↓
Sees: "❌ Expired" badge
↓
Can't download
↓
Options:
  - Contact photographer to re-enable
  - Ask photographer to re-upload
  - Photos may be archived
```

**Issue 3: Booking Date Wrong**
```
Customer sees wrong session date in /bookings
↓
Clicks "Message photographer"
↓
Reports the issue
↓
Photographer receives message
↓
Photographer edits booking
↓
Customer sees updated date automatically
```

---

## Success Metrics by Role

### Photographer Success

- ✅ Conversion rate: Leads → Bookings (target: 40%+)
- ✅ Deposit collection rate (target: 100%)
- ✅ Final payment collection rate (target: 98%+)
- ✅ Gallery delivery time: <7 days after session
- ✅ Customer satisfaction: Repeat booking rate (target: 30%+)
- ✅ Portfolio engagement: Views on portfolio collections

### Customer Success

- ✅ Session confirmation: Booking status reached CONFIRMED
- ✅ Payment completed: No outstanding balance
- ✅ Gallery access: Photos delivered and downloadable
- ✅ Download completion: Actually downloaded photos
- ✅ Satisfaction: Willing to refer photographer to friends
- ✅ Repeat business: Books another session

---

## Future Workflow Enhancements

### Phase 2 Features
- **Automated reminders**: Payment due emails, session day reminders
- **Scheduling calendar**: Photographer's availability calendar
- **Rating/reviews**: Customers rate photographer after session
- **Referral tracking**: Track which clients referred new leads
- **Package templates**: Pre-set pricing packages
- **Contract management**: Digital contract signing

### Phase 3 Features
- **Video integration**: Send samples, instructions via video
- **Group galleries**: Multiple photographers upload to same gallery
- **Invoicing**: Generate and send invoices
- **Tax reporting**: Annual revenue reports
- **Team management**: Multiple team members (assistants, editors)
- **Mobile app**: iOS/Android native apps

---

## Summary

Fotolio streamlines the photography business workflow:

1. **Photographers** use it to manage leads, bookings, clients, and portfolio
2. **Customers** use it to track their session, monitor payments, and access photos
3. **The platform** ensures proper communication and payment flow
4. **Both benefit** from organized, professional workflow management

The role-based access ensures each user type sees exactly what they need, no more, no less.
