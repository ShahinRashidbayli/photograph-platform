/**
 * What is being considered next.
 *
 * <p>Every body here describes something that does not exist. They are written
 * in the conditional — "would", not "does" — on purpose: this dictionary is
 * where a future feature most easily slips into the present tense and starts
 * reading like a promise.
 */
export const roadmap = {
  'roadmap.title': 'What’s next',
  'roadmap.subtitle':
    'Ideas we are weighing up for Fotolio. None of them is built yet — tick the ones you would use, and we will build in that order.',
  'roadmap.disclaimer':
    'Nothing on this page exists in the product today. This is not a release schedule and no date is implied.',
  'roadmap.want': 'I would use this',
  'roadmap.wanted': 'You asked for this',
  'roadmap.loadError': 'Could not load your answers. You can still read the ideas.',
  'roadmap.footnote':
    'Your answers are stored against your studio and can be changed at any time. We use them only to decide what to build first.',

  // One sentence per planned sidebar row, naming which half of the feature the
  // row opened. Most of these have a second half behind a different row, and
  // saying where it is stops the page reading like the whole idea.
  'roadmap.area.seeAll': 'See everything being weighed up',
  'roadmap.area.instagram':
    'All of this would be about your own account — replies, scheduling, what to post. It is the only idea on the list with no second half: there is nothing of anyone else’s here to browse.',
  'roadmap.area.space':
    'Your side of the studio marketplace: the space you list, the rate you set, the hours somebody booked. Searching for other people’s spaces is the other half, under Community.',
  'roadmap.area.offerings':
    'Your side of teaching: the coaching and workshops you sell, and who signed up. What other photographers teach is the other half, under Community.',
  'roadmap.area.locations':
    'Places other photographers have already shot, and what they learned there. None of it is your data — the map is only worth having because everyone adds to it, you included.',
  'roadmap.area.studios':
    'Spaces other studios rent out, to search, compare and book. Listing your own space is the other half, under Content.',
  'roadmap.area.learning':
    'Coaching and workshops other photographers offer. Selling your own is the other half, under Content.',
  'roadmap.area.gear':
    'Reference, and nothing else. Nothing here would ever be yours to manage, which is also what makes it the cheapest of these to build.',

  'roadmap.instagram.title': 'Instagram growth tools',
  'roadmap.instagram.body':
    'Auto-reply to DMs, post and story scheduling, reels and link stickers — plus guidance on what actually wins followers and enquiries. Fotolio assumes your clients find you on Instagram rather than by searching a directory, so this is the channel that matters most.',
  'roadmap.instagram.note':
    'The furthest along: DM auto-reply is already the Pro plan’s headline feature and needs Meta’s app review before it can go live.',

  'roadmap.map.title': 'Location map & scouting',
  'roadmap.map.body':
    'A shared map of places to shoot, with the angles and times of day that worked, added by photographers who have already been there. Finding a location and scouting it in person is the slowest part of a shoot; this would turn weeks of searching into reading what someone else already learned.',
  'roadmap.map.note': 'The most original of these — no competing platform offers it.',

  'roadmap.studio.title': 'Studio marketplace',
  'roadmap.studio.body':
    'Studios register, list their space and hourly rate, and photographers search, compare and book directly. The studio fills empty hours and gets found; the photographer stops asking around for a room.',

  'roadmap.training.title': 'Coaching for newcomers',
  'roadmap.training.body':
    'Experienced photographers offer paid coaching to people starting out — the routes that worked, the mistakes worth skipping, and feedback on real work.',

  'roadmap.workshops.title': 'Workshops & video lessons',
  'roadmap.workshops.body':
    'Senior photographers run paid workshops or sell recorded lessons through the platform, with the payment and payout side handled for them.',

  'roadmap.gear.title': 'Equipment & technique guide',
  'roadmap.gear.body':
    'What a given camera or lens is actually good at, and which kind of shoot it suits. Aimed at people who are early enough that the specification sheets do not yet mean anything.',
  'roadmap.gear.note':
    'The simplest to build: it moves no money and depends on nothing else, so it could arrive well before the rest.',
} as const;

export type EnRoadmap = typeof roadmap;
