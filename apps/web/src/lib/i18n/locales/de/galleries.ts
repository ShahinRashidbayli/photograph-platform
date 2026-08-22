import type { EnGalleries } from '../en/galleries';

/** Ausgelieferte Galerien. */
export const galleries: Record<keyof EnGalleries, string> = {
  'galleries.title': 'Deine Galerien',
  'galleries.subtitle': 'Fotogalerien ansehen, herunterladen und verwalten.',
  'galleries.subtitleClient': 'Hier erscheinen die Galerien, die dir geliefert wurden.',
  'galleries.loading': 'Galerien werden geladen…',
  'galleries.loadError': 'Galerien konnten nicht geladen werden',
  'galleries.loadErrorBody': 'Galerien konnten nicht geladen werden. Bitte versuche es erneut.',

  'galleries.stat.galleries': 'Galerien',
  'galleries.stat.totalPhotos': 'Fotos gesamt',
  'galleries.stat.available': 'verfügbar',

  'galleries.list.title': 'Galerien',
  'galleries.list.search': 'Galerien durchsuchen…',
  'galleries.list.searchLabel': 'Galerien durchsuchen',
  'galleries.list.empty': 'Noch keine Galerien.',
  'galleries.list.noMatch': 'Keine Galerie passt zu diesen Filtern.',
  'galleries.filter.all': 'Alle',
  'galleries.filter.active': 'Aktiv',
  'galleries.filter.expired': 'Abgelaufen',

  'galleries.expiry.none': 'Kein Ablaufdatum',
  'galleries.expiry.expired': 'Abgelaufen',
  'galleries.expiry.daysLeft_one': 'Noch {count} Tag',
  'galleries.expiry.daysLeft_other': 'Noch {count} Tage',

  'galleries.detail.selectPrompt': 'Wähle eine Galerie aus',
  'galleries.detail.photos': 'Fotos',
  'galleries.detail.deletePhoto': 'Foto löschen',
  'galleries.detail.deletePhotoError':
    'Das Foto konnte nicht gelöscht werden. Bitte erneut versuchen.',
  'galleries.detail.views': 'Aufrufe',
  'galleries.detail.daysLeft': 'Tage übrig',
  'galleries.detail.accessInfo': 'Zugriff',
  'galleries.detail.download': 'Download',
  'galleries.detail.watermark': 'Wasserzeichen',
  'galleries.detail.expires': 'Läuft ab',
  'galleries.detail.linkTitle': 'Galerie-Link',
  'galleries.detail.linkUnavailable': 'Galerie-Link nicht verfügbar',
  'galleries.detail.copyLink': 'Link kopieren',
  'galleries.detail.copied': 'Kopiert!',
  'galleries.detail.copyManually': 'Strg/⌘+C drücken',
  'galleries.detail.upload': 'Hochladen',
  'galleries.detail.uploading': 'Wird hochgeladen…',
  'galleries.detail.uploadError':
    'Einige Fotos konnten nicht hochgeladen werden. Bitte versuche es erneut.',

  'galleries.update.error': 'Die Galerie konnte nicht aktualisiert werden.',
  'galleries.extend.error':
    'Galerie konnte nicht verlängert werden. Wenn die Fotos bereits gelöscht wurden, können sie nicht wiederhergestellt werden.',
  'galleries.delete.error': 'Die Galerie konnte nicht gelöscht werden.',

  'galleries.create.title': 'Neue Galerie',
  'galleries.create.loadingBookings': 'Buchungen werden geladen…',
  'galleries.create.bookingsError': 'Buchungen konnten nicht geladen werden.',
  'galleries.create.submit': 'Galerie erstellen',
  'galleries.create.submitting': 'Wird erstellt…',
  'galleries.create.error': 'Die Galerie konnte nicht erstellt werden. Bitte versuche es erneut.',

  // Tombstone shown when a delivered gallery has passed its retention
  // window (ADR-001). Client-facing: the recipient never chose a
  // language in our UI, so this follows the same locale as the rest of
  // the public gallery.
  'gallery.expired.title': 'Diese Galerie ist abgelaufen',
  'gallery.expired.body':
    'Die Fotos aus dieser Galerie standen bis zum {date} online und wurden inzwischen entfernt.',
  'gallery.expired.bodyNoDate': 'Die Fotos aus dieser Galerie wurden inzwischen entfernt.',
  'gallery.expired.contact':
    'Wende dich bitte direkt an {photographer} — die Galerie kann auf Wunsch wieder freigeschaltet werden.',
  'gallery.expired.note':
    'Fotolio ist eine Auslieferungsplattform und kein Langzeitarchiv. Galerien bleiben je nach Tarif der Fotograf:in eine begrenzte Zeit online.',
};
