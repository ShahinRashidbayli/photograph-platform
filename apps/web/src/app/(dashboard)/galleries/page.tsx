'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { useIsPhotographer, useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { formatMonthDayYear } from '@/lib/helpers';
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
}

interface BookingOption {
  id: string;
  clientName: string;
  eventType: string | null;
  eventDate: string;
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
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconCopy = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
const IconGallery = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);
const IconClock = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);
const IconCheck = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconX = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconUpload = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);
const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

function expiryLabel(days: number | null): { text: string; kind: 'none' | 'expired' | 'warning' | 'ok' } {
  if (days === null) return { text: 'No expiry', kind: 'none' };
  if (days < 0) return { text: 'Expired', kind: 'expired' };
  if (days < 7) return { text: `${days} days left`, kind: 'warning' };
  return { text: `${days} days left`, kind: 'ok' };
}

// ─── GalleryListItem ──────────────────────────────────────────────────────────
function GalleryListItem({
  gallery,
  isActive,
  onSelect,
  styles,
  colors,
}: Readonly<{ gallery: Gallery; isActive: boolean; onSelect: () => void; styles: AppStyles; colors: AppColors }>) {
  const label = expiryLabel(daysUntil(gallery.expiresAt));
  const tone =
    label.kind === 'expired' ? colors.dangerText
      : label.kind === 'warning' ? colors.warningText
        : label.kind === 'ok' ? colors.successText
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
      <div style={{ ...styles.listItemMeta, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        {label.kind === 'expired' ? <IconX /> : label.kind === 'warning' ? <IconClock /> : <IconCheck />}
        <span style={{ color: tone }}>{label.text}</span>
      </div>
    </button>
  );
}

// ─── GalleryDetail ────────────────────────────────────────────────────────────
function GalleryDetail({
  gallery,
  subdomain,
  styles,
  colors,
  busy,
  onPatch,
  onDelete,
  onUpload,
}: Readonly<{
  gallery: Gallery | null;
  subdomain: string | null;
  styles: AppStyles;
  colors: AppColors;
  busy: boolean;
  onPatch: (_id: string, _body: Record<string, unknown>) => void;
  onDelete: (_id: string) => void;
  onUpload: (_id: string, _files: FileList) => void;
}>) {
  // 'idle' | 'copied' | 'failed' — 'failed' needs its own state so the button
  // can tell the user to copy the link manually instead of appearing inert.
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
  const shareUrl = gallery && subdomain
    ? `${window.location.origin}/g/${subdomain}/${gallery.accessToken}`
    : null;
  const shareDisplay = gallery && subdomain
    ? `${window.location.host}/g/${subdomain}/${gallery.accessToken}`
    : 'Gallery link unavailable';

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
        <span>Select a gallery to view</span>
      </div>
    );
  }

  const days = daysUntil(gallery.expiresAt);
  const label = expiryLabel(days);
  const expiryBadgeStyle =
    label.kind === 'expired' ? styles.expiryExpired
      : label.kind === 'warning' ? styles.expiryWarning
        : styles.expiryActive;

  const shootDate = formatMonthDayYear(gallery.shootDate);

  // Extend from the later of "now" and the current expiry, so extending an
  // already-expired gallery gives a fresh 30-day window rather than a date in
  // the past.
  function extend30() {
    if (!gallery) return;
    const base = gallery.expiresAt && new Date(gallery.expiresAt) > new Date()
      ? new Date(gallery.expiresAt)
      : new Date();
    base.setDate(base.getDate() + 30);
    onPatch(gallery.id, { expiresAt: base.toISOString() });
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
            <IconUpload /> {busy ? 'Uploading…' : 'Upload'}
          </button>
          {shareUrl && (
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...styles.actionButton, ...styles.actionButtonPrimary, textDecoration: 'none' }}
            >
              <IconEye /> View gallery
            </a>
          )}
        </div>
      </div>

      <div style={styles.detailBody}>
        <div style={styles.statsGrid}>
          <div style={styles.statBox}>
            <div style={styles.statBoxLabel}>Photos</div>
            <div style={styles.statBoxValue}>{gallery.photoCount}</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statBoxLabel}>Views</div>
            <div style={styles.statBoxValue}>{gallery.viewCount}</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statBoxLabel}>Days left</div>
            <div style={styles.statBoxValue}>{days === null ? '∞' : days < 0 ? '—' : days}</div>
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>Access Information</div>
          <div style={styles.infoGrid}>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Download</span>
              <button
                onClick={() => onPatch(gallery.id, { downloadEnabled: !gallery.downloadEnabled })}
                disabled={busy}
                style={{ ...styles.infoValue, background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', color: gallery.downloadEnabled ? colors.successText : colors.textMuted }}
              >
                {gallery.downloadEnabled ? <><IconCheck /> Enabled</> : <><IconX /> Disabled</>}
              </button>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Watermark</span>
              <button
                onClick={() => onPatch(gallery.id, { watermarkEnabled: !gallery.watermarkEnabled })}
                disabled={busy}
                style={{ ...styles.infoValue, background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', color: gallery.watermarkEnabled ? colors.successText : colors.textMuted }}
              >
                {gallery.watermarkEnabled ? <><IconCheck /> Enabled</> : <><IconX /> Disabled</>}
              </button>
            </div>
            <div style={{ ...styles.infoRow, borderBottom: 'none', paddingBottom: 0 }}>
              <span style={styles.infoLabel}>Expires</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                <span style={styles.infoValue}>
                  {gallery.expiresAt ? formatMonthDayYear(gallery.expiresAt) : 'No expiry'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ ...styles.expiryBadge, ...expiryBadgeStyle }}>{label.text}</span>
                  <button
                    onClick={extend30}
                    disabled={busy}
                    style={{ ...styles.actionButton, ...styles.actionButtonOutline, padding: '3px 9px', fontSize: '0.75rem' }}
                  >
                    +30 days
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>Gallery Link</div>
          <div style={styles.codeBlock}>{shareDisplay}</div>
          <button
            style={{ ...styles.actionButton, ...styles.actionButtonOutline, width: '100%', marginTop: '10px', justifyContent: 'center' }}
            onClick={copyLink}
            disabled={!shareUrl}
          >
            <IconCopy />{' '}
            {copyState === 'copied'
              ? 'Copied!'
              : copyState === 'failed'
                ? 'Press Ctrl/⌘+C'
                : 'Copy Link'}
          </button>
        </div>

        <div style={styles.section}>
          <button
            onClick={() => onDelete(gallery.id)}
            disabled={busy}
            style={{ ...styles.actionButton, ...styles.actionButtonOutline, width: '100%', justifyContent: 'center', color: colors.dangerText, borderColor: colors.dangerText }}
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
  const [bookings, setBookings] = useState<BookingOption[]>([]);
  const [bookingId, setBookingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<BookingOption[]>('/api/photographerBookings?size=100')
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setBookings(list);
        setBookingId(list[0]?.id ?? '');
      })
      .catch(() => setError('Could not load bookings.'))
      .finally(() => setLoading(false));
  }, []);

  async function submit() {
    if (!bookingId) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await api.post<Gallery>('/api/galleries', { bookingId });
      onCreated(data);
    } catch {
      setError('Could not create the gallery. Please try again.');
      setSubmitting(false);
    }
  }

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
  };
  const card: React.CSSProperties = {
    background: colors.surface, borderRadius: 16, padding: 24, width: '100%', maxWidth: 440,
    border: `1px solid ${colors.border}`, color: colors.text,
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 4 }}>New gallery</h2>
        <p style={{ fontSize: '0.85rem', color: colors.textMuted, marginBottom: 18 }}>
          Create a delivery gallery for a booking, then upload the photos.
        </p>

        {loading ? (
          <div style={{ color: colors.textMuted, padding: '20px 0' }}>Loading bookings…</div>
        ) : bookings.length === 0 ? (
          <div style={{ color: colors.textMuted, padding: '12px 0', fontSize: '0.9rem' }}>
            You have no bookings yet — create a booking first, then come back to deliver its gallery.
          </div>
        ) : (
          <>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.textMuted }}>
              Booking
            </label>
            <select
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, fontSize: '0.9rem' }}
            >
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.clientName}{b.eventType ? ` · ${b.eventType}` : ''} · {formatMonthDayYear(b.eventDate)}
                </option>
              ))}
            </select>
          </>
        )}

        {error && <p style={{ color: colors.dangerText, fontSize: '0.82rem', marginTop: 12 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${colors.border}`, background: 'transparent', color: colors.text, fontWeight: 600, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!bookingId || submitting}
            style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: colors.primarySolid, color: '#fff', fontWeight: 600, cursor: !bookingId || submitting ? 'default' : 'pointer', opacity: !bookingId || submitting ? 0.6 : 1 }}
          >
            {submitting ? 'Creating…' : 'Create gallery'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── GalleriesPage ────────────────────────────────────────────────────────────
export default function GalleriesPage() {
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
  const [error, setError] = useState<string | null>(null);
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
      .catch(() => setError('Could not load galleries. Please try again.'))
      .finally(() => setLoading(false));
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
      setError('Could not update the gallery.');
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
      setError('Could not delete the gallery.');
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
          { filename: file.name, contentType: file.type || 'application/octet-stream' },
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
        await api.post(`/api/galleries/photos/${init.photoId}/complete`, { fileSizeBytes: file.size });
      }
      // Re-read so photoCount reflects the new uploads.
      const { data } = await api.get<Gallery[]>('/api/galleries');
      if (Array.isArray(data)) setGalleries(data);
    } catch {
      setError('Some photos could not be uploaded. Please try again.');
    } finally {
      setBusyId(null);
    }
  }, []);

  const filteredGalleries = useMemo(() => {
    let filtered = galleries;
    if (filterStatus === 'Active') filtered = filtered.filter(g => { const d = daysUntil(g.expiresAt); return d === null || d >= 0; });
    else if (filterStatus === 'Expired') filtered = filtered.filter(g => { const d = daysUntil(g.expiresAt); return d !== null && d < 0; });
    const q = searchQuery.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter(g =>
      g.bookingName.toLowerCase().includes(q) || g.eventType.toLowerCase().includes(q),
    );
  }, [galleries, filterStatus, searchQuery]);

  const selectedGallery = useMemo(
    () => galleries.find(g => g.id === selectedGalleryId) ?? galleries[0] ?? null,
    [galleries, selectedGalleryId],
  );

  const stats = useMemo(() => ({
    total: galleries.length,
    active: galleries.filter(g => { const d = daysUntil(g.expiresAt); return d === null || d >= 0; }).length,
    totalPhotos: galleries.reduce((sum, g) => sum + g.photoCount, 0),
  }), [galleries]);

  // Client view: no tenant-wide gallery list for them (and no customer gallery
  // API yet), so present a calm empty state instead of a retry-loop error.
  if (!isPhotographer) {
    return (
      <div style={styles.pageWrapper}>
        <header style={styles.pageHeader}>
          <div>
            <h1 style={styles.pageTitle}>Your Galleries</h1>
            <p style={styles.pageSubtitle}>Your delivered photo galleries will appear here.</p>
          </div>
        </header>
        <div
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', padding: '64px 24px', gap: '14px', color: colors.textMuted,
          }}
        >
          <div style={{ width: 56, height: 56, borderRadius: '14px', background: colors.surfaceAlt, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="15" rx="2" />
              <circle cx="8.5" cy="9.5" r="1.5" />
              <path d="M21 16l-5-5-6 6-3-3-4 4" />
            </svg>
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: colors.text }}>No galleries yet</div>
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
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 16px', marginBottom: 10 }}>
                  <div style={{ height: 13, width: '60%', borderRadius: 6, background: colors.surfaceAlt, animation: 'pulse 1.6s ease-in-out infinite' }} />
                  <div style={{ height: 11, width: '40%', borderRadius: 6, background: colors.surfaceAlt, animation: 'pulse 1.6s ease-in-out infinite' }} />
                </div>
              ))}
            </div>
          </div>
          <div style={styles.detailPanel}>
            <div style={styles.emptyState}>Loading galleries…</div>
          </div>
        </div>
      </div>
    );
  }

  if (error && galleries.length === 0) {
    return (
      <div style={styles.pageWrapper}>
        <div style={styles.errorPanel}>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>Couldn&apos;t load galleries</div>
          <div style={styles.errorText}>{error}</div>
          <button style={styles.retryButton} onClick={loadGalleries}>Try again</button>
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
          <h1 style={styles.pageTitle}>Your Galleries</h1>
          <p style={styles.pageSubtitle}>View, download, and manage your photo galleries.</p>
        </div>
        <div style={styles.headerStats}>
          <div style={styles.headerStatCard}>
            <div style={styles.headerStatLabel}>Galleries</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <div style={styles.headerStatValue}>{stats.total}</div>
              <div style={styles.headerStatChange}>{stats.active} active</div>
            </div>
          </div>
          <div style={styles.headerStatCard}>
            <div style={styles.headerStatLabel}>Total Photos</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <div style={styles.headerStatValue}>{stats.totalPhotos}</div>
              <div style={styles.headerStatChange}>available</div>
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
            <div style={styles.listTitle}>Galleries</div>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search galleries..."
              aria-label="Search galleries"
              style={styles.searchBox}
            />
          </div>

          <div style={styles.filterTabs}>
            {(['All', 'Active', 'Expired'] as const).map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                style={{ ...styles.filterTab, ...(filterStatus === status ? styles.filterTabActive : {}) }}
              >
                {status}
              </button>
            ))}
          </div>

          <div style={styles.listScroll}>
            {filteredGalleries.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: colors.textMuted, fontSize: '0.875rem' }}>
                {galleries.length === 0 ? 'No galleries yet.' : 'No galleries match these filters.'}
              </div>
            ) : (
              filteredGalleries.map(gallery => (
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
            onDelete={deleteGallery}
            onUpload={uploadPhotos}
          />
        </div>
      </div>
    </div>
  );
}
