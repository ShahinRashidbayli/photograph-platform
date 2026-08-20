import type { EnPortfolio } from '../en/portfolio';

/** Portfolio-Verwaltung des Fotografen. */
export const portfolio: Record<keyof EnPortfolio, string> = {
  'portfolio.title': 'Portfolio',
  'portfolio.subtitle':
    'Lade Fotos hoch, veröffentliche sie und kuratiere, was Besucher auf deiner öffentlichen Seite sehen.',

  'portfolio.upload.button': 'Fotos hochladen',
  'portfolio.upload.dropHint': 'JPG, PNG oder WebP hier ablegen — oder',
  'portfolio.upload.dropHintTail': 'oben nutzen. Max. 25 MB pro Datei.',
  'portfolio.upload.inProgress': '{count} werden hochgeladen',
  'portfolio.upload.done': 'Fertig ✓',
  'portfolio.upload.failed': 'Upload fehlgeschlagen',
  'portfolio.upload.tooLarge': 'Datei größer als 25 MB',
  'portfolio.upload.readError': 'Bild konnte nicht gelesen werden',
  'portfolio.upload.networkError': 'Netzwerkfehler beim Hochladen',

  'portfolio.photos.loadError': 'Fotos konnten nicht geladen werden',
  'portfolio.photos.deleteError': 'Löschen fehlgeschlagen',
  'portfolio.photos.thumbnailPending': 'Vorschaubild wird erstellt…',
  'portfolio.photos.publish': 'Veröffentlichen',
  'portfolio.photos.unpublish': 'Zurückziehen',
  'portfolio.photos.publishHint': 'Dieses Foto auf deiner öffentlichen Seite veröffentlichen',
  'portfolio.photos.unpublishHint': 'Dieses Foto von deiner öffentlichen Seite entfernen',
  'portfolio.photos.deleteLabel': 'Foto löschen',
  'portfolio.photos.deleteConfirmTitle': 'Dieses Foto löschen?',

  'portfolio.empty.title': 'Noch keine Fotos',
  'portfolio.empty.body':
    'Lade deine ersten Fotos hoch — sie erscheinen hier als Entwürfe, bis du sie veröffentlichst.',
  'portfolio.empty.inCategory': 'Noch keine Fotos in dieser Kategorie.',

  'portfolio.category.label': 'Fotokategorie',
  'portfolio.category.assign': 'Kategorie zuweisen',
  'portfolio.category.none': 'Ohne Kategorie',
  'portfolio.category.namePlaceholder': 'Kategoriename',
  'portfolio.category.filterHint': 'Klicken zum Filtern · Doppelklick zum Umbenennen',
  'portfolio.category.deleteLabel': 'Kategorie löschen',
  'portfolio.category.createError': 'Die Kategorie konnte nicht erstellt werden.',
  'portfolio.category.renameError': 'Die Kategorie konnte nicht umbenannt werden.',
  'portfolio.category.deleteError': 'Die Kategorie konnte nicht gelöscht werden.',

  'portfolio.dismiss': 'Schließen',
};
