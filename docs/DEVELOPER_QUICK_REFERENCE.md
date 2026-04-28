# Developer Quick Reference

## Quick Navigation

### File Locations
```
apps/web/src/app/(dashboard)/
├── layout.tsx                          # Shared navigation, theme, auth
├── dashboard/
│   └── page.tsx                        # Overview (role-aware)
├── bookings/
│   ├── page.tsx                        # Bookings (role-aware)
│   └── bookings.styles.ts              # Booking styles
├── leads/
│   ├── page.tsx                        # Lead management (photographer only)
│   └── leads.styles.ts                 # Lead styles
├── clients/
│   ├── page.tsx                        # Client management (photographer only)
│   └── clients.styles.ts               # Client styles
├── portfolio/
│   ├── page.tsx                        # Portfolio showcase (both roles)
│   └── portfolio.styles.ts             # Portfolio styles
└── galleries/
    ├── page.tsx                        # Gallery management (customer only)
    └── galleries.styles.ts             # Gallery styles
```

---

## Core Patterns

### 1. Role Detection
```ts
import { useAuthStore } from '@/store/authStore';

export default function Page() {
  const { user } = useAuthStore();
  const isPhotographer = user?.role === 'photographer' || user?.role === 'admin';
  
  if (!isPhotographer) {
    // Customer view
    return <CustomerView />;
  }
  
  // Photographer view
  return <PhotographerView />;
}
```

### 2. Theme Integration
```ts
import { useThemeStore } from '@/store/themeStore';

export default function Page() {
  const { theme } = useThemeStore();
  
  const colors = {
    light: { bg: '#F9FAFB', text: '#111827', ... },
    dark: { bg: '#111827', text: '#F3F4F6', ... },
  };
  
  const activeColors = colors[theme];
  
  return (
    <div style={{ 
      background: activeColors.bg,
      color: activeColors.text,
      transition: 'background 0.3s ease, color 0.3s ease'
    }}>
      Content
    </div>
  );
}
```

### 3. List + Detail Panel
```ts
const [selectedId, setSelectedId] = useState<string | null>(null);
const [searchQuery, setSearchQuery] = useState('');
const [filterStatus, setFilterStatus] = useState<Status>('All');

const filtered = useMemo(() => {
  let result = items;
  if (filterStatus !== 'All') result = result.filter(item => item.status === filterStatus);
  if (searchQuery.trim()) result = result.filter(item => item.name.includes(searchQuery));
  return result;
}, [items, filterStatus, searchQuery]);

const selected = useMemo(
  () => items.find(i => i.id === selectedId) || items[0] || null,
  [items, selectedId]
);

return (
  <div style={{ display: 'flex', gap: '16px' }}>
    {/* Left Panel */}
    <div style={{ width: '320px' }}>
      <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
      <div>
        {filtered.map(item => (
          <button onClick={() => setSelectedId(item.id)}>
            {item.name}
          </button>
        ))}
      </div>
    </div>
    
    {/* Right Panel */}
    <div style={{ flex: 1 }}>
      {selected ? <Detail item={selected} /> : <EmptyState />}
    </div>
  </div>
);
```

### 4. Style Objects
```ts
// Create in a .styles.ts file
export const pageStyles: Record<string, React.CSSProperties> = {
  pageWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    padding: '22px',
    minHeight: '100vh',
  },
  // ... more styles
};

// Use in component
import { pageStyles as styles } from './page.styles';

<div style={styles.pageWrapper}>
  <div style={{ ...styles.card, background: colors.cardBg, color: colors.text }}>
    // Component content
  </div>
</div>
```

### 5. Color Application
```ts
// Static colors (never change)
style={{ color: '#111827' }}

// Theme-aware colors (ALWAYS use this pattern)
style={{ 
  color: colors.text,
  background: colors.cardBg,
  borderColor: colors.border,
  transition: 'background 0.3s ease, color 0.3s ease'
}}

// Active/Hover states with theme
style={{ 
  background: isActive ? 'rgba(37, 99, 235, 0.1)' : colors.cardBg,
  color: colors.text
}}
```

---

## Styling Conventions

### Metric Cards
```ts
const metric = {
  label: 'Bookings',
  value: '14',
  trend: '↑ +18%',
  sub: 'from last month',
  accent: '#3B82F6'
};

<div style={{
  background: colors.card,
  padding: '16px 20px',
  borderRadius: '12px',
  borderLeft: `3px solid ${metric.accent}`,
}}>
  <div style={{ fontSize: '11px', fontWeight: 700, color: colors.subText }}>
    {metric.label}
  </div>
  <div style={{ fontSize: '24px', fontWeight: 800, color: colors.text }}>
    {metric.value}
  </div>
  <div style={{ fontSize: '11px', color: metric.accent }}>
    {metric.trend} <span style={{ color: colors.subText }}>{metric.sub}</span>
  </div>
</div>
```

