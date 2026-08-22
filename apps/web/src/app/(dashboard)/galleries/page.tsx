'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { useIsPhotographer, useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { asyncErrorText, type AsyncError } from '@/lib/async-error';
import { formatMonthDayYear } from '@/lib/helpers';
import { useTranslation } from '@/lib/i18n';
import { getGalleriesColors, getGalleriesStyles } from './galleries.styles';

type AppColors = ReturnType<typeof getGalleriesColors>;
type AppStyles = ReturnType<typeof getGalleriesStyles>;

interface Gallery {
  id: string;
  bookingId: string;
  bookingName: string;
  eventType: string;
  shootDate: string;
  photoCount: number;
  downloadEnabled: boolean;
  watermarkEnabled: boolean;
  expiresAt: string | null;
  accessToken: string;
  viewCount: number;
  // Retention (ADR-001). expiryState distinguishes "still live" from "expired
  // but recoverable" from "photos deleted" — a countdown alone cannot say
  // whether Extend will still bring anything back.
  expiryState: 'ACTIVE' | 'EXPIRED' | 'PURGED';
  retentionDays: number | null;
  purgeAfter: string | null;
  extensionCount: number;
  canExtend: boolean;
}

interface BookingOption {
  id: string;
  clientName: string;
  eventType: string | null;
  eventDate: string;
}

interface DeliveryPhoto {
  id: string;
  viewUrl: string | null;
  thumbnailUrl: string | null;
  originalFilename: string | null;
  fileSizeBytes: number | null;
  width: number | null;
  height: number | null;
  sortOrder: number;
}

interface InitiateUploadResponse {
  photoId: string;
  r2Key: string;
  uploadUrl: string;
}

/** Whole days until a date, or null when there's no expiry set. */
function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

// ─── SVG icons ────────────────────────────────────────────────────────────────
const IconEye = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconCopy = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
const IconGallery = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);
const IconClock = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);
const IconCheck = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconX = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const IconPlus = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconUpload = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);
const IconTrash = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

type ExpiryKind = 'none' | 'expired' | 'warning' | 'ok';

/**
 * How close a gallery is to going offline.
 *
 * <p>Returns the classification and the raw day count rather than a sentence:
 * the wording is locale-dependent (German needs its own plural forms), and a
 * pure helper outside the component tree has no access to the active language.
 * Callers render it with {@link expiryText}.
 */
function expiryKind(days: number | null): ExpiryKind {
  if (days === null) return 'none';
  if (days < 0) return 'expired';
  if (days < 7) return 'warning';
  return 'ok';
}

function expiryText(
  days: number | null,
  t: ReturnType<typeof useTranslation>['t'],
  tPlural: ReturnType<typeof useTranslation>['tPlural']
): string {
  const kind = expiryKind(days);
  if (kind === 'none') return t('galleries.expiry.none');
  if (kind === 'expired') return t('galleries.expiry.expired');
  return tPlural('galleries.expiry.daysLeft', days ?? 0);
}

