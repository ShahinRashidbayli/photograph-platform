/**
 * Leads route, its modals, and the shared lead vocabulary.
 *
 * English is the source of truth — these keys define the `Leads` half of
 * `TranslationKey`, and every other locale is compile-checked against it.
 */
export const leads = {
  // ── Lead vocabulary (event / budget / score) ──────────────────────────────
  'leadEvent.WEDDING': 'Wedding',
  'leadEvent.ENGAGEMENT': 'Engagement',
  'leadEvent.PORTRAIT': 'Portrait',
  'leadEvent.FAMILY': 'Family',
  'leadEvent.NEWBORN': 'Newborn',
  'leadEvent.CORPORATE': 'Corporate',
  'leadEvent.OTHER': 'Other',
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
  'leadUrgency.noDate': 'No date yet',

  // ── Leads page ────────────────────────────────────────────────────────────
  'leads.title': 'Leads',
  'leads.exportCsv': 'Export CSV',
  'leads.newLead': 'New lead',
  'leads.errorTitle': "Couldn't load leads",
  'leads.errorLoad': 'We couldn’t load your leads. Please check your connection and try again.',
  'leads.error.reject': 'Could not reject the lead. Please try again.',
  'leads.error.reply': 'Could not mark as replied. Please try again.',
  'leads.error.triage': 'Could not update the request. Please try again.',
  'leads.loadingDetails': 'Loading lead details…',
  'leads.convertToBooking': 'Convert to booking',
  'leads.viewInBookings': 'View in Bookings',
  // `{name}` marks the segment rendered in bold — the code
  // splits the translated string on the placeholder, so each language keeps
  // its own word order.
  'leads.converted': 'Converted {name} to a booking.',
  'leads.empty.noneTitle': 'No leads yet',
  'leads.empty.noneBody': 'New leads from your public booking page will appear here automatically.',
  'leads.empty.noMatchTitle': 'No leads match',

  'leads.search.placeholder': 'Search name, email, type…',
  'leads.search.aria': 'Search leads',

  // ── Lead detail panel ─────────────────────────────────────────────────────
  'leadDetail.noneSelectedTitle': 'No lead selected',
  'leadDetail.noneSelectedBody': 'Pick a lead from the list to see details.',

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

  // ── Lead note (inline) ────────────────────────────────────────────────────
  'editNote.errSubmit': 'Could not save the note. Please try again.',
  'leads.backToList': 'All leads',

  // ── Inbox (first contact) ─────────────────────────────────────────────────
  'leads.toReply_one': '{count} to reply',
  'leads.toReply_other': '{count} to reply',
  'leads.allAnswered': 'all answered',
  'leads.moreActions': 'More actions',
  'leads.group.reply': 'To reply',
  'leads.group.replyHint': 'oldest first',
  'leads.group.waiting': 'Waiting for client',
  'leads.group.closed': 'Closed',
  'leads.group.show': 'Show',
  'leads.group.hide': 'Hide',
  'leads.wait.today': 'Today',
  'leads.wait.days_one': '{count} day',
  'leads.wait.days_other': '{count} days',
  'leads.row.high': 'High',
  'leads.row.booked': 'Booked',
  'leads.row.declined': 'Declined',
  'leads.row.dateOpen': 'date open',
  'leads.status.new': 'New',
  'leads.status.request': 'Client request',
  'leads.status.waiting': 'Waiting for client',
  'leads.status.booked': 'Booked',
  'leads.status.declined': 'Declined',
  // No channel: a lead can come from the booking page or be added by hand,
  // and the lead does not record which.
  'leads.meta.form': 'Received {when}',
  'leads.meta.client': 'Requested {when} · from their client account',
  'leads.meta.replied': 'you replied {date}',
  'leads.when.today': 'today, {time}',
  'leads.when.yesterday': 'yesterday, {time}',
  'leads.avail.free': 'You’re free',
  'leads.avail.busy': 'Busy that day: {who}',
  'leads.avail.busyMore_one': 'Busy that day: {who} and {count} more',
  'leads.avail.busyMore_other': 'Busy that day: {who} and {count} more',
  'leads.avail.noDate': 'No date given — ask in your reply',
  'leads.avail.aria': 'Availability',
  'leads.relative.months_one': 'in {count} month',
  'leads.relative.months_other': 'in {count} months',
  'leads.factor.budget': 'budget',
  'leads.factor.type': 'occasion',
  'leads.factor.time': 'timing',
  'leads.priority.strong': 'strong {list}',
  'leads.priority.weak': 'weak {list}',
  'leads.priority.inquiry': 'scored on budget and date',
  'leads.reply.email': 'Reply by email',
  'leads.reply.accept': 'Accept & reply by email',
  'leads.reply.call': 'Call',
  'leads.reply.hint':
    'Opens a draft to {name} in your mail app. The lead moves to “Waiting for client” — you can undo.',
  'leads.reply.acceptHint':
    'Accepts the request — this creates the booking — and opens a draft to {name}.',
  'leads.reply.noEmail': 'No email address on this lead — call or message them instead.',
  'leads.waiting.text':
    'You replied. Once {name} confirms, turn it into a booking — the form comes prefilled.',
  'leads.waiting.followUp': 'Follow up by email',
  'leads.closed.booked': 'This enquiry became a booking.',
  'leads.closed.declined': 'You declined this enquiry.',
  'leads.decline': 'Decline politely',
  'leads.note.add': 'Add note',
  'leads.note.show': 'Note',
  'leads.note.label': 'Private note · only you and your team see this',
  'leads.note.placeholder': 'e.g. what you quoted',
  'leads.menu.markReplied': 'Mark as replied (no email)',
  'leads.menu.reject': 'Decline without email',
  'leads.toast.replied': 'Draft opened · {name} moved to “Waiting for client”',
  'leads.toast.declined': 'Decline drafted · {name} closed',
  'leads.toast.markedReplied': '{name} moved to “Waiting for client”',
  'leads.toast.rejected': '{name} closed',
  'leads.toast.undo': 'Undo',
  // Drafts open in the photographer's own mail app, to be edited before
  // sending. {date} is either empty or " for <date>".
  'leads.draft.forDate': ' for {date}',
  'leads.draft.subject': 'Your enquiry{date}',
  'leads.draft.reply':
    'Hi {name},\n\nthank you for your enquiry{date} — I’d love to hear more.\n\n',
  'leads.draft.accept':
    'Hi {name},\n\nthank you for your request{date} — I’m happy to confirm it. I’ll be in touch with the details.\n\n',
  'leads.draft.decline':
    'Hi {name},\n\nthank you for your enquiry{date}. Unfortunately I can’t take it on this time — I’m sorry, and I hope you find the right photographer.\n\nAll the best\n',
  'leads.draft.followUp':
    'Hi {name},\n\njust following up on my last message about your enquiry{date}. Are your plans still on?\n\n',

  // ── Public request form (r/[subdomain], embedded on p/[subdomain]) ──────
  'request.title': 'Request a session',
  'request.lede': 'Send {name} a few details about your shoot — they will reply shortly.',
  'request.name': 'Your name',
  'request.email': 'Email',
  'request.phone': 'Phone (optional)',
  'request.date': 'Event date',
  'request.type': 'Session type',
  'request.budget': 'Budget',
  'request.select': 'Select…',
  'request.message': 'Tell us about your shoot',
  'request.send': 'Send request',
  'request.sending': 'Sending…',
  'request.honeypot': 'Leave this field empty',
  'request.budget.under': 'Under {amount}',
  'request.budget.range': '{from} – {to}',
  'request.budget.over': 'Over {amount}',
  'request.okTitle': 'Request sent',
  'request.okText':
    'You will receive a personal reply with availability and packages within a few hours.',
  'request.error.rateLimited': 'Too many requests — please try again in a few minutes.',
  'request.error.notFound': 'This studio could not be found.',
  'request.error.failed': 'Your request could not be sent. Please try again.',
  'request.error.network': 'Network error. Please check your connection and try again.',
} as const;

export type EnLeads = typeof leads;
