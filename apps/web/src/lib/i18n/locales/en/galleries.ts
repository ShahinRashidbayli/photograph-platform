/**
 * Delivered photo galleries — the photographer's list and detail pane.
 *
 * <p>Expiry wording is deliberate: a gallery going offline is the most
 * consequential thing this screen says, so the countdown states are separate
 * keys rather than one string with a number spliced in.
 */
export const galleries = {
  'galleries.title': 'Your Galleries',
  'galleries.subtitle': 'View, download, and manage your photo galleries.',
  'galleries.loading': 'Loading galleries…',
  'galleries.loadError': "Couldn't load galleries",
  'galleries.loadErrorBody': 'Could not load galleries. Please try again.',

  'galleries.stat.galleries': 'Galleries',
  'galleries.stat.totalPhotos': 'Total Photos',
  'galleries.stat.available': 'available',
  'galleries.stat.active_one': '{count} active',
  'galleries.stat.active_other': '{count} active',

  'galleries.list.title': 'Galleries',
  'galleries.list.search': 'Search galleries…',
  'galleries.list.searchLabel': 'Search galleries',
  'galleries.list.empty': 'No galleries yet.',
  'galleries.list.noMatch': 'No galleries match these filters.',
  'galleries.list.noPhotos': 'No photos yet',
  'galleries.list.reactivate': 'Reactivate',
  'galleries.list.filterLabel': 'Filter galleries',
  'galleries.list.showMore_one': 'Show 1 more',
  'galleries.list.showMore_other': 'Show {count} more',
  'galleries.list.showLess': 'Show fewer',
  'galleries.photoCount_one': '{count} photo',
  'galleries.photoCount_other': '{count} photos',
  'galleries.group.soon': 'Expiring soon',
  'galleries.group.active': 'Active',
  'galleries.group.expired': 'Expired',
  'galleries.filter.all': 'All',
  'galleries.filter.active': 'Active',
  'galleries.filter.expired': 'Expired',

  'galleries.expiry.none': 'No expiry',
  'galleries.expiry.expired': 'Expired',
  'galleries.expiry.daysLeft_one': '{count} day left',
  'galleries.expiry.daysLeft_other': '{count} days left',
  'galleries.expiry.expiredSince_one': 'Expired 1 day ago',
  'galleries.expiry.expiredSince_other': 'Expired {count} days ago',

  'galleries.detail.selectPrompt': 'Select a gallery to view',
  'galleries.detail.photos': 'Photos',
  'galleries.detail.deletePhoto': 'Delete photo',
  'galleries.detail.deletePhotoError': 'Could not delete that photo. Please try again.',
  'galleries.detail.views': 'Views',
  'galleries.detail.watermark': 'Watermark',
  'galleries.detail.linkTitle': 'Gallery Link',
  'galleries.detail.linkUnavailable': 'Gallery link unavailable',
  'galleries.detail.copyLink': 'Copy Link',
  'galleries.detail.copied': 'Copied!',
  'galleries.detail.copyManually': 'Press Ctrl/⌘+C',
  'galleries.detail.upload': 'Upload',
  'galleries.detail.viewGallery': 'View gallery',
  'galleries.detail.uploading': 'Uploading…',
  'galleries.detail.uploadError': 'Some photos could not be uploaded. Please try again.',
  'galleries.detail.photosLoading': 'Loading photos…',
  'galleries.detail.photosEmpty': 'No photos yet — upload the delivery to fill this gallery.',
  'galleries.detail.sharing': 'Sharing',
  'galleries.detail.downloadLabel': 'Allow downloads',
  'galleries.detail.downloadOn': 'Your client can save the original files',
  'galleries.detail.downloadOff': 'Off — viewing only, no originals',
  'galleries.detail.watermarkOn': 'On — photos are shown with your logo',
  'galleries.detail.watermarkOff': 'Off — photos are shown without your logo',
  'galleries.detail.expiresOn': 'Expires on {date}',
  'galleries.detail.neverExpires': 'No expiry set',
  'galleries.detail.extend': 'Extend to {days} days from today',
  'galleries.detail.extendFallback': 'Extend',
  'galleries.detail.extendHint':
    "Keeps the gallery online for your plan's full retention window, counted from today. It never brings the expiry date forward.",
  'galleries.detail.addPhotos': 'Add',
  'galleries.detail.statusActive': 'Active',
  'galleries.detail.statusExpired': 'Expired',
  'galleries.detail.statusPurged': 'Deleted',

  'galleries.update.error': 'Could not update the gallery.',
  // "An Kunden senden": emails the Customer the gallery link, with an optional
  // Personal note. Only once there are photos to see.
  'galleries.send.action': 'Send to client',
  'galleries.send.title': 'Send this gallery to your client?',
  'galleries.send.body':
    '{name} gets an email in your studio’s name with the link to the gallery. You can send it again later.',
  'galleries.send.empty': 'Upload photos first — an empty gallery cannot be sent.',
  'galleries.send.error': 'Could not send the gallery. Please try again.',
  'galleries.extend.error':
    'Could not extend the gallery. If its photos have already been deleted, they cannot be restored.',
  'galleries.delete.error': 'Could not delete the gallery.',

  'galleries.create.title': 'New gallery',
  'galleries.create.loadingBookings': 'Loading bookings…',
  'galleries.create.bookingsError': 'Could not load bookings.',
  'galleries.create.submit': 'Create gallery',
  'galleries.create.submitting': 'Creating…',
  'galleries.create.error': 'Could not create the gallery. Please try again.',

  // Tombstone shown when a delivered gallery has passed its retention
  // window (ADR-001). Client-facing: the recipient never chose a
  // language in our UI, so this follows the same locale as the rest of
  // the public gallery.
  'gallery.expired.title': 'This gallery has expired',
  'gallery.expired.body':
    'The photos in this gallery were available until {date} and have since been removed.',
  'gallery.expired.bodyNoDate': 'The photos in this gallery have since been removed.',
  'gallery.expired.contact':
    'Please contact {photographer} directly — they can restore the gallery on request.',
  'gallery.expired.note':
    'Fotolio is a delivery platform, not a long-term archive. Galleries stay online for a limited time depending on the photographer\u2019s plan.',
} as const;

export type EnGalleries = typeof galleries;