### Status Badges
```ts
const badge = {
  CONFIRMED: { bg: '#D1FAE5', color: '#065F46', label: 'Confirmed' },
  DEPOSIT: { bg: '#FEF3C7', color: '#92400E', label: 'Deposit' },
};

<span style={{
  padding: '6px 12px',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 700,
  background: badge.bg,
  color: badge.color,
}}>
  {badge.label}
</span>
```

### List Items
```ts
// Standard list item grid
gridTemplateColumns: '56px 1fr 110px',
gap: '14px',
padding: '14px 16px',
borderRadius: '16px',

// Three columns: date box | content | amount/badge
// Date box is 56px fixed
// Content takes remaining space
// Amount/badge is 110px fixed
```

---

## Common Tasks

### Add a New Page
1. Create folder: `apps/web/src/app/(dashboard)/[pageName]/`
2. Create styles: `[pageName].styles.ts`
3. Create component: `page.tsx`
4. Add to navigation in `layout.tsx`:
   ```ts
   { label: 'Page Name', href: '/[pageName]', icon: <svg>...</svg> }
   ```
5. Use existing pattern (list+detail or dashboard)

### Add a New Filter
```ts
const [filterStatus, setFilterStatus] = useState<'All' | 'Active' | 'Inactive'>('All');

const filtered = useMemo(() => {
  let result = items;
  if (filterStatus !== 'All') {
    result = result.filter(item => item.status === filterStatus);
  }
  return result;
}, [items, filterStatus]);

// In JSX
{(['All', 'Active', 'Inactive'] as const).map(status => (
  <button
    key={status}
    onClick={() => setFilterStatus(status)}
    style={{
      background: filterStatus === status ? '#2563EB' : 'transparent',
      color: filterStatus === status ? '#fff' : colors.subText,
    }}
  >
    {status}
  </button>
))}
```

### Add Search
```ts
const [searchQuery, setSearchQuery] = useState('');

const filtered = useMemo(() => {
  if (!searchQuery.trim()) return items;
  const query = searchQuery.toLowerCase();
  return items.filter(item =>
    item.name.toLowerCase().includes(query) ||
    item.email.toLowerCase().includes(query)
  );
}, [items, searchQuery]);

// In JSX
<input
  type="text"
  value={searchQuery}
  onChange={e => setSearchQuery(e.target.value)}
  placeholder="Search..."
  style={{
    padding: '12px 14px',
    border: `1px solid ${colors.border}`,
    borderRadius: '12px',
    background: colors.bg,
    color: colors.text,
  }}
/>
```

### Apply Theme Colors to Inline Styles
```ts
// Pattern: Spread base style, then override with theme colors
<div style={{
  ...styles.card,           // Base styles from .styles.ts
  background: colors.cardBg, // Theme color override
  color: colors.text,        // Theme color override
  borderColor: colors.border, // Theme color override
  transition: 'all 0.3s ease' // Always add smooth transition
}}>
  Content
</div>
```

### Add a Role-Specific View
```ts
import { useAuthStore } from '@/store/authStore';

export default function Page() {
  const { user } = useAuthStore();
  const isPhotographer = user?.role === 'photographer' || user?.role === 'admin';
  
  // Photographer only
  if (isPhotographer) {
    return <PhotographerView />;
  }
  
  // Customer view (or everyone else)
  return <CustomerView />;
}
```

---

## Hooks & Utilities

### useThemeStore
```ts
const { theme, toggleTheme } = useThemeStore();
// theme: 'light' | 'dark'
// toggleTheme(): void
```

### useAuthStore
```ts
const { user, setUser, clearUser } = useAuthStore();
// user: { id, email, fullName, role, tenant }
// role: 'photographer' | 'admin' | 'customer'
```

### useSearchParams
```ts
const searchParams = useSearchParams();
const selected = searchParams.get('selected'); // Get query param
```

### useMemo
```ts
const filtered = useMemo(() => {
  // Expensive computation here
  return items.filter(...).map(...);
}, [items, filterStatus, searchQuery]); // Dependencies
```

### useEffect
```ts
useEffect(() => {
  // Run when component mounts or deps change
  const selected = searchParams.get('selected');
  if (selected) {
    setSelectedId(selected);
  }
}, [searchParams, selectedId]); // Dependencies
```

---

## Typography Scale

```ts
// Page title
fontSize: '22px',
fontWeight: 800,
letterSpacing: '-0.02em'

// Subtitle
fontSize: '13px',
fontWeight: 500,
letterSpacing: '-0.01em'

// Card title
fontSize: '16px',
fontWeight: 700,
letterSpacing: '-0.01em'

// List item title
fontSize: '14px',
fontWeight: 700,
letterSpacing: '-0.01em'

// List item meta
fontSize: '12px',
fontWeight: 500,

// Label (uppercase)
fontSize: '11px',
fontWeight: 700,
textTransform: 'uppercase',
letterSpacing: '0.05em'

// Stat value (large)
fontSize: '28px',
fontWeight: 800,
letterSpacing: '-0.01em'
```

