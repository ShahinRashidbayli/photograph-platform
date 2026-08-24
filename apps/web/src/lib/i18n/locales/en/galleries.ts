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
  'galleries.subtitleClient': 'Your delivered photo galleries will appear here.',
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
  'galleries.filter.all': 'All',
  'galleries.filter.active': 'Active',
  'galleries.filter.expired': 'Expired',

  'galleries.expiry.none': 'No expiry',
  'galleries.expiry.expired': 'Expired',
  'galleries.expiry.daysLeft_one': '{count} day left',
  'galleries.expiry.daysLeft_other': '{count} days left',

  'galleries.detail.selectPrompt': 'Select a gallery to view',
  'galleries.detail.photos': 'Photos',
  'galleries.detail.deletePhoto': 'Delete photo',
  'galleries.detail.deletePhotoError': 'Could not delete that photo. Please try again.',
  'galleries.detail.views': 'Views',
  'galleries.detail.daysLeft': 'Days left',
  'galleries.detail.accessInfo': 'Access Information',
  'galleries.detail.download': 'Download',
  'galleries.detail.watermark': 'Watermark',
  'galleries.detail.expires': 'Expires',
  'galleries.detail.linkTitle': 'Gallery Link',
  'galleries.detail.linkUnavailable': 'Gallery link unavailable',
  'galleries.detail.copyLink': 'Copy Link',
  'galleries.detail.copied': 'Copied!',
  'galleries.detail.copyManually': 'Press Ctrl/⌘+C',
  'galleries.detail.upload': 'Upload',
  'galleries.detail.uploading': 'Uploading…',
  'galleries.detail.uploadError': 'Some photos could not be uploaded. Please try again.',

  'galleries.update.error': 'Could not update the gallery.',
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