// ─── GalleryListItem ──────────────────────────────────────────────────────────
function GalleryListItem({
  gallery,
  isActive,
  onSelect,
  styles,
  colors,
}: Readonly<{
  gallery: Gallery;
  isActive: boolean;
  onSelect: () => void;
  styles: AppStyles;
  colors: AppColors;
}>) {
  const { t, tPlural } = useTranslation();
  const days = daysUntil(gallery.expiresAt);
  const kind = expiryKind(days);
  const tone =
    kind === 'expired'
      ? colors.dangerText
      : kind === 'warning'
        ? colors.warningText
        : kind === 'ok'
          ? colors.successText
          : colors.textMuted;

  return (
    <button
      style={{ ...styles.listItem, ...(isActive ? styles.listItemActive : {}) }}
      onClick={onSelect}
    >
      <div style={styles.listItemTitle}>{gallery.bookingName}</div>
      <div style={styles.listItemMeta}>
        {gallery.eventType} · {gallery.photoCount} photos
      </div>
      <div
        style={{ ...styles.listItemMeta, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
      >
        {kind === 'expired' ? <IconX /> : kind === 'warning' ? <IconClock /> : <IconCheck />}
        <span style={{ color: tone }}>{expiryText(days, t, tPlural)}</span>
      </div>
    </button>
  );
}

// ─── GalleryDetail ────────────────────────────────────────────────────────────

/**
 * The delivered photos, with a per-photo delete.
 *
 * <p>The detail panel used to show only a count, so a photographer who
 * uploaded the wrong file — a duplicate, a frame with someone's eyes shut, a
 * photo from a different shoot — had no way to take it back short of deleting
 * the whole gallery and re-uploading it. The client, meanwhile, could already
 * see it.
 *
 * <p>Re-fetches whenever {@code photoCount} changes, which is exactly when an
 * upload or a delete has landed.
 */
function GalleryPhotos({
  galleryId,
  photoCount,
  styles,
  colors,
  onDeleted,
}: Readonly<{
  galleryId: string;
  photoCount: number;
  styles: AppStyles;
  colors: AppColors;
  onDeleted: () => void;
}>) {
  const { t } = useTranslation();
  const [photos, setPhotos] = useState<DeliveryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<DeliveryPhoto[]>(`/api/galleries/${galleryId}/photos`)
      .then(({ data }) => {
        if (!cancelled && Array.isArray(data)) setPhotos(data);
      })
      .catch(() => {
        if (!cancelled) setPhotos([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    // Cancelled on unmount and on gallery switch so a slow response for the
    // previous gallery cannot paint its photos into the newly-selected one.
    return () => {
      cancelled = true;
    };
  }, [galleryId, photoCount]);

  async function remove(photo: DeliveryPhoto) {
    const name = photo.originalFilename || 'this photo';
    if (!window.confirm(`Delete ${name}? The client will no longer see it. This cannot be undone.`))
      return;
    setDeletingId(photo.id);
    setDeleteError(null);
    try {
      await api.delete(`/api/galleries/photos/${photo.id}`);
      setPhotos((current) => current.filter((p) => p.id !== photo.id));
      onDeleted();
    } catch {
      // Without this the rejection was unhandled and the row simply stayed
      // put — indistinguishable from a click that never registered, on an
      // action the photographer believes removed a client's photo.
      setDeleteError(t('galleries.detail.deletePhotoError'));
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return <div style={{ color: colors.textMuted, fontSize: '0.85rem' }}>Loading photos…</div>;
  }
  if (photos.length === 0) {
    return (
      <div style={{ color: colors.textMuted, fontSize: '0.85rem' }}>
        No photos yet — upload the delivery above.
      </div>
    );
  }

  return (
    <>
      {deleteError && (
        <div
          role="alert"
          style={{ color: colors.dangerText, fontSize: '0.82rem', marginBottom: 10 }}
        >
          {deleteError}
        </div>
      )}
      <div style={styles.photoGrid}>
        {photos.map((photo) => (
          <div key={photo.id} style={styles.photoCell}>
            {photo.thumbnailUrl || photo.viewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo.thumbnailUrl || photo.viewUrl || ''}
                alt={photo.originalFilename || 'Delivered photo'}
                style={styles.photoImg}
                loading="lazy"
              />
            ) : (
              <div style={{ ...styles.photoImg, ...styles.photoFallback }}>No preview</div>
            )}
            <button
              type="button"
              onClick={() => remove(photo)}
              disabled={deletingId === photo.id}
              style={styles.photoDelete}
              aria-label={`Delete ${photo.originalFilename || 'photo'}`}
              title={t('galleries.detail.deletePhoto')}
            >
              {deletingId === photo.id ? '…' : '×'}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function GalleryDetail({
  gallery,
  subdomain,
  styles,
  colors,
  busy,
  onPatch,
  onExtend,
  onDelete,
  onUpload,
  onPhotosChanged,
}: Readonly<{
  gallery: Gallery | null;
  subdomain: string | null;
  styles: AppStyles;
  colors: AppColors;
  busy: boolean;
  onPatch: (_id: string, _body: Record<string, unknown>) => void;
  onExtend: (_id: string) => void;
  onDelete: (_id: string) => void;
  onUpload: (_id: string, _files: FileList) => void;
  onPhotosChanged: () => void;
}>) {
  // 'idle' | 'copied' | 'failed' — 'failed' needs its own state so the button
  // can tell the user to copy the link manually instead of appearing inert.
  const { t, tPlural } = useTranslation();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  // Reset the transient feedback after a moment, cancelled on unmount so it
  // never fires into a detail panel the user has already navigated away from.
  useEffect(() => {
    if (copyState === 'idle') return;
    const id = window.setTimeout(() => setCopyState('idle'), 2500);
    return () => window.clearTimeout(id);
  }, [copyState]);
  const fileRef = useRef<HTMLInputElement>(null);

  // The viewer lives in-app at /g/{subdomain}/{token}. Without a subdomain the
  // link can't be built (the token alone can't resolve the tenant schema).
  const shareUrl =
    gallery && subdomain ? `${window.location.origin}/g/${subdomain}/${gallery.accessToken}` : null;
  const shareDisplay =
    gallery && subdomain
      ? `${window.location.host}/g/${subdomain}/${gallery.accessToken}`
      : t('galleries.detail.linkUnavailable');

  /**
   * Copying the share link is how a finished gallery actually reaches the
   * client, so it must never fail silently.
   *
   * <p>`navigator.clipboard` is undefined outside a secure context — plain
   * HTTP, and notably a dev server reached over a LAN IP — so calling
   * `.writeText` on it threw a TypeError straight out of the click handler.
   * Where it does exist the promise can still reject (permission denied,
   * document not focused), and nothing was catching that either: the button
   * just did nothing. Fall back to selecting the text so the user can copy it
   * manually, and say so when even that isn't possible.
   */
  async function copyLink() {
    if (!shareUrl) return;
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(shareUrl);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  if (!gallery) {
    return (
      <div style={styles.emptyState}>
        <IconGallery />
        <span>{t('galleries.detail.selectPrompt')}</span>
      </div>
    );
  }

  const days = daysUntil(gallery.expiresAt);
  const kind = expiryKind(days);
  const expiryBadgeStyle =
    kind === 'expired'
      ? styles.expiryExpired
      : kind === 'warning'
        ? styles.expiryWarning
        : styles.expiryActive;

  const shootDate = formatMonthDayYear(gallery.shootDate);

  // The window is the plan's, not a number this screen picks. It used to
  // PATCH an arbitrary expiresAt, which meant the browser decided how long a
  // gallery lived — retention is one of the two things the tiers actually
  // sell, so the server derives it now (ADR-001 §4).
  function extendGallery() {
    if (!gallery) return;
    onExtend(gallery.id);
  }

  return (
    <>
      <div style={styles.detailHeader}>
        <div>
          <div style={styles.detailTitle}>{gallery.bookingName}</div>
          <div style={styles.detailSubtitle}>
            {gallery.eventType} · Shot on {shootDate}
          </div>
        </div>
        <div style={styles.detailActions}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) onUpload(gallery.id, e.target.files);
              e.target.value = '';
            }}
          />
          <button
            style={{ ...styles.actionButton, ...styles.actionButtonOutline }}
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <IconUpload /> {busy ? t('galleries.detail.uploading') : t('galleries.detail.upload')}
          </button>
          {shareUrl && (
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...styles.actionButton,
                ...styles.actionButtonPrimary,
                textDecoration: 'none',
              }}
            >
              <IconEye /> View gallery
            </a>
          )}
        </div>
      </div>

      <div style={styles.detailBody}>
        <div style={styles.statsGrid}>
          <div style={styles.statBox}>
            <div style={styles.statBoxLabel}>{t('galleries.detail.photos')}</div>
            <div style={styles.statBoxValue}>{gallery.photoCount}</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statBoxLabel}>{t('galleries.detail.views')}</div>
            <div style={styles.statBoxValue}>{gallery.viewCount}</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statBoxLabel}>{t('galleries.detail.daysLeft')}</div>
            <div style={styles.statBoxValue}>{days === null ? '∞' : days < 0 ? '—' : days}</div>
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>{t('galleries.detail.photos')}</div>
          <GalleryPhotos
            galleryId={gallery.id}
            photoCount={gallery.photoCount}
            styles={styles}
            colors={colors}
            onDeleted={onPhotosChanged}
          />
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>{t('galleries.detail.accessInfo')}</div>
          <div style={styles.infoGrid}>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>{t('galleries.detail.download')}</span>
              <button
                onClick={() => onPatch(gallery.id, { downloadEnabled: !gallery.downloadEnabled })}
                disabled={busy}
                style={{
                  ...styles.infoValue,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: gallery.downloadEnabled ? colors.successText : colors.textMuted,
                }}
              >
                {gallery.downloadEnabled ? (
                  <>
                    <IconCheck /> Enabled
                  </>
                ) : (
                  <>
                    <IconX /> Disabled
                  </>
                )}
              </button>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>{t('galleries.detail.watermark')}</span>
              <button
                onClick={() => onPatch(gallery.id, { watermarkEnabled: !gallery.watermarkEnabled })}
                disabled={busy}
                style={{
                  ...styles.infoValue,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: gallery.watermarkEnabled ? colors.successText : colors.textMuted,
                }}
              >
                {gallery.watermarkEnabled ? (
                  <>
                    <IconCheck /> Enabled
                  </>
                ) : (
                  <>
                    <IconX /> Disabled
                  </>
                )}
              </button>
            </div>
            <div style={{ ...styles.infoRow, borderBottom: 'none', paddingBottom: 0 }}>
              <span style={styles.infoLabel}>{t('galleries.detail.expires')}</span>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: '6px',
                }}
              >
                <span style={styles.infoValue}>
                  {gallery.expiresAt
                    ? formatMonthDayYear(gallery.expiresAt)
                    : t('galleries.expiry.none')}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ ...styles.expiryBadge, ...expiryBadgeStyle }}>
                    {expiryText(days, t, tPlural)}
                  </span>
                  <button
                    onClick={extendGallery}
                    disabled={busy}
                    style={{
                      ...styles.actionButton,
                      ...styles.actionButtonOutline,
                      padding: '3px 9px',
                      fontSize: '0.75rem',
                    }}
                  >
                    +30 days
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>{t('galleries.detail.linkTitle')}</div>
          <div style={styles.codeBlock}>{shareDisplay}</div>
          <button
            style={{
              ...styles.actionButton,
              ...styles.actionButtonOutline,
              width: '100%',
              marginTop: '10px',
              justifyContent: 'center',
            }}
            onClick={copyLink}
            disabled={!shareUrl}
          >
            <IconCopy />{' '}
            {copyState === 'copied'
              ? t('galleries.detail.copied')
              : copyState === 'failed'
                ? t('galleries.detail.copyManually')
                : t('galleries.detail.copyLink')}
          </button>
        </div>

        <div style={styles.section}>
          <button
            onClick={() => onDelete(gallery.id)}
            disabled={busy}
            style={{
              ...styles.actionButton,
              ...styles.actionButtonOutline,
              width: '100%',
              justifyContent: 'center',
              color: colors.dangerText,
              borderColor: colors.dangerText,
            }}
          >
            <IconTrash /> Delete gallery
          </button>
        </div>
      </div>
    </>
  );
}

