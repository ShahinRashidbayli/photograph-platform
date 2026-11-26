'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { useIsPhotographer, useAuthStore } from '@/store/authStore';
import { CustomerGalleries } from './CustomerGalleries';
import { asyncError, asyncErrorText, type AsyncError } from '@/lib/async-error';
import { formatMonthDayYear } from '@/lib/helpers';
import { useTranslation } from '@/lib/i18n';
import { StatStrip } from '@/components/StatStrip';
import { Alert, Badge, Button, Toggle } from '@/components/ui';
import { PersonalNoteDialog } from '@/components/PersonalNoteDialog';
import { getInitials, pickAvatarColor } from '@/lib/avatar';
import {
  useCreateGallery,
  useDeleteGallery,
  useDeleteGalleryPhoto,
  useExtendGallery,
  useGalleries,
  useGalleryBookingOptions,
  useGalleryPhotos,
  useSendGallery,
  useUpdateGallery,
  useUploadGalleryPhotos,
  type DeliveryPhoto,
  type Gallery,
} from '@/hooks/useGalleries';
import { getGalleriesColors, getGalleriesStyles } from './galleries.styles';
import {
  daysUntil,
  expiryKind,
  expiryText,
  galleryGroup,
  GROUP_LABEL_KEY,
  GROUP_ORDER,
  type GalleryGroup,
} from './galleries.expiry';

type AppColors = ReturnType<typeof getGalleriesColors>;
type AppStyles = ReturnType<typeof getGalleriesStyles>;

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
/**
 * A 64-character access token, shortened for display.
 *
 * Shown whole it wrapped onto a second line of hex nobody reads, which made
 * the link block the tallest thing in the sharing section. Enough of each end
 * survives to tell two galleries apart; the button copies the real URL, so
 * nothing depends on this string being complete.
 */
function truncateToken(token: string): string {
  return token.length <= 20 ? token : `${token.slice(0, 8)}…${token.slice(-7)}`;
}

