/**
 * Leads route, its modals, and the shared lead vocabulary.
 *
 * English is the source of truth — these keys define the `Leads` half of
 * `TranslationKey`, and every other locale is compile-checked against it.
 */
export const leads = {
  // ── Lead vocabulary (status / event / budget / score) ─────────────────────
  'leadStatus.NEW': 'New',
  'leadStatus.REPLIED': 'Replied',
  'leadStatus.BOOKED': 'Booked',
  'leadStatus.REJECTED': 'Rejected',
  'leadEvent.WEDDING': 'Wedding',
  'leadEvent.ENGAGEMENT': 'Engagement',
  'leadEvent.PORTRAIT': 'Portrait',
  'leadEvent.FAMILY': 'Family',
  'leadEvent.NEWBORN': 'Newborn',
  'leadEvent.CORPORATE': 'Corporate',
  // Display form shown on lead cards. Deliberately distinct from `budget.*`
  // (the Overview's wording) — the two surfaces phrase the same enum
  // differently today, and unifying them is a copy decision, not a translation.
  'leadBudget.UNDER_200': 'under €200',
  'leadBudget.200_500': '€200–499',
  'leadBudget.500_1000': '€500+',
  'leadBudget.OVER_1000': '€1,000+',
  'leadScoreLabel.HIGH': 'High priority',
  'leadScoreLabel.MED': 'Medium priority',
  'leadScoreLabel.LOW': 'Low priority',
  'leadScoreShort.HIGH': 'High',
  'leadScoreShort.MED': 'Med',
  'leadScoreShort.LOW': 'Low',
  'leadUrgency.noDate': 'No date yet',
  'leadUrgency.noDateTitle': 'This lead did not name a date',
  'leadUrgency.past': 'Past',
  'leadUrgency.daysAway': '{count}d away',
  'leadUrgency.title': 'Event in {count} days',

  // ── Leads page ────────────────────────────────────────────────────────────
  'leads.title': 'Leads',
  'leads.subtitle': 'Qualify leads, track priorities, and convert prospects into bookings.',
  // Source axis: anonymous form leads vs authenticated-customer inquiries.
  'leads.source.all': 'All',
  'leads.source.form': 'Form',
  'leads.source.customer': 'Customers',
  'leads.source.badge.customer': 'Customer',
  'leads.source.badge.form': 'Form',
  'leads.exportCsv': 'Export CSV',
  'leads.exportAria': 'Export all leads as CSV',
  'leads.newLead': 'New lead',
  'leads.errorTitle': "Couldn't load leads",
  'leads.errorLoad': 'We couldn’t load your leads. Please check your connection and try again.',
  'leads.error.reject': 'Could not reject the lead. Please try again.',
  'leads.error.reply': 'Could not mark as replied. Please try again.',
  'leads.error.triage': 'Could not update the request. Please try again.',
  'leads.loadingDetails': 'Loading lead details…',
  'leads.convertToBooking': 'Convert to booking',
  'leads.viewInBookings': 'View in Bookings',
  // `{name}` / `{leads}` mark the segment rendered in bold — the code
  // splits the translated string on the placeholder, so each language keeps
  // its own word order.
  'leads.converted': 'Converted {name} to a booking.',
  // "Lead" is the umbrella for everything in this inbox, whichever way it
  // arrived. It used to say "enquiry" here while the tabs, the buttons and the
  // empty states all said "lead" — and worse, "Inquiry" is already the name of
  // one of the two sources feeding this list (a request from a signed-in
  // customer, as opposed to a form lead), so "5 enquiries" could be read as
  // either the whole list or half of it. One word per thing: a row is a lead,
  // and `Inquiry` stays reserved for where it came from.
  'leads.leadCount_one': '{count} lead',
  'leads.leadCount_other': '{count} leads',
  'leads.awaitingReply': '{leads} awaiting your reply.',
  'leads.review': 'Review',
  'leads.reject.title': 'Reject this lead?',
  'leads.reject.message':
    "{name}'s lead will be moved to Rejected. They won't be notified automatically. You can still see it in the Rejected tab.",
  'leads.reject.confirm': 'Reject lead',
  'leads.empty.noneTitle': 'No leads yet',
  'leads.empty.noneBody': 'New leads from your public booking page will appear here automatically.',
  'leads.empty.noMatchTitle': 'No leads match',
  'leads.empty.allResolvedBooked':
    'All your leads are in Booked ({booked}). Switch tabs to see them.',
  'leads.empty.allResolvedBoth':
    'All your leads are in Booked ({booked}) or Rejected ({rejected}). Switch tabs to see them.',

  'leads.filter.aria': 'Pipeline filter',
  'leads.pipeline.Active': 'Active',
  'leads.pipeline.Booked': 'Booked',
  'leads.pipeline.Rejected': 'Rejected',
  'leads.pipeline.All': 'All',
  'leads.search.placeholder': 'Search name, email, type…',
  'leads.search.aria': 'Search leads',
  'leads.score.all': 'All scores',
  'leads.filter.button': 'Filter',
  'leads.filter.openAria': 'Open filters',
  'leads.filter.score': 'Score',
  'leads.filter.source': 'Source',
  'leads.filter.clearAll': 'Clear all',
  'leads.search.clear': 'Clear search',
  'leads.chip.score': 'Score: {value}',
  'leads.chip.source': 'Source: {value}',
  'leads.chip.search': 'Search: “{value}”',
  'leads.chip.remove': 'Remove filter',
  'leads.sort.date': 'Date',
  'leads.sort.newestAria': 'Sorted newest first — switch to oldest first',
  'leads.sort.oldestAria': 'Sorted oldest first — switch to newest first',
  'leadList.hasNotes': 'Has internal notes',

  // ── Lead detail panel ─────────────────────────────────────────────────────
  'leadDetail.noneSelectedTitle': 'No lead selected',
  'leadDetail.noneSelectedBody': 'Pick a lead from the list to see details.',
  'leadDetail.bookedPill': 'Booked ✓',
  'leadDetail.bookedAria': 'Lead already converted to a booking',
  'leadDetail.facts': 'Lead facts',
  'leadDetail.fact.email': 'Email',
  'leadDetail.fact.phone': 'Phone',
  'leadDetail.fact.eventDate': 'Event date',
  'leadDetail.fact.timeToEvent': 'Time to event',
  'leadDetail.fact.eventType': 'Event type',
  'leadDetail.fact.budget': 'Budget range',
  'leadDetail.scoreBreakdown': 'Score breakdown',
  'leadDetail.clientMessage': 'Client message',
  'leadDetail.activity': 'Activity',
  'leadDetail.internalNotes': 'Internal notes',
  'leadDetail.noNotes': 'No internal notes on this lead yet.',
  'leadDetail.notesHint': 'Use the "Add note" button below to edit this note.',
  'leadDetail.reject': 'Reject',
  'leadDetail.markReplied': 'Mark replied',
  'leadDetail.markRepliedTitle':
    "Move this lead out of 'Needs reply' — you've responded off-platform.",
  'leadDetail.editNote': 'Edit note',
  'leadDetail.addNote': 'Add note',

  'leadScoreRow.budget': 'Budget',
  'leadScoreRow.eventType': 'Event type',
  'leadScoreRow.leadTime': 'Lead time',
  'leadScoreRow.aria': '{label} score',

  'leadActivity.loading': 'Loading activity…',
  'leadActivity.empty': 'No activity recorded yet.',
  'leadActivity.created': 'Lead received',
  'leadActivity.createdDetail': 'Came in through your public booking page.',
  'leadActivity.converted': 'Converted to a booking',
  'leadActivity.convertedDetail': 'Lead moved to BOOKED.',
  'leadActivity.rejected': 'Lead rejected',

  // ── Add-lead modal ────────────────────────────────────────────────────────
  'addLead.aria': 'Add a new lead',
  'addLead.title': 'New lead',
  'addLead.subtitle': 'Add a lead that came in off-platform (phone, WhatsApp, walk-in).',
  'addLead.name': 'Client name *',
  'addLead.email': 'Email *',
  'addLead.phone': 'Phone',
  'addLead.eventDate': 'Event date *',
  'addLead.eventType': 'Event type',
  'addLead.budget': 'Budget range',
  'addLead.message': 'Notes / message *',
  'addLead.messagePlaceholder': 'What did the client ask for?',
  'addLead.submit': 'Save lead',
  'addLead.errName': 'Name is required.',
  'addLead.errEmail': 'Email is required.',
  'addLead.errMessage': 'Add a short note about the lead.',
  'addLead.errSubmit': 'Could not save the lead. Please try again.',
  // Input wording for the budget picker — phrased as ranges to choose from,
  // unlike `leadBudget.*` which labels an already-set value.
  'addLead.budget.UNDER_200': 'Under €200',
  'addLead.budget.200_500': '€200–500',
  'addLead.budget.500_1000': '€500–1,000',
  'addLead.budget.OVER_1000': 'Over €1,000',

  // ── Convert-lead modal ────────────────────────────────────────────────────
  'convertLead.aria': 'Convert {name} to a booking',
  'convertLead.fromLead': 'From this lead',
  'convertLead.client': 'Client',
  'convertLead.email': 'Email',
  'convertLead.eventDate': 'Event date',
  'convertLead.eventType': 'Event type',
  'convertLead.total': 'Total (€)',
  'convertLead.submitting': 'Converting…',
  'convertLead.errSubmit': 'Could not convert the lead. Please try again.',

  // ── Edit-note modal ───────────────────────────────────────────────────────
  'editNote.ariaEdit': 'Edit note for {name}',
  'editNote.ariaAdd': 'Add note for {name}',
  'editNote.titleEdit': 'Edit internal note',
  'editNote.titleAdd': 'Add internal note',
  'editNote.subtitle': 'Only visible to you — clients never see internal notes.',
  'editNote.placeholder': 'Anything you want to remember about this lead?',
  'editNote.submit': 'Save note',
  'editNote.errSubmit': 'Could not save the note. Please try again.',
  'leads.backToList': 'All leads',
} as const;

export type EnLeads = typeof leads;