---

## Spacing Scale

```ts
gap: '4px'    // Tiny
gap: '8px'    // Small
gap: '12px'   // Medium
gap: '16px'   // Large
gap: '20px'   // X-Large
gap: '24px'   // XX-Large

padding: '8px 12px'   // Compact
padding: '12px 16px'  // Normal
padding: '16px 20px'  // Large
padding: '20px 24px'  // X-Large
```

---

## Border Radius Scale

```ts
borderRadius: '6px'   // Small (badges)
borderRadius: '8px'   // Medium (buttons, inputs)
borderRadius: '10px'  // Large (cards)
borderRadius: '12px'  // X-Large (panels)
borderRadius: '16px'  // XX-Large (major sections)
borderRadius: '18px'  // Header sections
```

---

## Box Shadows

```ts
// Subtle
boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)'

// Small
boxShadow: '0 4px 12px rgba(17, 24, 39, 0.08)'

// Medium
boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)'

// Large
boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)'

// Dark mode
boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
```

---

## Icons

All icons are inline SVGs:
```ts
icon: (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="..." stroke="currentColor" strokeWidth="1.2"/>
  </svg>
)
```

Icon size: 14×14 for sidebar navigation

---

## Debugging

### Check If Role Detection Works
```ts
console.log(user?.role); // Should be 'photographer' or 'customer'
```

### Verify Theme Application
```ts
// Open DevTools, toggle theme
// Watch for color transitions
console.log(theme); // 'light' or 'dark'
```

### Check Mock Data
```ts
console.log(MOCK_BOOKINGS); // Verify data structure
console.log(selectedItem);  // Ensure item is selected
```

### Responsive Breakpoints
```ts
// Mobile: <576px
// Tablet: 576px-992px
// Desktop: >992px

// Media query example
@media (max-width: 768px) {
  [style*="gridTemplateColumns"] { 
    grid-template-columns: 1fr !important; 
  }
}
```

---

## Common Mistakes to Avoid

❌ **Don't**: Use hardcoded colors for text
```ts
color: '#111827' // BAD - won't work in dark mode
```

✅ **Do**: Use theme colors
```ts
color: colors.text // GOOD
```

---

❌ **Don't**: Forget transition on theme changes
```ts
background: colors.bg // Changes instantly
```

✅ **Do**: Add smooth transitions
```ts
background: colors.bg,
transition: 'background 0.3s ease'
```

---

❌ **Don't**: Compute expensive operations in render
```ts
const filtered = items.filter(...) // Recalculates every render
```

✅ **Do**: Use useMemo for expensive computations
```ts
const filtered = useMemo(() => items.filter(...), [items])
```

---

❌ **Don't**: Import useAuthStore without using it
```ts
import { useAuthStore } from '@/store/authStore'; // But never call it
```

✅ **Do**: Actually use the imported hook
```ts
const { user } = useAuthStore(); // Use it
```

---

## Type Definitions

All types are in `apps/web/src/types/api.ts`:

```ts
// Import in your component
import { Booking, Lead, Client, Gallery } from '@/types/api';

// Mock data
const MOCK_BOOKINGS: Booking[] = [...]
const MOCK_LEADS: Lead[] = [...]
const MOCK_CLIENTS: Client[] = [...]
const MOCK_GALLERIES: Gallery[] = [...]
```

---

## Testing Features

### Toggle Photographer/Customer Role
In `layout.tsx`, change mock user:
```ts
setUser({
  id: 'test-user',
  email: 'test@example.com',
  fullName: 'Test User',
  role: 'customer', // Change to 'customer' to test customer view
  tenant: { subdomain: 'test-studio', plan: 'PRO' },
});
```

### Toggle Theme
- Click theme toggle button in top-right header
- All pages should transition smoothly

### Test Search/Filter
- Type in search box → results update in real-time
- Click filter button → list filters immediately
- Selected item detail updates on selection

---

## Performance Tips

1. **Use useMemo for filtering/searching** to avoid recalculation
2. **Use useCallback for event handlers** if passed to children
3. **Lazy load images** in galleries (future optimization)
4. **Avoid inline object creation** in event handlers
5. **Use transition properties** for smooth animations

---

## Resources

- **Theme System**: `apps/web/src/store/themeStore.ts`
- **Auth System**: `apps/web/src/store/authStore.ts`
- **Type Definitions**: `apps/web/src/types/api.ts`
- **Documentation**: `docs/PLATFORM_DOCUMENTATION.md`
- **Next.js Docs**: https://nextjs.org/docs
- **React Hooks**: https://react.dev/reference/react

---

## Questions?

Refer to:
1. **Full Documentation**: `docs/PLATFORM_DOCUMENTATION.md`
2. **Existing Pages**: Study `bookings/page.tsx` as the reference implementation
3. **Style System**: Check `bookings/bookings.styles.ts` for pattern examples
4. **Type System**: View `apps/web/src/types/api.ts` for data structures
