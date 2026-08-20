/**
 * The photographer's portfolio manager: upload, publish, categorise.
 *
 * <p>"Publish" is the word that carries weight here — it is what makes a photo
 * visible on the public page — so the toggle and its tooltip are separate keys
 * rather than one reused label.
 */
export const portfolio = {
  'portfolio.title': 'Portfolio',
  'portfolio.subtitle': 'Upload, publish, and curate the photos visitors see on your public page.',

  'portfolio.upload.button': 'Upload photos',
  'portfolio.upload.dropHint': 'Drop JPG, PNG, or WebP here — or use',
  'portfolio.upload.dropHintTail': 'above. Max 25 MB per file.',
  'portfolio.upload.inProgress': 'Uploading {count}',
  'portfolio.upload.done': 'Done ✓',
  'portfolio.upload.failed': 'Upload failed',
  'portfolio.upload.tooLarge': 'File exceeds 25 MB',
  'portfolio.upload.readError': 'Could not read image',
  'portfolio.upload.networkError': 'Network error during upload',

  'portfolio.photos.loadError': 'Failed to load photos',
  'portfolio.photos.deleteError': 'Delete failed',
  'portfolio.photos.thumbnailPending': 'Thumbnail pending…',
  'portfolio.photos.publish': 'Publish',
  'portfolio.photos.unpublish': 'Unpublish',
  'portfolio.photos.publishHint': 'Publish this photo to your public page',
  'portfolio.photos.unpublishHint': 'Remove this photo from your public page',
  'portfolio.photos.deleteLabel': 'Delete photo',
  'portfolio.photos.deleteConfirmTitle': 'Delete this photo?',

  'portfolio.empty.title': 'No photos yet',
  'portfolio.empty.body':
    'Upload your first photographs — they will appear here as drafts until you publish them.',
  'portfolio.empty.inCategory': 'No photos in this category yet.',

  'portfolio.category.label': 'Photo category',
  'portfolio.category.assign': 'Assign a category',
  'portfolio.category.none': 'Uncategorised',
  'portfolio.category.namePlaceholder': 'Category name',
  'portfolio.category.filterHint': 'Click to filter · double-click to rename',
  'portfolio.category.deleteLabel': 'Delete category',
  'portfolio.category.createError': 'Could not create the category.',
  'portfolio.category.renameError': 'Could not rename the category.',
  'portfolio.category.deleteError': 'Could not delete the category.',

  'portfolio.dismiss': 'Dismiss',
} as const;

export type EnPortfolio = typeof portfolio;
