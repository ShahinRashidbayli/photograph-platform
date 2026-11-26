import type { EnGalleries } from '../en/galleries';

/** Ausgelieferte Galerien. */
export const galleries: Record<keyof EnGalleries, string> = {
  'galleries.title': 'Deine Galerien',
  'galleries.subtitle': 'Fotogalerien ansehen, herunterladen und verwalten.',
  'galleries.loading': 'Galerien werden geladen…',
  'galleries.loadError': 'Galerien konnten nicht geladen werden',
  'galleries.loadErrorBody': 'Galerien konnten nicht geladen werden. Bitte versuche es erneut.',

  'galleries.stat.galleries': 'Galerien',
  'galleries.stat.totalPhotos': 'Fotos gesamt',
  'galleries.stat.available': 'verfügbar',
  'galleries.stat.active_one': '{count} aktiv',
  'galleries.stat.active_other': '{count} aktiv',

  'galleries.list.title': 'Galerien',
  'galleries.list.search': 'Galerien durchsuchen…',
  'galleries.list.searchLabel': 'Galerien durchsuchen',
  'galleries.list.empty': 'Noch keine Galerien.',
  'galleries.list.noMatch': 'Keine Galerie passt zu diesen Filtern.',
  'galleries.list.noPhotos': 'Noch keine Fotos',
  'galleries.list.reactivate': 'Reaktivieren',
  'galleries.list.filterLabel': 'Galerien filtern',
  'galleries.list.showMore_one': 'Eine weitere anzeigen',
  'galleries.list.showMore_other': 'Weitere {count} anzeigen',
  'galleries.list.showLess': 'Weniger anzeigen',
  'galleries.photoCount_one': '{count} Foto',
  'galleries.photoCount_other': '{count} Fotos',
  'galleries.group.soon': 'Läuft bald ab',
  'galleries.group.active': 'Aktiv',
  'galleries.group.expired': 'Abgelaufen',
  'galleries.filter.all': 'Alle',
  'galleries.filter.active': 'Aktiv',
  'galleries.filter.expired': 'Abgelaufen',

  'galleries.expiry.none': 'Kein Ablaufdatum',
  'galleries.expiry.expired': 'Abgelaufen',
  'galleries.expiry.daysLeft_one': 'Noch {count} Tag',
  'galleries.expiry.daysLeft_other': 'Noch {count} Tage',
  'galleries.expiry.expiredSince_one': 'Seit 1 Tag abgelaufen',
  'galleries.expiry.expiredSince_other': 'Seit {count} Tagen abgelaufen',

  'galleries.detail.selectPrompt': 'Wähle eine Galerie aus',
  'galleries.detail.photos': 'Fotos',
  'galleries.detail.deletePhoto': 'Foto löschen',
  'galleries.detail.deletePhotoError':
    'Das Foto konnte nicht gelöscht werden. Bitte erneut versuchen.',
  'galleries.detail.views': 'Aufrufe',
  'galleries.detail.watermark': 'Wasserzeichen',
  'galleries.detail.linkTitle': 'Galerie-Link',
  'galleries.detail.linkUnavailable': 'Galerie-Link nicht verfügbar',
  'galleries.detail.copyLink': 'Link kopieren',
  'galleries.detail.copied': 'Kopiert!',
  'galleries.detail.copyManually': 'Strg/⌘+C drücken',
  'galleries.detail.upload': 'Hochladen',
  'galleries.detail.viewGallery': 'Galerie ansehen',
  'galleries.detail.uploading': 'Wird hochgeladen…',
  'galleries.detail.uploadError':
    'Einige Fotos konnten nicht hochgeladen werden. Bitte versuche es erneut.',
  'galleries.detail.photosLoading': 'Fotos werden geladen…',
  'galleries.detail.photosEmpty':
    'Noch keine Fotos — laden Sie die Lieferung hoch, um diese Galerie zu füllen.',
  'galleries.detail.sharing': 'Freigabe',
  'galleries.detail.downloadLabel': 'Download erlauben',
  'galleries.detail.downloadOn': 'Ihre Kundschaft kann die Originaldateien speichern',
  'galleries.detail.downloadOff': 'Aus — nur ansehen, keine Originale',
  'galleries.detail.watermarkOn': 'An — Fotos werden mit Ihrem Logo gezeigt',
  'galleries.detail.watermarkOff': 'Aus — Fotos werden ohne Logo gezeigt',
  'galleries.detail.expiresOn': 'Läuft ab am {date}',
  'galleries.detail.neverExpires': 'Kein Ablaufdatum',
  'galleries.detail.extend': '+30 Tage',
  'galleries.detail.addPhotos': 'Hinzufügen',
  'galleries.detail.statusActive': 'Aktiv',
  'galleries.detail.statusExpired': 'Abgelaufen',
  'galleries.detail.statusPurged': 'Gelöscht',

  'galleries.update.error': 'Die Galerie konnte nicht aktualisiert werden.',
  'galleries.send.action': 'An Kunden senden',
  'galleries.send.title': 'Diese Galerie an Ihren Kunden senden?',
  'galleries.send.body':
    '{name} erhält eine E-Mail im Namen Ihres Studios mit dem Link zur Galerie. Sie können sie später erneut senden.',
  'galleries.send.empty':
    'Laden Sie zuerst Fotos hoch — eine leere Galerie lässt sich nicht senden.',
  'galleries.send.error':
    'Die Galerie konnte nicht gesendet werden. Bitte versuchen Sie es erneut.',
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
