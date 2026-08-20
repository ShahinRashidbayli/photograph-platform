/**
 * Clients route.
 *
 * English is the source of truth — these keys define the `Clients` half of
 * `TranslationKey`, and every other locale is compile-checked against it.
 */
export const clients = {
  // ── Clients page ──────────────────────────────────────────────────────────
  'clients.title': 'Clients',
  'clients.subtitle': 'Manage client relationships, track sessions, and build lasting connections.',
  'clients.errorTitle': "Couldn't load clients",
  'clients.errorLoad': 'We couldn’t load your clients. Please check your connection and try again.',
  'clients.loadingDetails': 'Loading client details…',
  'clients.stat.total': 'Total clients',
  'clients.stat.totalHint': '{amount} lifetime revenue',
  'clients.stat.activeHint': 'Clients with upcoming sessions',
  'clients.stat.avgSpend': 'Average spend',
  'clients.stat.avgSpendHint': 'Per client lifetime',
  'clients.listTitle': 'All clients',
  'clients.listSubtitle': 'Sorted by recent activity · spend & bookings at a glance',
  'clients.search.placeholder': 'Search name or email…',
  'clients.filter.All': 'All',
  'clients.filter.Active': 'Active',
  'clients.filter.Repeat': 'Repeat',
  'clients.empty.noneTitle': 'No clients yet',
  'clients.empty.noneBody':
    'Clients appear here automatically once you create their first booking.',
  'clients.empty.noMatchTitle': 'No clients match',
  'clients.bookingCount_one': '{count} booking',
  'clients.bookingCount_other': '{count} bookings',
  'clients.upcomingBadge': '{count} upcoming',

  'clientDetail.noneSelectedTitle': 'No client selected',
  'clientDetail.noneSelectedBody': 'Pick a client from the list to see details.',
  'clientDetail.joined': 'Joined {date}',
  'clientDetail.stat.totalSpent': 'Total spent',
  'clientDetail.stat.bookings': 'Bookings',
  'clientDetail.stat.upcoming': 'Upcoming',
  'clientDetail.stat.lastSession': 'Last session',
  'clientDetail.contactInfo': 'Contact information',
  'clientDetail.email': 'Email',
  'clientDetail.phone': 'Phone',
  'clientDetail.joinedLabel': 'Joined',
  'clientDetail.notes': 'Client notes',
  'clientDetail.noNotes': 'No notes added for this client yet.',
  'clientDetail.notesEdit': 'Edit',
  'clientDetail.notesSave': 'Save',
  'clientDetail.notesSaving': 'Saving…',
  'clientDetail.notesCancel': 'Cancel',
  'clientDetail.notesPlaceholder': 'Add a private note about this client…',
  'clientDetail.notesError': 'Couldn’t save the note. Please try again.',
} as const;

export type EnClients = typeof clients;
