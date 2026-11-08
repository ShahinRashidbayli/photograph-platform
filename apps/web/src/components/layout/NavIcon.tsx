import type { NavIconKey } from '@/lib/nav';

/**
 * The sidebar's drawings, looked up by the key a nav row carries.
 *
 * <p>They are all 14×14 line art rendered at 16px in {@code currentColor}, so a
 * row's own colour (active, muted, locked) reaches the icon without the icon
 * knowing anything about it. A registry rather than a component per icon: the
 * set is closed by {@link NavIconKey}, and a missing entry is a type error
 * rather than a blank square in the sidebar.
 */
const ICONS: Record<NavIconKey, React.ReactNode> = {
  overview: (
    <>
      <rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="8" y="1" width="5" height="5" rx="1" fill="currentColor" opacity=".5" />
      <rect x="1" y="8" width="5" height="5" rx="1" fill="currentColor" opacity=".5" />
      <rect x="8" y="8" width="5" height="5" rx="1" fill="currentColor" opacity=".5" />
    </>
  ),
  bookings: (
    <>
      <rect
        x="1"
        y="2.5"
        width="12"
        height="9.5"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M1 5.5h12" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4.5 1v3M9.5 1v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </>
  ),
  leads: (
    <path
      d="M2 11l3-3 2 2 3-4 2 2"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  instagram: (
    <>
      <rect
        x="1.5"
        y="1.5"
        width="11"
        height="11"
        rx="3.2"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <circle cx="7" cy="7" r="2.6" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="10.2" cy="3.8" r=".85" fill="currentColor" />
    </>
  ),
  clients: (
    <>
      <circle cx="5.5" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M1 12c0-2.49 2.01-4.5 4.5-4.5S10 9.51 10 12"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M10 6.5l1.5 1.5L14 5.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  contracts: (
    <>
      <path
        d="M3 1.5h5l3 3v8a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M8 1.5v3h3M4.75 8.5h4.5M4.75 10.5h2.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </>
  ),
  portfolio: (
    <>
      <rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M3.5 4.5h7M3.5 7h5M3.5 9.5h3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </>
  ),
  // A picture, not a house: the house sat beside the client's "Overview",
  // which is where a house would send you.
  galleries: (
    <>
      <rect x="1" y="1.5" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="4.75" cy="5" r="1.1" stroke="currentColor" strokeWidth="1.1" />
      <path
        d="M1.5 11l3.5-3.5 2.5 2.5 2-2 3 3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  // A key rather than a room: what is yours about a rentable space is that
  // you hold it and hand it over, which is also what separates this row from
  // the community's Studios.
  space: (
    <>
      <circle cx="4.5" cy="4.5" r="3" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M6.6 6.6L12.5 12.5M10 10l1.4-1.4M8.3 8.3l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </>
  ),
  offerings: (
    <>
      <path
        d="M7 1.8L13 5l-6 3.2L1 5l6-3.2z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M3.4 6.4v3.4c0 .9 1.6 1.8 3.6 1.8s3.6-.9 3.6-1.8V6.4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </>
  ),
  locations: (
    <>
      <path
        d="M7 12.5S2.5 8.9 2.5 5.9a4.5 4.5 0 1 1 9 0c0 3-4.5 6.6-4.5 6.6z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="5.8" r="1.5" stroke="currentColor" strokeWidth="1.2" />
    </>
  ),
  studios: (
    <>
      <path
        d="M1.5 12.5v-8l5-3v11M6.5 5.5l6 2v5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 6.5v0M3.5 9v0M9.5 9v0"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </>
  ),
  learning: (
    <>
      <path
        d="M7 3.6C5.9 2.6 4.4 2.2 1.5 2.2v8.4c2.9 0 4.4.4 5.5 1.4 1.1-1 2.6-1.4 5.5-1.4V2.2c-2.9 0-4.4.4-5.5 1.4z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M7 3.6V12" stroke="currentColor" strokeWidth="1.2" />
    </>
  ),
  gear: (
    <>
      <path
        d="M1.5 4.5h2.2l1-1.6h4.6l1 1.6h2.2v7.2a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5V4.5z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="8.2" r="2.3" stroke="currentColor" strokeWidth="1.2" />
    </>
  ),
  revenue: (
    <path
      d="M2 11.5V8m3.33 3.5V5.5M8.67 11.5v-5M12 11.5v-9"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
  ),
  reports: (
    <>
      <path
        d="M3 1.5h5l3 3v8a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M8 1.5v3h3M4.75 8h4.5M4.75 10.25h3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </>
  ),
  payments: (
    <>
      <rect x="1" y="3" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1 5.5h12" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3.5 8.5h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </>
  ),
  documents: (
    <>
      <path
        d="M3 1.5h5l3 3v8a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M8 1.5v3h3M4.75 9.5h4.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </>
  ),
};

export function NavIcon({ name }: { name: NavIconKey }) {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}
