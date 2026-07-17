'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '@/lib/api';
import { useThemeStore } from '@/store/themeStore';
import { getColors, type Theme } from '@/lib/design-tokens';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface Photo {
  id: string;
  categoryId: string | null;
  viewUrl: string | null;
  thumbnailUrl: string | null;
  fileSizeBytes: number | null;
  width: number | null;
  height: number | null;
  sortOrder: number;
  published: boolean;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
}

interface InitiateUploadResponse {
  photoId: string;
  r2Key: string;
  uploadUrl: string;
}

const ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_BYTES = 25 * 1024 * 1024;

type PendingUpload = {
  id: string;
  file: File;
  status: 'queued' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
};

export default function PortfolioAdminPage() {
  const { theme } = useThemeStore();
  const colors = useColors(theme);

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | 'all' | 'none'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get<Photo[]>('/api/portfolio/photos');
      setPhotos(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load photos');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const { data } = await api.get<Category[]>('/api/portfolio/categories');
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      // Categories are a secondary surface — a failure here shouldn't blank the
      // whole page, so it degrades to "no categories" silently.
    }
  }, []);

  useEffect(() => {
    refresh();
    loadCategories();
  }, [refresh, loadCategories]);

  async function createCategory(name: string) {
    const { data } = await api.post<Category>('/api/portfolio/categories', { name });
    setCategories((prev) => [...prev, data]);
  }

  async function renameCategory(id: string, name: string) {
    const { data } = await api.patch<Category>(`/api/portfolio/categories/${id}`, { name });
    setCategories((prev) => prev.map((c) => (c.id === id ? data : c)));
  }

  async function deleteCategory(id: string) {
    await api.delete(`/api/portfolio/categories/${id}`);
    setCategories((prev) => prev.filter((c) => c.id !== id));
    // Photos keep their now-dangling categoryId server-side until reassigned;
    // reflect the removal locally so the filter and chips stay consistent.
    setPhotos((prev) => prev.map((p) => (p.categoryId === id ? { ...p, categoryId: null } : p)));
    setActiveCategory((cur) => (cur === id ? 'all' : cur));
  }

  async function setPhotoCategory(photo: Photo, categoryId: string | null) {
    const { data } = await api.patch<Photo>(`/api/portfolio/photos/${photo.id}/category`, { categoryId });
    setPhotos((prev) => prev.map((p) => (p.id === photo.id ? data : p)));
  }

  const stats = useMemo(() => {
    const total = photos.length;
    const published = photos.filter((p) => p.published).length;
    return { total, published, draft: total - published };
  }, [photos]);

  async function uploadFile(file: File): Promise<void> {
    const id = crypto.randomUUID();
    setPending((prev) => [...prev, { id, file, status: 'queued', progress: 0 }]);

    if (file.size > MAX_BYTES) {
      setPending((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, status: 'error', error: 'File exceeds 25 MB' } : p
        )
      );
      return;
    }

    try {
      // Read intrinsic dimensions client-side so the BE can persist them
      // immediately; the thumbnail job will re-extract authoritatively.
      const dims = await readImageDimensions(file).catch(() => null);

      // Step 1 — initiate
      setPending((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: 'uploading', progress: 5 } : p))
      );
      const { data: init } = await api.post<InitiateUploadResponse>(
        '/api/portfolio/photos/initiate-upload',
        { filename: file.name, contentType: file.type }
      );

      // Step 2 — direct PUT to R2
      await fetchPutWithProgress(init.uploadUrl, file, (pct) => {
        setPending((prev) =>
          prev.map((p) => (p.id === id ? { ...p, progress: 5 + pct * 0.9 } : p))
        );
      });

      // Step 3 — complete
      await api.post(`/api/portfolio/photos/${init.photoId}/complete`, {
        fileSizeBytes: file.size,
        width: dims?.width ?? null,
        height: dims?.height ?? null,
      });

      setPending((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: 'done', progress: 100 } : p))
      );
      // Drop completed entry after a short delay so it stays visible
      // long enough to acknowledge.
      window.setTimeout(() => {
        setPending((prev) => prev.filter((p) => p.id !== id));
      }, 1200);
      refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Upload failed';
      setPending((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: 'error', error: message } : p))
      );
    }
  }

  async function onFiles(list: FileList | null) {
    if (!list) return;
    for (const file of Array.from(list)) {
      uploadFile(file);
    }
  }

  async function togglePublish(photo: Photo) {
    const action = photo.published ? 'unpublish' : 'publish';
    try {
      const { data } = await api.post<Photo>(`/api/portfolio/photos/${photo.id}/${action}`);
      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? data : p)));
    } catch (e) {
      const code = (e as { response?: { data?: { code?: string } } })?.response?.data?.code;
      // EMAIL_NOT_VERIFIED is surfaced globally by the axios interceptor toast
      // — no need to alert again here.
      if (code !== 'EMAIL_NOT_VERIFIED') {
        setError(e instanceof Error ? e.message : `${action} failed`);
      }
    }
  }

  const visiblePhotos = useMemo(() => {
    if (activeCategory === 'all') return photos;
    if (activeCategory === 'none') return photos.filter((p) => !p.categoryId);
    return photos.filter((p) => p.categoryId === activeCategory);
  }, [photos, activeCategory]);

  async function confirmDelete() {
    if (!photoToDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/api/portfolio/photos/${photoToDelete.id}`);
      setPhotoToDelete(null);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
      setPhotoToDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100%',
        background: colors.bg,
        color: colors.text,
        padding: '28px 28px 40px',
        maxWidth: '1400px',
        width: '100%',
        margin: '0 auto',
        fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        transition: 'background 0.2s ease, color 0.2s ease',
      }}
    >
      <Header
        colors={colors}
        onUploadClick={() => fileInputRef.current?.click()}
      />

      <StatRow colors={colors} stats={stats} />

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          onFiles(e.target.files);
          // Reset so re-selecting the same file still triggers onChange.
          e.target.value = '';
        }}
      />

      <DropZone colors={colors} onFiles={onFiles} />

      {pending.length > 0 && <UploadQueue colors={colors} items={pending} />}

      {error && <ErrorBanner colors={colors} message={error} onDismiss={() => setError(null)} />}

      {!loading && photos.length > 0 && (
        <CategoryBar
          colors={colors}
          categories={categories}
          photos={photos}
          active={activeCategory}
          onSelect={setActiveCategory}
          onCreate={createCategory}
          onRename={renameCategory}
          onDelete={deleteCategory}
          onError={(m) => setError(m)}
        />
      )}

      {loading ? (
        <Skeleton colors={colors} />
      ) : photos.length === 0 ? (
        <EmptyState colors={colors} onUploadClick={() => fileInputRef.current?.click()} />
      ) : visiblePhotos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 12, color: colors.subText }}>
          No photos in this category yet.
        </div>
      ) : (
        <Grid
          colors={colors}
          photos={visiblePhotos}
          categories={categories}
          onPublish={togglePublish}
          onDelete={setPhotoToDelete}
          onSetCategory={setPhotoCategory}
        />
      )}

      <ConfirmDialog
        open={photoToDelete !== null}
        theme={theme}
        tone="danger"
        title="Delete this photo?"
        message="This permanently removes the photo from your portfolio. This cannot be undone."
        confirmLabel="Delete photo"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPhotoToDelete(null)}
      />
    </div>
  );
}

// ─── components ────────────────────────────────────────────────────────────

function Header({
  colors,
  onUploadClick,
}: {
  colors: ColorTokens;
  onUploadClick: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 24,
        marginBottom: 20,
      }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: '1.875rem', fontWeight: 800, letterSpacing: '-0.025em', color: colors.text }}>Portfolio</h1>
        <p style={{ margin: '6px 0 0', color: colors.subText, fontSize: '0.9rem', lineHeight: 1.5, maxWidth: 640 }}>
          Upload, publish, and curate the photos visitors see on your public page.
        </p>
      </div>
      <button
        onClick={onUploadClick}
        style={{
          padding: '9px 16px',
          background: colors.invertedBg,
          color: colors.invertedText,
          border: '1px solid transparent',
          borderRadius: 10,
          fontWeight: 600,
          fontSize: '0.875rem',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          whiteSpace: 'nowrap',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Upload photos
      </button>
    </div>
  );
}

function StatRow({
  colors,
  stats,
}: {
  colors: ColorTokens;
  stats: { total: number; published: number; draft: number };
}) {
  const card = (label: string, value: number, accent: string) => (
    <div
      style={{
        padding: '14px 16px',
        background: colors.cardBg,
        borderRadius: 14,
        border: `1px solid ${colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.subText }}>
        {label}
      </span>
      <span style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', color: accent }}>
        {value}
      </span>
    </div>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginBottom: 24 }}>
      {card('Total photos', stats.total, colors.text)}
      {card('Published', stats.published, colors.successText)}
      {card('Draft', stats.draft, colors.warningText)}
    </div>
  );
}