const IconDownload = () => (
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
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconDroplet = () => (
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
    <path d="M12 2.7 6.8 8.2a7.3 7.3 0 1 0 10.4 0Z" />
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

// ─── Row chrome ───────────────────────────────────────────────────────────────
const IconImageOff = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 15V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11" />
    <path d="m4 18 5-5 3 3" />
    <path d="m2 2 20 20" />
  </svg>
);
const IconImage = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.4" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);
const IconChevronRight = () => (
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
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const IconSearch = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);
const IconChevronDown = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/** How many rows the rail shows before "show the remaining n". */
const LIST_PAGE_SIZE = 6;

/** Stable while the query has no data, so the memos below do not recompute every render. */
const NO_GALLERIES: Gallery[] = [];

// ─── GalleryListItem ──────────────────────────────────────────────────────────
/**
 * One gallery in the rail: thumbnail, who and when, and a status line that
 * doubles as the row's urgency colour.
 *
 * <p>The row carries its own next action rather than deferring every one of
 * them to the detail panel — an empty gallery offers Upload, a lapsed one
 * offers Reactivate. Those are the two states where the list itself is the
 * to-do list, and making the photographer select the row first to find out
 * turned a one-click job into three.
 */
function GalleryListItem({
  gallery,
  isActive,
  busy,
  onSelect,
  onUpload,
  onExtend,
  styles,
  colors,
}: Readonly<{
  gallery: Gallery;
  isActive: boolean;
  busy: boolean;
  onSelect: () => void;
  /** Opens the file picker for this gallery. */
  onUpload: () => void;
  onExtend: () => void;
  styles: AppStyles;
  colors: AppColors;
}>) {
  const { t, tPlural, format } = useTranslation();
  const days = daysUntil(gallery.expiresAt);
  const kind = expiryKind(days);
  const isEmpty = gallery.photoCount === 0;
  const tone =
    kind === 'expired'
      ? colors.dangerText
      : kind === 'warning'
        ? colors.warningText
        : colors.textMuted;

  // An expired gallery's countdown is the whole story — pairing it with a photo
  // count reads as though the photos are still being served, which they are not.
  const meta =
    kind === 'expired'
      ? tPlural('galleries.expiry.expiredSince', Math.abs(days ?? 0))
      : `${isEmpty ? t('galleries.list.noPhotos') : tPlural('galleries.photoCount', gallery.photoCount)} · ${expiryText(days, t, tPlural)}`;

  // Reactivate is only offered while it would actually work: once the photos
  // are purged the endpoint 409s, and the row falls back to the chevron.
  const action =
    kind === 'expired'
      ? gallery.canExtend
        ? { label: t('galleries.list.reactivate'), run: onExtend }
        : null
      : isEmpty
        ? { label: t('galleries.detail.upload'), run: onUpload }
        : null;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={isActive}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      style={{ ...styles.row, ...(isActive ? styles.rowActive : {}) }}
    >
      {isActive && <span aria-hidden style={styles.rowAccent} />}
      <span aria-hidden style={{ ...styles.thumb, ...(isEmpty ? styles.thumbEmpty : {}) }}>
        {isEmpty ? <IconImageOff /> : <IconImage />}
      </span>
      <span style={styles.rowBody}>
        <span style={styles.rowTitle}>{gallery.bookingName}</span>
        <span style={styles.rowSub}>
          {gallery.eventType} · {format.monthDayYear(gallery.shootDate)}
        </span>
        <span style={{ ...styles.rowMeta, color: tone }}>{meta}</span>
      </span>
      {action ? (
        <button
          type="button"
          style={styles.rowAction}
          disabled={busy}
          onClick={(e) => {
            // The row is clickable too; without this, acting on a gallery also
            // moved the selection under the photographer.
            e.stopPropagation();
            action.run();
          }}
        >
          {busy ? '…' : action.label}
        </button>
      ) : (
        <span aria-hidden style={styles.rowChevron}>
          <IconChevronRight />
        </span>
      )}
    </div>
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
 * <p>Stays current without being told: an upload or a delete refreshes this
 * gallery's photos itself (see the mutations in `useGalleries`).
 */
function GalleryPhotos({
  galleryId,
  styles,
  colors,
  onAdd,
}: Readonly<{
  galleryId: string;
  styles: AppStyles;
  colors: AppColors;
  /** Opens the file picker. Renders the trailing tile in the grid. */
  onAdd: () => void;
}>) {
  const { t } = useTranslation();
  const photosQuery = useGalleryPhotos(galleryId);
  const deletePhoto = useDeleteGalleryPhoto(galleryId);
  const photos = photosQuery.data ?? [];
  const deletingId = deletePhoto.isPending ? deletePhoto.variables : null;

  function remove(photo: DeliveryPhoto) {
    const name = photo.originalFilename || 'this photo';
    if (!window.confirm(`Delete ${name}? The client will no longer see it. This cannot be undone.`))
      return;
    deletePhoto.mutate(photo.id);
  }

  const addTile = (
    <button type="button" style={styles.addTile} onClick={onAdd}>
      <IconPlus />
      {t('galleries.detail.addPhotos')}
    </button>
  );

  if (photosQuery.isLoading) {
    return (
      <div style={{ color: colors.textMuted, fontSize: '0.85rem' }}>
        {t('galleries.detail.photosLoading')}
      </div>
    );
  }
  // The empty state still shows the tile — "there is nothing here" and "here
  // is how to fix that" belong in the same place.
  if (photos.length === 0) {
    return (
      <>
        <div style={{ color: colors.textMuted, fontSize: '0.85rem', marginBottom: 10 }}>
          {t('galleries.detail.photosEmpty')}
        </div>
        <div style={styles.photoGrid}>{addTile}</div>
      </>
    );
  }

  return (
    <>
      {/* Without this a failed delete left the photo simply sitting there —
          indistinguishable from a click that never registered, on an action
          the photographer believes removed a client's photo. */}
      {deletePhoto.isError && (
        <div
          role="alert"
          style={{ color: colors.dangerText, fontSize: '0.82rem', marginBottom: 10 }}
        >
          {t('galleries.detail.deletePhotoError')}
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
        {addTile}
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
  onSend,
  onDelete,
  onUpload,
}: Readonly<{
  gallery: Gallery | null;
  subdomain: string | null;
  styles: AppStyles;
  colors: AppColors;
  busy: boolean;
  onPatch: (_id: string, _body: Record<string, unknown>) => void;
  onExtend: (_id: string) => void;
  onSend: (_id: string) => void;
  onDelete: (_id: string) => void;
  onUpload: (_id: string, _files: FileList) => void;
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
      ? `${window.location.host}/g/${subdomain}/${truncateToken(gallery.accessToken)}`
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
  const avatarPalette = pickAvatarColor(gallery.id, colors.isDark);

  const statusLabel = {
    ACTIVE: t('galleries.detail.statusActive'),
    EXPIRED: t('galleries.detail.statusExpired'),
    PURGED: t('galleries.detail.statusPurged'),
  }[gallery.expiryState];

  const statusTone =
    gallery.expiryState === 'ACTIVE'
      ? { fg: colors.successText, bg: colors.successBg }
      : { fg: colors.dangerText, bg: colors.dangerBg };

  /**
   * How much of the retention window is left, 0–1, or null when there is no
   * window to show.
   *
   * `retentionDays` is the plan's, so the bar is measured against what this
   * tenant actually bought rather than a number this screen invented. Without
   * both halves — a gallery with no expiry, or one whose plan window is
   * unknown — there is no proportion to draw and the bar is omitted rather
   * than rendered full.
   */
  const expiryFraction =
    days === null || gallery.retentionDays === null || gallery.retentionDays <= 0
      ? null
      : Math.max(0, Math.min(1, days / gallery.retentionDays));

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          {/* The client's initials, the same mark the bookings and clients
              lists use for the same person — so a gallery is recognisably
              *theirs* rather than a row of settings with a name on top. */}
          <span
            style={{
              ...styles.detailAvatar,
              background: avatarPalette.bg,
              color: avatarPalette.fg,
            }}
            aria-hidden
          >
            {getInitials(gallery.bookingName)}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={styles.detailTitleRow}>
              <div style={styles.detailTitle}>{gallery.bookingName}</div>
              <Badge tone={statusTone.fg} background={statusTone.bg}>
                {statusLabel}
              </Badge>
            </div>
            <div style={styles.detailSubtitle}>
              {gallery.eventType} · {shootDate}
            </div>
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
          {/* Sent when the photos are in, not when the gallery is created —
              so a Customer never opens an empty one. Sendable again. */}
          <Button
            onClick={() => onSend(gallery.id)}
            disabled={busy || gallery.photoCount === 0}
            title={gallery.photoCount === 0 ? t('galleries.send.empty') : undefined}
          >
            {t('galleries.send.action')}
          </Button>
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
              <IconEye /> {t('galleries.detail.viewGallery')}
            </a>
          )}
        </div>
      </div>

      <div style={styles.detailBody}>
        {/* Figures and countdown on one line: how much is in the gallery and
            how long it stays up are read together when deciding to extend. */}
        <div style={styles.overviewRow}>
          <div style={styles.metricsRow}>
            {[
              { label: t('galleries.detail.photos'), value: gallery.photoCount },
              { label: t('galleries.detail.views'), value: gallery.viewCount },
            ].map((m, i) => (
              <div
                key={m.label}
                style={{
                  ...styles.metric,
                  ...(i === 0 ? { paddingLeft: 0 } : { borderLeft: `1px solid ${colors.border}` }),
                }}
              >
                <span style={styles.metricValue}>{m.value}</span>
                <span style={styles.metricLabel}>{m.label}</span>
              </div>
            ))}
          </div>

          <div style={styles.expiryBlock}>
            <div style={styles.expiryHeadRow}>
              <span style={styles.expiryDate}>
                {gallery.expiresAt
                  ? t('galleries.detail.expiresOn', {
                      date: formatMonthDayYear(gallery.expiresAt),
                    })
                  : t('galleries.detail.neverExpires')}
              </span>
              <span style={{ ...styles.expiryBadge, ...expiryBadgeStyle }}>
                {expiryText(days, t, tPlural)}
              </span>
            </div>
            {/* Only drawn when there is a window to draw — an unlimited
                gallery has no proportion to show, and a full-width bar would
                claim otherwise. */}
            {expiryFraction !== null && (
              <div style={styles.expiryTrack}>
                <div
                  style={{
                    ...styles.expiryFill,
                    width: `${expiryFraction * 100}%`,
                    background: kind === 'expired' ? colors.dangerText : colors.successText,
                  }}
                />
              </div>
            )}
            {gallery.canExtend && (
              <button
                onClick={extendGallery}
                disabled={busy}
                style={{
                  ...styles.actionButton,
                  ...styles.actionButtonOutline,
                  alignSelf: 'flex-start',
                  padding: '5px 12px',
                  fontSize: '0.75rem',
                }}
              >
                {t('galleries.detail.extend')}
              </button>
            )}
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionHeadRow}>
            <div style={{ ...styles.sectionTitle, marginBottom: 0 }}>
              {t('galleries.detail.photos')}
            </div>
            <span style={styles.sectionCount}>{gallery.photoCount}</span>
          </div>
          {/* Keyed so a failed delete in one gallery is not still on screen in the next. */}
          <GalleryPhotos
            key={gallery.id}
            galleryId={gallery.id}
            styles={styles}
            colors={colors}
            onAdd={() => fileRef.current?.click()}
          />
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>{t('galleries.detail.sharing')}</div>
          {/* Switches, not the words "Enabled"/"Disabled" wired to a click.
              These are the two things a photographer changes before sending a
              gallery, and as text they read as a status the app was reporting
              rather than a control. */}
          <div style={styles.toggleList}>
            <Toggle
              checked={gallery.downloadEnabled}
              onChange={(next) => onPatch(gallery.id, { downloadEnabled: next })}
              disabled={busy}
              icon={<IconDownload />}
              label={t('galleries.detail.downloadLabel')}
              description={
                gallery.downloadEnabled
                  ? t('galleries.detail.downloadOn')
                  : t('galleries.detail.downloadOff')
              }
            />
            <div style={styles.toggleDivider}>
              <Toggle
                checked={gallery.watermarkEnabled}
                onChange={(next) => onPatch(gallery.id, { watermarkEnabled: next })}
                disabled={busy}
                icon={<IconDroplet />}
                label={t('galleries.detail.watermark')}
                description={
                  gallery.watermarkEnabled
                    ? t('galleries.detail.watermarkOn')
                    : t('galleries.detail.watermarkOff')
                }
              />
            </div>
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>{t('galleries.detail.linkTitle')}</div>
          <div style={styles.linkRow}>
            <div style={{ ...styles.codeBlock, flex: 1, minWidth: 0 }}>{shareDisplay}</div>
            <button
              style={{
                ...styles.actionButton,
                ...styles.actionButtonOutline,
                whiteSpace: 'nowrap',
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
  const bookingsQuery = useGalleryBookingOptions();
  const createGallery = useCreateGallery();
  const bookings = bookingsQuery.data ?? [];
  const loading = bookingsQuery.isLoading;
  // Nothing chosen yet means the first booking — derived rather than copied
  // into state on load, so there is no moment where the select shows one
  // booking and submit would send none.
  const [chosenBookingId, setBookingId] = useState('');
  const bookingId = chosenBookingId || bookings[0]?.id || '';
  // Held through success too: the modal closes on success, and re-enabling
  // the button for that one frame would invite a second gallery.
  const submitting = createGallery.isPending || createGallery.isSuccess;
  const error: AsyncError | null = createGallery.isError
    ? { key: 'galleries.create.error' }
    : bookingsQuery.isError
      ? { key: 'galleries.create.bookingsError' }
      : null;

  function submit() {
    if (!bookingId) return;
    createGallery.mutate(bookingId, { onSuccess: onCreated });
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
        <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: 4 }}>
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
                fontWeight: 550,
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
              color: colors.onPrimary,
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
  const { t, tPlural } = useTranslation();
  const { theme } = useThemeStore();
  const styles = useMemo(() => getGalleriesStyles(theme), [theme]);
  const colors = useMemo(() => getGalleriesColors(theme), [theme]);
  const isPhotographer = useIsPhotographer();
  const subdomain = useAuthStore((s) => s.user?.tenant?.subdomain ?? null);

  const galleriesQuery = useGalleries(isPhotographer);
  const galleries = galleriesQuery.data ?? NO_GALLERIES;
  const loading = galleriesQuery.isLoading;
  const [selectedGalleryId, setSelectedGalleryId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'All' | 'Active' | 'Expired'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  // A failed action on a gallery. Kept apart from the load error: that one
  // replaces the page, while this one has to show *above* the galleries —
  // before, both shared one state rendered only when the list was empty, so a
  // failed delete, extend or upload on an existing gallery showed nothing.
  const [actionError, setActionError] = useState<AsyncError | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  // The gallery whose "An Kunden senden" dialog is open.
  const [sendingId, setSendingId] = useState<string | null>(null);
  // The rail shows the first page of galleries and offers the rest behind one
  // click — a photographer two seasons in has a hundred of them, and the ones
  // that need doing something about are already sorted to the top.
  const [showAll, setShowAll] = useState(false);
  const listFileRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<string | null>(null);

  const updateGallery = useUpdateGallery();
  const extendGalleryMutation = useExtendGallery();
  const deleteGalleryMutation = useDeleteGallery();
  const uploadGalleryPhotos = useUploadGalleryPhotos();
  const sendGalleryMutation = useSendGallery();
  const { mutate: mutateSend } = sendGalleryMutation;
  // `mutate` is stable across renders; the mutation object around it is not.
  const { mutate: mutateUpdate } = updateGallery;
  const { mutate: mutateExtend } = extendGalleryMutation;
  const { mutate: mutateDelete } = deleteGalleryMutation;
  const { mutate: mutateUpload } = uploadGalleryPhotos;

  /** The gallery an action is running against, so its row and panel can show it. */
  const busyId =
    (updateGallery.isPending && updateGallery.variables?.id) ||
    (extendGalleryMutation.isPending && extendGalleryMutation.variables) ||
    (deleteGalleryMutation.isPending && deleteGalleryMutation.variables) ||
    (uploadGalleryPhotos.isPending && uploadGalleryPhotos.variables?.id) ||
    (sendGalleryMutation.isPending && sendGalleryMutation.variables?.id) ||
    null;

  const patchGallery = useCallback(
    (id: string, body: Record<string, unknown>) => {
      setActionError(null);
      mutateUpdate(
        { id, body },
        { onError: () => setActionError({ key: 'galleries.update.error' }) }
      );
    },
    [mutateUpdate]
  );

  const extendGallery = useCallback(
    (id: string) => {
      setActionError(null);
      mutateExtend(id, {
        onError: () => setActionError({ key: 'galleries.extend.error' }),
      });
    },
    [mutateExtend]
  );

  const sendGallery = useCallback(
    (id: string, note: string | null) => {
      setActionError(null);
      mutateSend(
        { id, note },
        {
          onError: (err) => setActionError(asyncError(err, 'galleries.send.error')),
          // Closed on failure too, with the error above the galleries: a
          // dialog left open invites a second click and a second email.
          onSettled: () => setSendingId(null),
        }
      );
    },
    [mutateSend]
  );

  const deleteGallery = useCallback(
    (id: string) => {
      if (!window.confirm('Delete this gallery and all its photos? This cannot be undone.')) return;
      setActionError(null);
      mutateDelete(id, {
        // The panel falls back to the top of the list once its gallery is gone.
        onSuccess: () => setSelectedGalleryId((current) => (current === id ? null : current)),
        onError: () => setActionError({ key: 'galleries.delete.error' }),
      });
    },
    [mutateDelete]
  );

  const uploadPhotos = useCallback(
    (galleryId: string, files: FileList) => {
      setActionError(null);
      // Copied out of the FileList: the input is cleared right after this call,
      // which empties the live list the upload would still be reading from.
      mutateUpload(
        { id: galleryId, files: Array.from(files) },
        { onError: () => setActionError({ key: 'galleries.detail.uploadError' }) }
      );
    },
    [mutateUpload]
  );

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

  /**
   * The filtered list split into its three buckets, each ordered by what makes
   * that bucket useful: a running deadline sorts most-urgent-first, and
   * everything else sorts newest shoot first.
   */
  const groupedGalleries = useMemo(() => {
    const buckets: Record<GalleryGroup, Gallery[]> = { soon: [], active: [], expired: [] };
    for (const gallery of filteredGalleries) buckets[galleryGroup(gallery.expiresAt)].push(gallery);
    buckets.soon.sort((a, b) => (daysUntil(a.expiresAt) ?? 0) - (daysUntil(b.expiresAt) ?? 0));
    // Days are negative here, so descending puts the most recently lapsed —
    // the ones still worth reactivating — at the top.
    buckets.expired.sort((a, b) => (daysUntil(b.expiresAt) ?? 0) - (daysUntil(a.expiresAt) ?? 0));
    buckets.active.sort((a, b) => Date.parse(b.shootDate) - Date.parse(a.shootDate));
    return buckets;
  }, [filteredGalleries]);

  const orderedGalleries = useMemo(
    () => GROUP_ORDER.flatMap((group) => groupedGalleries[group]),
    [groupedGalleries]
  );
  const visibleGalleries = showAll ? orderedGalleries : orderedGalleries.slice(0, LIST_PAGE_SIZE);
  const hiddenCount = orderedGalleries.length - visibleGalleries.length;

  // A new filter or query is a new list; carrying "expanded" across would drop
  // the photographer into an already-unfolded hundred rows.
  useEffect(() => setShowAll(false), [filterStatus, searchQuery]);

  const statusCounts = useMemo(() => {
    const expired = galleries.filter((g) => {
      const d = daysUntil(g.expiresAt);
      return d !== null && d < 0;
    }).length;
    return { All: galleries.length, Active: galleries.length - expired, Expired: expired };
  }, [galleries]);

  const requestUpload = useCallback((galleryId: string) => {
    uploadTargetRef.current = galleryId;
    listFileRef.current?.click();
  }, []);

  /**
   * The gallery the detail panel shows — resolved against the *ordered* list,
   * not the raw one. Falling back to `galleries[0]` was survivable while the
   * rail rendered in API order and that gallery was the top row; once the rail
   * started grouping, sorting and paging at {@link LIST_PAGE_SIZE}, the panel
   * was opening on a gallery that could sit anywhere in the list or behind
   * "show more" — and, since nothing was selected yet, with no row highlighted
   * to explain where it came from. Resolving here means the panel can only ever
   * show a gallery the photographer can actually see, filtered or not.
   */
  const selectedGallery = useMemo(
    () => orderedGalleries.find((g) => g.id === selectedGalleryId) ?? orderedGalleries[0] ?? null,
    [orderedGalleries, selectedGalleryId]
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

  // The client's own galleries come from their own endpoint — the list above
  // is the studio's and is never fetched for them.
  if (!isPhotographer) {
    return <CustomerGalleries />;
  }

  if (loading) {
    return (
      <div style={styles.pageWrapper}>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
        <div style={styles.container}>
          <div style={styles.listPanel}>
            <div style={styles.listScroll}>
              {/* Same shape as a real row — thumbnail, name, meta, status —
                  so nothing jumps sideways when the galleries land. */}
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} style={{ ...styles.row, cursor: 'default' }}>
                  <span
                    style={{
                      ...styles.thumb,
                      animation: 'pulse 1.6s ease-in-out infinite',
                    }}
                  />
                  <span style={styles.rowBody}>
                    {(['62%', '44%', '52%'] as const).map((width, line) => (
                      <span
                        key={width}
                        style={{
                          height: line === 0 ? 13 : 11,
                          width,
                          borderRadius: 6,
                          background: colors.surfaceAlt,
                          animation: 'pulse 1.6s ease-in-out infinite',
                        }}
                      />
                    ))}
                  </span>
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

  if (galleriesQuery.isError && galleries.length === 0) {
    return (
      <div style={styles.pageWrapper}>
        <div style={styles.errorPanel}>
          <div style={{ fontWeight: 600, fontSize: '1rem' }}>{t('galleries.loadError')}</div>
          <div style={styles.errorText}>{t('galleries.loadErrorBody')}</div>
          <button style={styles.retryButton} onClick={() => galleriesQuery.refetch()}>
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
        {/* The figures stay in the header beside the button they belong with —
            this page's two numbers are context for the action, not a headline
            row of their own. Same band as bookings, clients and portfolio, in
            its `inline` size; `stretch` on the row leaves it and the button
            exactly the same height. */}
        <div style={styles.headerStats}>
          <StatStrip
            variant="inline"
            aria-label={t('galleries.title')}
            items={[
              {
                label: t('galleries.stat.galleries'),
                value: String(stats.total),
                trend: tPlural('galleries.stat.active', stats.active),
              },
              {
                label: t('galleries.stat.totalPhotos'),
                value: String(stats.totalPhotos),
                trend: t('galleries.stat.available'),
              },
            ]}
          />
          <button
            style={{ ...styles.actionButton, ...styles.actionButtonPrimary }}
            onClick={() => setShowCreate(true)}
          >
            <IconPlus /> {t('galleries.create.title')}
          </button>
        </div>
      </header>

      {actionError && (
        <Alert tone="danger" style={{ marginBottom: 16 }}>
          {asyncErrorText(actionError, t)}
        </Alert>
      )}

      <div style={styles.container}>
        <div style={styles.listPanel}>
          <div style={styles.listHeader}>
            <div style={styles.listTitleRow}>
              <div style={styles.listTitle}>{t('galleries.list.title')}</div>
              <span style={styles.listCount}>{galleries.length}</span>
            </div>

            <div style={styles.searchWrap}>
              <span style={styles.searchIcon}>
                <IconSearch />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('galleries.list.search')}
                aria-label={t('galleries.list.searchLabel')}
                style={styles.searchBox}
              />
            </div>

            {/* One segmented control carrying its own counts: the tab labels
                and the "how many are there" figure answered the same question
                from two different places before. */}
            <div
              style={styles.segmented}
              role="tablist"
              aria-label={t('galleries.list.filterLabel')}
            >
              {(
                [
                  ['All', 'galleries.filter.all'],
                  ['Active', 'galleries.filter.active'],
                  ['Expired', 'galleries.filter.expired'],
                ] as const
              ).map(([status, labelKey]) => {
                const active = filterStatus === status;
                return (
                  <button
                    key={status}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilterStatus(status)}
                    style={{
                      ...styles.segmentTab,
                      ...(active ? styles.segmentTabActive : {}),
                    }}
                  >
                    {t(labelKey)}
                    {/* Not aria-hidden: the count is half the answer to "which
                        tab do I want", and hiding it left a screen-reader user
                        with three indistinguishable status names. */}
                    <span
                      style={{
                        fontWeight: 500,
                        color: active ? colors.textMuted : colors.textSubtle,
                      }}
                    >
                      {statusCounts[status]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* One picker for the whole rail: every row's Upload points its id at
              it, so the list doesn't mount a file input per gallery. */}
          <input
            ref={listFileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              const targetId = uploadTargetRef.current;
              if (targetId && e.target.files && e.target.files.length > 0) {
                uploadPhotos(targetId, e.target.files);
              }
              e.target.value = '';
              uploadTargetRef.current = null;
            }}
          />

          <div style={styles.listScroll}>
            {orderedGalleries.length === 0 ? (
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
              <>
                {GROUP_ORDER.map((group) => {
                  const rows = visibleGalleries.filter((g) => galleryGroup(g.expiresAt) === group);
                  if (rows.length === 0) return null;
                  return (
                    <React.Fragment key={group}>
                      <div
                        style={{
                          ...styles.groupHeader,
                          ...(group === 'soon' ? styles.groupHeaderWarning : {}),
                        }}
                      >
                        {group === 'soon' && <IconClock />}
                        {t(GROUP_LABEL_KEY[group])}
                      </div>
                      {rows.map((gallery) => (
                        <GalleryListItem
                          key={gallery.id}
                          gallery={gallery}
                          isActive={selectedGallery?.id === gallery.id}
                          busy={busyId === gallery.id}
                          onSelect={() => setSelectedGalleryId(gallery.id)}
                          onUpload={() => requestUpload(gallery.id)}
                          onExtend={() => extendGallery(gallery.id)}
                          styles={styles}
                          colors={colors}
                        />
                      ))}
                    </React.Fragment>
                  );
                })}

                {hiddenCount > 0 ? (
                  <button type="button" style={styles.showMore} onClick={() => setShowAll(true)}>
                    {tPlural('galleries.list.showMore', hiddenCount)}
                    <IconChevronDown />
                  </button>
                ) : (
                  showAll &&
                  orderedGalleries.length > LIST_PAGE_SIZE && (
                    <button type="button" style={styles.showMore} onClick={() => setShowAll(false)}>
                      {t('galleries.list.showLess')}
                    </button>
                  )
                )}
              </>
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
            onSend={setSendingId}
            onDelete={deleteGallery}
            onUpload={uploadPhotos}
          />
        </div>
      </div>

      {sendingId && (
        <PersonalNoteDialog
          title={t('galleries.send.title')}
          description={t('galleries.send.body', {
            name: galleries.find((g) => g.id === sendingId)?.bookingName ?? '',
          })}
          confirmLabel={t('galleries.send.action')}
          busy={sendGalleryMutation.isPending}
          onSend={(note) => sendGallery(sendingId, note)}
          onClose={() => setSendingId(null)}
        />
      )}
    </div>
  );
}