// ─── CreateGalleryModal ─────────────────────────────────────────────────────────
function CreateGalleryModal({
  colors,
  onClose,
  onCreated,
}: Readonly<{ colors: AppColors; onClose: () => void; onCreated: (_g: Gallery) => void }>) {
  const { t } = useTranslation();
  const [bookings, setBookings] = useState<BookingOption[]>([]);
  const [bookingId, setBookingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<AsyncError | null>(null);

  useEffect(() => {
    api
      .get<BookingOption[]>('/api/photographerBookings?size=100')
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setBookings(list);
        setBookingId(list[0]?.id ?? '');
      })
      .catch(() => setError({ key: 'galleries.create.bookingsError' }))
      .finally(() => setLoading(false));
    // No `t`: the failure is a key now, so a language change must not refetch
    // the booking list and reset the selection the user has already made.
  }, []);

  async function submit() {
    if (!bookingId) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await api.post<Gallery>('/api/galleries', { bookingId });
      onCreated(data);
    } catch {
      setError({ key: 'galleries.create.error' });
      setSubmitting(false);
    }
  }

  const overlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 20,
  };
  const card: React.CSSProperties = {
    background: colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 440,
    border: `1px solid ${colors.border}`,
    color: colors.text,
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 4 }}>
          {t('galleries.create.title')}
        </h2>
        <p style={{ fontSize: '0.85rem', color: colors.textMuted, marginBottom: 18 }}>
          Create a delivery gallery for a booking, then upload the photos.
        </p>

        {loading ? (
          <div style={{ color: colors.textMuted, padding: '20px 0' }}>
            {t('galleries.create.loadingBookings')}
          </div>
        ) : bookings.length === 0 ? (
          <div style={{ color: colors.textMuted, padding: '12px 0', fontSize: '0.9rem' }}>
            You have no bookings yet — create a booking first, then come back to deliver its
            gallery.
          </div>
        ) : (
          <>
            <label
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: colors.textMuted,
              }}
            >
              Booking
            </label>
            <select
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              style={{
                width: '100%',
                marginTop: 6,
                padding: '10px 12px',
                borderRadius: 10,
                border: `1px solid ${colors.border}`,
                background: colors.surface,
                color: colors.text,
                fontSize: '0.9rem',
              }}
            >
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.clientName}
                  {b.eventType ? ` · ${b.eventType}` : ''} · {formatMonthDayYear(b.eventDate)}
                </option>
              ))}
            </select>
          </>
        )}

        {error && (
          <p style={{ color: colors.dangerText, fontSize: '0.82rem', marginTop: 12 }}>
            {asyncErrorText(error, t)}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 16px',
              borderRadius: 10,
              border: `1px solid ${colors.border}`,
              background: 'transparent',
              color: colors.text,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!bookingId || submitting}
            style={{
              padding: '9px 18px',
              borderRadius: 10,
              border: 'none',
              background: colors.primarySolid,
              color: '#fff',
              fontWeight: 600,
              cursor: !bookingId || submitting ? 'default' : 'pointer',
              opacity: !bookingId || submitting ? 0.6 : 1,
            }}
          >
            {submitting ? t('galleries.create.submitting') : t('galleries.create.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── GalleriesPage ────────────────────────────────────────────────────────────
export default function GalleriesPage() {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const styles = useMemo(() => getGalleriesStyles(theme), [theme]);
  const colors = useMemo(() => getGalleriesColors(theme), [theme]);
  const isPhotographer = useIsPhotographer();
  const subdomain = useAuthStore((s) => s.user?.tenant?.subdomain ?? null);

  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [selectedGalleryId, setSelectedGalleryId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'All' | 'Active' | 'Expired'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AsyncError | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadGalleries = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get<Gallery[]>('/api/galleries')
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setGalleries(list);
        setSelectedGalleryId((prev) => prev ?? list[0]?.id ?? null);
      })
      .catch(() => setError({ key: 'galleries.loadErrorBody' }))
      .finally(() => setLoading(false));
    // No `t`: an effect depends on this, so it would reload every gallery on
    // each language change.
  }, []);

  useEffect(() => {
    if (isPhotographer) loadGalleries();
  }, [isPhotographer, loadGalleries]);

  const patchGallery = useCallback(async (id: string, body: Record<string, unknown>) => {
    setBusyId(id);
    try {
      const { data } = await api.patch<Gallery>(`/api/galleries/${id}`, body);
      setGalleries((prev) => prev.map((g) => (g.id === id ? data : g)));
    } catch {
      setError({ key: 'galleries.update.error' });
    } finally {
      setBusyId(null);
    }
  }, []);

  /**
   * Grants one more full plan-sized window (ADR-001 §4.2). Works on a gallery
   * that already lapsed — that recovery path is precisely why the grace period
   * exists — and 409s once the photos have actually been deleted.
   */
  const extendGallery = useCallback(async (id: string) => {
    setBusyId(id);
    try {
      const { data } = await api.post<Gallery>(`/api/galleries/${id}/extend`, {});
      setGalleries((prev) => prev.map((g) => (g.id === id ? data : g)));
    } catch {
      setError({ key: 'galleries.extend.error' });
    } finally {
      setBusyId(null);
    }
  }, []);

  const deleteGallery = useCallback(async (id: string) => {
    if (!window.confirm('Delete this gallery and all its photos? This cannot be undone.')) return;
    setBusyId(id);
    try {
      await api.delete(`/api/galleries/${id}`);
      setGalleries((prev) => {
        const next = prev.filter((g) => g.id !== id);
        setSelectedGalleryId(next[0]?.id ?? null);
        return next;
      });
    } catch {
      setError({ key: 'galleries.delete.error' });
    } finally {
      setBusyId(null);
    }
  }, []);

  const uploadPhotos = useCallback(async (galleryId: string, files: FileList) => {
    setBusyId(galleryId);
    try {
      for (const file of Array.from(files)) {
        const { data: init } = await api.post<InitiateUploadResponse>(
          `/api/galleries/${galleryId}/photos/initiate-upload`,
          { filename: file.name, contentType: file.type || 'application/octet-stream' }
        );
        const put = await fetch(init.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
        });
        // `fetch` only rejects on a network failure — a 403 (expired presign),
        // 400 or 5xx from R2 resolves normally. Without this check the code
        // marched straight on to `complete`, so the delivery_photos row was
        // created pointing at an object that was never stored: the photographer
        // saw "uploaded", photoCount counted it, and the client's gallery
        // rendered a broken image. The portfolio uploader already checks its
        // status (see fetchPutWithProgress); this path did not.
        if (!put.ok) {
          throw new Error(`Storage rejected the upload (HTTP ${put.status})`);
        }
        await api.post(`/api/galleries/photos/${init.photoId}/complete`, {
          fileSizeBytes: file.size,
        });
      }
      // Re-read so photoCount reflects the new uploads.
      const { data } = await api.get<Gallery[]>('/api/galleries');
      if (Array.isArray(data)) setGalleries(data);
    } catch {
      setError({ key: 'galleries.detail.uploadError' });
    } finally {
      setBusyId(null);
    }
    // `t` is memoised per language, so this only re-creates when the user
    // switches locale — which is exactly when the error copy must change.
  }, []);

  const filteredGalleries = useMemo(() => {
    let filtered = galleries;
    if (filterStatus === 'Active')
      filtered = filtered.filter((g) => {
        const d = daysUntil(g.expiresAt);
        return d === null || d >= 0;
      });
    else if (filterStatus === 'Expired')
      filtered = filtered.filter((g) => {
        const d = daysUntil(g.expiresAt);
        return d !== null && d < 0;
      });
    const q = searchQuery.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter(
      (g) => g.bookingName.toLowerCase().includes(q) || g.eventType.toLowerCase().includes(q)
    );
  }, [galleries, filterStatus, searchQuery]);

  const selectedGallery = useMemo(
    () => galleries.find((g) => g.id === selectedGalleryId) ?? galleries[0] ?? null,
    [galleries, selectedGalleryId]
  );

  const stats = useMemo(
    () => ({
      total: galleries.length,
      active: galleries.filter((g) => {
        const d = daysUntil(g.expiresAt);
        return d === null || d >= 0;
      }).length,
      totalPhotos: galleries.reduce((sum, g) => sum + g.photoCount, 0),
    }),
    [galleries]
  );

  // Client view: no tenant-wide gallery list for them (and no customer gallery
  // API yet), so present a calm empty state instead of a retry-loop error.
  if (!isPhotographer) {
    return (
      <div style={styles.pageWrapper}>
        <header style={styles.pageHeader}>
          <div>
            <h1 style={styles.pageTitle}>{t('galleries.title')}</h1>
            <p style={styles.pageSubtitle}>{t('galleries.subtitleClient')}</p>
          </div>
        </header>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '64px 24px',
            gap: '14px',
            color: colors.textMuted,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '14px',
              background: colors.surfaceAlt,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="15" rx="2" />
              <circle cx="8.5" cy="9.5" r="1.5" />
              <path d="M21 16l-5-5-6 6-3-3-4 4" />
            </svg>
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: colors.text }}>
            No galleries yet
          </div>
          <div style={{ fontSize: '0.9rem', maxWidth: 360 }}>
            Your photos will appear here once your photographer delivers them.
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={styles.pageWrapper}>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
        <div style={styles.container}>
          <div style={styles.listPanel}>
            <div style={styles.listScroll}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: '14px 16px',
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      height: 13,
                      width: '60%',
                      borderRadius: 6,
                      background: colors.surfaceAlt,
                      animation: 'pulse 1.6s ease-in-out infinite',
                    }}
                  />
                  <div
                    style={{
                      height: 11,
                      width: '40%',
                      borderRadius: 6,
                      background: colors.surfaceAlt,
                      animation: 'pulse 1.6s ease-in-out infinite',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div style={styles.detailPanel}>
            <div style={styles.emptyState}>{t('galleries.loading')}</div>
          </div>
        </div>
      </div>
    );
  }

  if (error && galleries.length === 0) {
    return (
      <div style={styles.pageWrapper}>
        <div style={styles.errorPanel}>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>{t('galleries.loadError')}</div>
          <div style={styles.errorText}>{asyncErrorText(error, t)}</div>
          <button style={styles.retryButton} onClick={loadGalleries}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageWrapper}>
      {showCreate && (
        <CreateGalleryModal
          colors={colors}
          onClose={() => setShowCreate(false)}
          onCreated={(g) => {
            setGalleries((prev) => [g, ...prev]);
            setSelectedGalleryId(g.id);
            setShowCreate(false);
          }}
        />
      )}

      <header style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>{t('galleries.title')}</h1>
          <p style={styles.pageSubtitle}>{t('galleries.subtitle')}</p>
        </div>
        <div style={styles.headerStats}>
          <div style={styles.headerStatCard}>
            <div style={styles.headerStatLabel}>{t('galleries.stat.galleries')}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <div style={styles.headerStatValue}>{stats.total}</div>
              <div style={styles.headerStatChange}>{stats.active} active</div>
            </div>
          </div>
          <div style={styles.headerStatCard}>
            <div style={styles.headerStatLabel}>{t('galleries.stat.totalPhotos')}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <div style={styles.headerStatValue}>{stats.totalPhotos}</div>
              <div style={styles.headerStatChange}>{t('galleries.stat.available')}</div>
            </div>
          </div>
          <button
            style={{ ...styles.actionButton, ...styles.actionButtonPrimary, alignSelf: 'center' }}
            onClick={() => setShowCreate(true)}
          >
            <IconPlus /> New gallery
          </button>
        </div>
      </header>

      <div style={styles.container}>
        <div style={styles.listPanel}>
          <div style={styles.listHeader}>
            <div style={styles.listTitle}>{t('galleries.list.title')}</div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('galleries.list.search')}
              aria-label={t('galleries.list.searchLabel')}
              style={styles.searchBox}
            />
          </div>

          <div style={styles.filterTabs}>
            {(
              [
                ['All', 'galleries.filter.all'],
                ['Active', 'galleries.filter.active'],
                ['Expired', 'galleries.filter.expired'],
              ] as const
            ).map(([status, labelKey]) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                style={{
                  ...styles.filterTab,
                  ...(filterStatus === status ? styles.filterTabActive : {}),
                }}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>

          <div style={styles.listScroll}>
            {filteredGalleries.length === 0 ? (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  color: colors.textMuted,
                  fontSize: '0.875rem',
                }}
              >
                {galleries.length === 0 ? t('galleries.list.empty') : t('galleries.list.noMatch')}
              </div>
            ) : (
              filteredGalleries.map((gallery) => (
                <GalleryListItem
                  key={gallery.id}
                  gallery={gallery}
                  isActive={selectedGalleryId === gallery.id}
                  onSelect={() => setSelectedGalleryId(gallery.id)}
                  styles={styles}
                  colors={colors}
                />
              ))
            )}
          </div>
        </div>

        <div style={styles.detailPanel}>
          <GalleryDetail
            gallery={selectedGallery}
            subdomain={subdomain}
            styles={styles}
            colors={colors}
            busy={busyId !== null && busyId === selectedGallery?.id}
            onPatch={patchGallery}
            onExtend={extendGallery}
            onDelete={deleteGallery}
            onUpload={uploadPhotos}
            onPhotosChanged={loadGalleries}
          />
        </div>
      </div>
    </div>
  );
}