function DropZone({
  colors,
  onFiles,
}: {
  colors: ColorTokens;
  onFiles: (_list: FileList | null) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFiles(e.dataTransfer.files);
      }}
      style={{
        border: `2px dashed ${over ? colors.text : colors.border}`,
        borderRadius: 12,
        padding: '24px',
        textAlign: 'center',
        color: colors.subText,
        marginBottom: 24,
        background: over ? colors.cardBg : 'transparent',
        transition: 'background 0.15s ease, border-color 0.15s ease',
      }}
    >
      <span style={{ fontSize: 14 }}>
        Drop JPG, PNG, or WebP here — or use <strong style={{ color: colors.text }}>Upload photos</strong> above.
        Max 25 MB per file.
      </span>
    </div>
  );
}

function UploadQueue({ colors, items }: { colors: ColorTokens; items: PendingUpload[] }) {
  return (
    <div
      style={{
        background: colors.cardBg,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
      }}
    >
      <div style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.subText, marginBottom: 12 }}>
        Uploading {items.length}
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((it) => {
          let barColor = colors.primary;
          if (it.status === 'error') barColor = colors.danger;
          else if (it.status === 'done') barColor = colors.success;

          let statusText: string | undefined = `${Math.round(it.progress)}%`;
          if (it.status === 'error') statusText = it.error;
          else if (it.status === 'done') statusText = 'Done ✓';

          return (
            <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: colors.text, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {it.file.name}
                </div>
                <div style={{ height: 4, borderRadius: 999, background: colors.border, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${it.progress}%`,
                      background: barColor,
                      transition: 'width 0.2s ease',
                    }}
                  />
                </div>
              </div>
              <div style={{ fontSize: 12, color: it.status === 'error' ? colors.dangerText : colors.subText, textAlign: 'right', minWidth: 80 }}>
                {statusText}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Grid({
  colors,
  photos,
  categories,
  onPublish,
  onDelete,
  onSetCategory,
}: {
  colors: ColorTokens;
  photos: Photo[];
  categories: Category[];
  onPublish: (_photo: Photo) => void;
  onDelete: (_photo: Photo) => void;
  onSetCategory: (_photo: Photo, _categoryId: string | null) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
      {photos.map((photo) => (
        <Card
          key={photo.id}
          colors={colors}
          photo={photo}
          categories={categories}
          onPublish={onPublish}
          onDelete={onDelete}
          onSetCategory={onSetCategory}
        />
      ))}
    </div>
  );
}

function Card({
  colors,
  photo,
  categories,
  onPublish,
  onDelete,
  onSetCategory,
}: {
  colors: ColorTokens;
  photo: Photo;
  categories: Category[];
  onPublish: (_photo: Photo) => void;
  onDelete: (_photo: Photo) => void;
  onSetCategory: (_photo: Photo, _categoryId: string | null) => void;
}) {
  const src = photo.thumbnailUrl ?? photo.viewUrl ?? '';
  const aspect = photo.width && photo.height ? photo.width / photo.height : 4 / 3;
  return (
    <div
      style={{
        background: colors.cardBg,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ aspectRatio: `${aspect}`, background: colors.bg, position: 'relative' }}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.subText, fontSize: 12 }}>
            Thumbnail pending…
          </div>
        )}
        <span
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            padding: '3px 8px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.04em',
            background: photo.published ? colors.successBg : colors.warningBg,
            color: photo.published ? colors.successText : colors.warningText,
            border: `1px solid ${photo.published ? colors.success : colors.warning}33`,
          }}
        >
          {photo.published ? 'PUBLISHED' : 'DRAFT'}
        </span>
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <select
          value={photo.categoryId ?? ''}
          onChange={(e) => onSetCategory(photo, e.target.value || null)}
          aria-label="Photo category"
          title="Assign a category"
          style={{
            width: '100%',
            padding: '7px 8px',
            border: `1px solid ${colors.border}`,
            background: colors.bg,
            color: colors.text,
            borderRadius: 8,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          <option value="">Uncategorised</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => onPublish(photo)}
            title={photo.published ? 'Return this photo to draft' : 'Publish this photo to your public page'}
            style={{
              flex: 1,
              padding: '8px 10px',
              border: '1px solid transparent',
              background: photo.published ? 'transparent' : colors.invertedBg,
              color: photo.published ? colors.text : colors.invertedText,
              borderColor: photo.published ? colors.border : 'transparent',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            {photo.published ? 'Unpublish' : 'Publish'}
          </button>
          <button
            onClick={() => onDelete(photo)}
            aria-label="Delete photo"
            title="Delete photo"
            style={{
              padding: '8px 10px',
              border: `1px solid ${colors.border}`,
              background: 'transparent',
              color: colors.dangerText,
              borderRadius: 8,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CategoryBar ─────────────────────────────────────────────────────────────
function CategoryBar({
  colors,
  categories,
  photos,
  active,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onError,
}: {
  colors: ColorTokens;
  categories: Category[];
  photos: Photo[];
  active: string | 'all' | 'none';
  onSelect: (_id: string | 'all' | 'none') => void;
  onCreate: (_name: string) => Promise<void>;
  onRename: (_id: string, _name: string) => Promise<void>;
  onDelete: (_id: string) => Promise<void>;
  onError: (_message: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const countFor = (id: string | 'all' | 'none') =>
    id === 'all' ? photos.length
      : id === 'none' ? photos.filter((p) => !p.categoryId).length
        : photos.filter((p) => p.categoryId === id).length;

  async function submitNew() {
    const name = draft.trim();
    if (!name) { setAdding(false); return; }
    try {
      await onCreate(name);
      setDraft('');
      setAdding(false);
    } catch {
      onError('Could not create the category.');
    }
  }

  const chip = (label: string, id: string | 'all' | 'none', count: number): React.ReactNode => (
    <button
      key={id}
      onClick={() => onSelect(id)}
      style={{
        padding: '6px 12px',
        borderRadius: 999,
        border: `1px solid ${active === id ? colors.invertedBg : colors.border}`,
        background: active === id ? colors.invertedBg : 'transparent',
        color: active === id ? colors.invertedText : colors.text,
        fontSize: 12.5,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label} <span style={{ opacity: 0.6 }}>{count}</span>
    </button>
  );

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 18 }}>
      {chip('All', 'all', countFor('all'))}
      {categories.map((cat) => (
        <CategoryChip
          key={cat.id}
          colors={colors}
          category={cat}
          active={active === cat.id}
          count={countFor(cat.id)}
          onSelect={() => onSelect(cat.id)}
          onRename={(name) => onRename(cat.id, name).catch(() => onError('Could not rename the category.'))}
          onDelete={() => onDelete(cat.id).catch(() => onError('Could not delete the category.'))}
        />
      ))}
      {countFor('none') > 0 && chip('Uncategorised', 'none', countFor('none'))}

      {adding ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={submitNew}
          onKeyDown={(e) => { if (e.key === 'Enter') submitNew(); if (e.key === 'Escape') { setDraft(''); setAdding(false); } }}
          placeholder="Category name"
          style={{ padding: '6px 12px', borderRadius: 999, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.text, fontSize: 12.5, width: 150 }}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={{ padding: '6px 12px', borderRadius: 999, border: `1px dashed ${colors.border}`, background: 'transparent', color: colors.subText, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
        >
          + Category
        </button>
      )}
    </div>
  );
}

function CategoryChip({
  colors,
  category,
  active,
  count,
  onSelect,
  onRename,
  onDelete,
}: {
  colors: ColorTokens;
  category: Category;
  active: boolean;
  count: number;
  onSelect: () => void;
  onRename: (_name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);

  function commit() {
    const next = name.trim();
    if (next && next !== category.name) onRename(next);
    else setName(category.name);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setName(category.name); setEditing(false); } }}
        style={{ padding: '6px 12px', borderRadius: 999, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.text, fontSize: 12.5, width: 150 }}
      />
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px 6px 12px',
        borderRadius: 999,
        border: `1px solid ${active ? colors.invertedBg : colors.border}`,
        background: active ? colors.invertedBg : 'transparent',
        color: active ? colors.invertedText : colors.text,
      }}
    >
      <button
        onClick={onSelect}
        onDoubleClick={() => setEditing(true)}
        title="Click to filter · double-click to rename"
        style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, padding: 0 }}
      >
        {category.name} <span style={{ opacity: 0.6 }}>{count}</span>
      </button>
      <button
        onClick={() => { if (window.confirm(`Delete category “${category.name}”? Photos in it become uncategorised.`)) onDelete(); }}
        aria-label={`Delete ${category.name}`}
        title="Delete category"
        style={{ background: 'none', border: 'none', color: 'inherit', opacity: 0.6, cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}
      >
        ×
      </button>
    </span>
  );
}

function EmptyState({ colors, onUploadClick }: { colors: ColorTokens; onUploadClick: () => void }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '80px 24px',
        background: colors.cardBg,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        color: colors.subText,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: colors.subText }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
      </div>
      <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: colors.text }}>
        No photos yet
      </h3>
      <p style={{ margin: '0 0 20px', fontSize: 14 }}>
        Upload your first photographs — they will appear here as drafts until you publish them.
      </p>
      <button
        onClick={onUploadClick}
        style={{
          padding: '9px 16px',
          background: colors.invertedBg,
          color: colors.invertedText,
          border: '1px solid transparent',
          borderRadius: 10,
          fontWeight: 600,
          fontSize: '0.875rem',
          cursor: 'pointer',
        }}
      >
        Upload photos
      </button>
    </div>
  );
}

function Skeleton({ colors }: { colors: ColorTokens }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          style={{
            aspectRatio: '4 / 3',
            background: colors.cardBg,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
          }}
        />
      ))}
    </div>
  );
}

function ErrorBanner({
  colors,
  message,
  onDismiss,
}: {
  colors: ColorTokens;
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      style={{
        padding: '12px 16px',
        background: colors.dangerBg,
        border: `1px solid ${colors.danger}`,
        color: colors.dangerText,
        borderRadius: 10,
        marginBottom: 24,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        fontSize: 14,
      }}
    >
      <span>{message}</span>
      <button
        onClick={onDismiss}
        style={{ border: 'none', background: 'transparent', color: colors.dangerText, cursor: 'pointer', fontSize: 16, padding: 4 }}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

// ─── helpers ───────────────────────────────────────────────────────────────

interface ColorTokens {
  bg: string;
  cardBg: string;
  surfaceAlt: string;
  text: string;
  subText: string;
  border: string;
  primary: string;
  primaryBg: string;
  primaryStrong: string;
  success: string;
  successBg: string;
  successText: string;
  warning: string;
  warningBg: string;
  warningText: string;
  danger: string;
  dangerBg: string;
  dangerText: string;
  invertedBg: string;
  invertedText: string;
}

/**
 * Derives the page's colour tokens from the shared `getColors` source of
 * truth, so portfolio stays in sync with the rest of the dashboard.
 */
function useColors(theme: Theme): ColorTokens {
  const c = getColors(theme);
  return {
    bg: c.bg,
    cardBg: c.surface,
    surfaceAlt: c.surfaceAlt,
    text: c.text,
    subText: c.textMuted,
    border: c.border,
    primary: c.primary,
    primaryBg: c.primaryBg,
    primaryStrong: c.primaryStrong,
    success: c.success,
    successBg: c.successBg,
    successText: c.successText,
    warning: c.warning,
    warningBg: c.warningBg,
    warningText: c.warningText,
    danger: c.danger,
    dangerBg: c.dangerBg,
    dangerText: c.dangerText,
    invertedBg: c.primarySolid,
    invertedText: '#FFFFFF',
  };
}

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };
    img.src = url;
  });
}

/**
 * PUT to the presigned R2 URL with a progress callback. Browsers don't expose
 * upload progress on `fetch`, so we fall back to XHR for that signal — the
 * presigned URL accepts either.
 */
function fetchPutWithProgress(
  url: string,
  file: File,
  onProgress: (_pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress((e.loaded / e.total) * 100);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(file);
  });
}
