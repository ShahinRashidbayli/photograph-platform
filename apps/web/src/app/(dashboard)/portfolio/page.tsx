'use client';

import { useMemo, useRef, useState } from 'react';
import { asyncError, asyncErrorText, type AsyncError } from '@/lib/async-error';
import { useThemeStore } from '@/store/themeStore';
import { useTranslation, type TranslationKey } from '@/lib/i18n';
import { StatStrip } from '@/components/StatStrip';
import { getColors, type Theme } from '@/lib/design-tokens';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  UploadError,
  useCreatePortfolioCategory,
  useDeletePortfolioCategory,
  useDeletePortfolioPhoto,
  usePortfolioCategories,
  usePortfolioPhotos,
  useRenamePortfolioCategory,
  useSetPortfolioPhotoCategory,
  useSetPortfolioPhotoPublished,
  useUploadPortfolioPhoto,
  type PortfolioCategory as Category,
  type PortfolioPhoto as Photo,
} from '@/hooks/usePortfolio';

const ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_BYTES = 25 * 1024 * 1024;

type PendingUpload = {
  id: string;
  file: File;
  status: 'queued' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: AsyncError;
};

/** Stable while a query has no data, so the memos below do not recompute every render. */
const NO_PHOTOS: Photo[] = [];
const NO_CATEGORIES: Category[] = [];

/**
 * A photo filed under no category that still exists. Rows can carry a stale id
 * (a category deleted before the backend started clearing the reference), and
 * those belong under "Uncategorised" too — otherwise they match no chip and can
 * only be found under "All", with no way to re-file them.
 */
function isUnfiled(photo: Photo, known: ReadonlySet<string>) {
  return !photo.categoryId || !known.has(photo.categoryId);
}

export default function PortfolioAdminPage() {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const colors = useColors(theme);

  const photosQuery = usePortfolioPhotos();
  // Categories are a secondary surface — a failure here shouldn't blank the
  // whole page, so it degrades to "no categories" silently.
  const categoriesQuery = usePortfolioCategories();
  const photos = photosQuery.data ?? NO_PHOTOS;
  const categories = categoriesQuery.data ?? NO_CATEGORIES;
  const loading = photosQuery.isLoading;

  const createCategory = useCreatePortfolioCategory();
  const renameCategory = useRenamePortfolioCategory();
  const deleteCategory = useDeletePortfolioCategory();
  const setPhotoCategory = useSetPortfolioPhotoCategory();
  const setPublished = useSetPortfolioPhotoPublished();
  const deletePhoto = useDeletePortfolioPhoto();
  const uploadPhoto = useUploadPortfolioPhoto();

  const [activeCategory, setActiveCategory] = useState<string | 'all' | 'none'>('all');
  const [actionError, setActionError] = useState<AsyncError | null>(null);
  // A load failure is the query's own state; dismissing it remembers *which*
  // failure was dismissed, so the next one shows again.
  const [dismissedLoadError, setDismissedLoadError] = useState(0);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadError =
    photosQuery.isError && photosQuery.errorUpdatedAt !== dismissedLoadError
      ? asyncError(photosQuery.error, 'portfolio.photos.loadError')
      : null;
  const error = actionError ?? loadError;

  function dismissError() {
    if (actionError) setActionError(null);
    else setDismissedLoadError(photosQuery.errorUpdatedAt);
  }

  async function removeCategory(id: string) {
    await deleteCategory.mutateAsync(id);
    setActiveCategory((cur) => (cur === id ? 'all' : cur));
  }

  function moveToCategory(photo: Photo, categoryId: string | null) {
    // Without this the rejection went unhandled and the select simply snapped
    // back, which reads as the change not having been made — with no reason.
    setPhotoCategory.mutate(
      { id: photo.id, categoryId },
      { onError: (e) => setActionError(asyncError(e, 'portfolio.photos.categoryError')) }
    );
  }

  const stats = useMemo(() => {
    const total = photos.length;
    const published = photos.filter((p) => p.published).length;
    return { total, published, draft: total - published };
  }, [photos]);

  function updatePending(id: string, change: Partial<PendingUpload>) {
    setPending((prev) => prev.map((p) => (p.id === id ? { ...p, ...change } : p)));
  }

  async function uploadFile(file: File): Promise<void> {
    const id = crypto.randomUUID();
    setPending((prev) => [...prev, { id, file, status: 'queued', progress: 0 }]);

    if (file.size > MAX_BYTES) {
      updatePending(id, { status: 'error', error: { key: 'portfolio.upload.tooLarge' } });
      return;
    }

    try {
      await uploadPhoto.mutateAsync({
        file,
        onProgress: (progress) => updatePending(id, { status: 'uploading', progress }),
      });
      updatePending(id, { status: 'done', progress: 100 });
      // Drop completed entry after a short delay so it stays visible
      // long enough to acknowledge.
      window.setTimeout(() => {
        setPending((prev) => prev.filter((p) => p.id !== id));
      }, 1200);
    } catch (e) {
      updatePending(id, {
        status: 'error',
        error:
          e instanceof UploadError
            ? {
                key:
                  e.code === 'readError'
                    ? 'portfolio.upload.readError'
                    : 'portfolio.upload.networkError',
              }
            : asyncError(e, 'portfolio.upload.failed'),
      });
    }
  }

  function onFiles(list: FileList | null) {
    if (!list) return;
    for (const file of Array.from(list)) {
      uploadFile(file);
    }
  }

  function togglePublish(photo: Photo) {
    setPublished.mutate(
      { id: photo.id, published: !photo.published },
      {
        onError: (e) => {
          const code = (e as { response?: { data?: { code?: string } } })?.response?.data?.code;
          // EMAIL_NOT_VERIFIED is surfaced globally by the axios interceptor toast
          // — no need to alert again here.
          if (code !== 'EMAIL_NOT_VERIFIED') {
            setActionError(asyncError(e, 'portfolio.photos.publishError'));
          }
        },
      }
    );
  }

  const visiblePhotos = useMemo(() => {
    if (activeCategory === 'all') return photos;
    const known = new Set(categories.map((c) => c.id));
    if (activeCategory === 'none') return photos.filter((p) => isUnfiled(p, known));
    return photos.filter((p) => p.categoryId === activeCategory);
  }, [photos, activeCategory, categories]);

  function confirmDelete() {
    if (!photoToDelete) return;
    deletePhoto.mutate(photoToDelete.id, {
      onSuccess: () => setPhotoToDelete(null),
      onError: (e) => {
        setActionError(asyncError(e, 'portfolio.photos.deleteError'));
        setPhotoToDelete(null);
      },
    });
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
      <Header colors={colors} onUploadClick={() => fileInputRef.current?.click()} />

      {/* The figures are coloured rather than iconed: published and draft are
          the same kind of number, and the tint is what separates them. */}
      <div style={{ marginBottom: 24 }}>
        <StatStrip
          aria-label={t('portfolio.title')}
          items={[
            { label: t('portfolio.stat.total'), value: String(stats.total) },
            {
              label: t('portfolio.stat.published'),
              value: String(stats.published),
              valueColor: colors.successText,
            },
            {
              label: t('portfolio.stat.draft'),
              value: String(stats.draft),
              valueColor: colors.warningText,
            },
          ]}
        />
      </div>

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

      {error && (
        <ErrorBanner
          colors={colors}
          message={asyncErrorText(error, t) ?? ''}
          onDismiss={dismissError}
        />
      )}

      {!loading && photos.length > 0 && (
        <CategoryBar
          colors={colors}
          categories={categories}
          photos={photos}
          active={activeCategory}
          onSelect={setActiveCategory}
          onCreate={async (name) => {
            await createCategory.mutateAsync(name);
          }}
          onRename={async (id, name) => {
            await renameCategory.mutateAsync({ id, name });
          }}
          onDelete={removeCategory}
          onError={(key) => setActionError({ key })}
        />
      )}

      {loading ? (
        <Skeleton colors={colors} />
      ) : photos.length === 0 ? (
        <EmptyState colors={colors} onUploadClick={() => fileInputRef.current?.click()} />
      ) : visiblePhotos.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 24px',
            background: colors.cardBg,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            color: colors.subText,
          }}
        >
          {t('portfolio.empty.inCategory')}
        </div>
      ) : (
        <Grid
          colors={colors}
          photos={visiblePhotos}
          categories={categories}
          onPublish={togglePublish}
          onDelete={setPhotoToDelete}
          onSetCategory={moveToCategory}
        />
      )}

      <ConfirmDialog
        open={photoToDelete !== null}
        theme={theme}
        tone="danger"
        title={t('portfolio.photos.deleteConfirmTitle')}
        message="This permanently removes the photo from your portfolio. This cannot be undone."
        confirmLabel="Delete photo"
        busy={deletePhoto.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setPhotoToDelete(null)}
      />
    </div>
  );
}

// ─── components ────────────────────────────────────────────────────────────

function Header({ colors, onUploadClick }: { colors: ColorTokens; onUploadClick: () => void }) {
  const { t } = useTranslation();
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
        <h1
          style={{
            margin: 0,
            fontSize: '1.875rem',
            fontWeight: 800,
            letterSpacing: '-0.025em',
            color: colors.text,
          }}
        >
          {t('portfolio.title')}
        </h1>
        <p
          style={{
            margin: '6px 0 0',
            color: colors.subText,
            fontSize: '0.9rem',
            lineHeight: 1.5,
            maxWidth: 640,
          }}
        >
          {t('portfolio.subtitle')}
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
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        Upload photos
      </button>
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
  const { t } = useTranslation();
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
        {t('portfolio.upload.dropHint')}{' '}
        <strong style={{ color: colors.text }}>{t('portfolio.upload.button')}</strong>{' '}
        {t('portfolio.upload.dropHintTail')}
      </span>
    </div>
  );
}

function UploadQueue({ colors, items }: { colors: ColorTokens; items: PendingUpload[] }) {
  const { t } = useTranslation();
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
      <div
        style={{
          fontSize: 12,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: colors.subText,
          marginBottom: 12,
        }}
      >
        {t('portfolio.upload.inProgress', { count: items.length })}
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((it) => {
          let barColor = colors.primary;
          if (it.status === 'error') barColor = colors.danger;
          else if (it.status === 'done') barColor = colors.success;

          let statusText: string | undefined = `${Math.round(it.progress)}%`;
          if (it.status === 'error') statusText = asyncErrorText(it.error, t) ?? undefined;
          else if (it.status === 'done') statusText = t('portfolio.upload.done');

          return (
            <div
              key={it.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    color: colors.text,
                    marginBottom: 4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {it.file.name}
                </div>
                <div
                  style={{
                    height: 4,
                    borderRadius: 999,
                    background: colors.border,
                    overflow: 'hidden',
                  }}
                >
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
              <div
                style={{
                  fontSize: 12,
                  color: it.status === 'error' ? colors.dangerText : colors.subText,
                  textAlign: 'right',
                  minWidth: 80,
                }}
              >
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
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 16,
      }}
    >
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
  const { t } = useTranslation();
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
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.subText,
              fontSize: 12,
            }}
          >
            {t('portfolio.photos.thumbnailPending')}
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
          aria-label={t('portfolio.category.label')}
          title={t('portfolio.category.assign')}
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
          <option value="">{t('portfolio.category.none')}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => onPublish(photo)}
            title={
              photo.published
                ? t('portfolio.photos.unpublishHint')
                : t('portfolio.photos.publishHint')
            }
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
            {photo.published ? t('portfolio.photos.unpublish') : t('portfolio.photos.publish')}
          </button>
          <button
            onClick={() => onDelete(photo)}
            aria-label={t('portfolio.photos.deleteLabel')}
            title={t('portfolio.photos.deleteLabel')}
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
  /** Takes a key rather than a sentence, so the message follows a language switch. */
  onError: (_key: TranslationKey) => void;
}) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  // The same test the grid filters with — when this counted only an empty
  // categoryId, photos with a stale one left the chip at 0 and hidden, so the
  // filter that exists to surface them could never be reached.
  const known = new Set(categories.map((c) => c.id));
  const countFor = (id: string | 'all' | 'none') =>
    id === 'all'
      ? photos.length
      : id === 'none'
        ? photos.filter((p) => isUnfiled(p, known)).length
        : photos.filter((p) => p.categoryId === id).length;

  async function submitNew() {
    const name = draft.trim();
    if (!name) {
      setAdding(false);
      return;
    }
    try {
      await onCreate(name);
      setDraft('');
      setAdding(false);
    } catch {
      onError('portfolio.category.createError');
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
    <div
      style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 18 }}
    >
      {chip('All', 'all', countFor('all'))}
      {categories.map((cat) => (
        <CategoryChip
          key={cat.id}
          colors={colors}
          category={cat}
          active={active === cat.id}
          count={countFor(cat.id)}
          onSelect={() => onSelect(cat.id)}
          onRename={(name) =>
            onRename(cat.id, name).catch(() => onError('portfolio.category.renameError'))
          }
          onDelete={() => onDelete(cat.id).catch(() => onError('portfolio.category.deleteError'))}
        />
      ))}
      {countFor('none') > 0 && chip(t('portfolio.category.none'), 'none', countFor('none'))}

      {adding ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={submitNew}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitNew();
            if (e.key === 'Escape') {
              setDraft('');
              setAdding(false);
            }
          }}
          placeholder={t('portfolio.category.namePlaceholder')}
          style={{
            padding: '6px 12px',
            borderRadius: 999,
            border: `1px solid ${colors.border}`,
            background: colors.bg,
            color: colors.text,
            fontSize: 12.5,
            width: 150,
          }}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={{
            padding: '6px 12px',
            borderRadius: 999,
            border: `1px dashed ${colors.border}`,
            background: 'transparent',
            color: colors.subText,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
          }}
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
  const { t } = useTranslation();
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
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setName(category.name);
            setEditing(false);
          }
        }}
        style={{
          padding: '6px 12px',
          borderRadius: 999,
          border: `1px solid ${colors.border}`,
          background: colors.bg,
          color: colors.text,
          fontSize: 12.5,
          width: 150,
        }}
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
        title={t('portfolio.category.filterHint')}
        style={{
          background: 'none',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          fontSize: 12.5,
          fontWeight: 600,
          padding: 0,
        }}
      >
        {category.name} <span style={{ opacity: 0.6 }}>{count}</span>
      </button>
      <button
        onClick={() => {
          if (
            window.confirm(`Delete category “${category.name}”? Photos in it become uncategorised.`)
          )
            onDelete();
        }}
        aria-label={`Delete ${category.name}`}
        title={t('portfolio.category.deleteLabel')}
        style={{
          background: 'none',
          border: 'none',
          color: 'inherit',
          opacity: 0.6,
          cursor: 'pointer',
          fontSize: 14,
          lineHeight: 1,
          padding: 0,
        }}
      >
        ×
      </button>
    </span>
  );
}

function EmptyState({ colors, onUploadClick }: { colors: ColorTokens; onUploadClick: () => void }) {
  const { t } = useTranslation();
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: 12,
          color: colors.subText,
        }}
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
      </div>
      <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: colors.text }}>
        {t('portfolio.empty.title')}
      </h3>
      <p style={{ margin: '0 0 20px', fontSize: 14 }}>{t('portfolio.empty.body')}</p>
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
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 16,
      }}
    >
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
  const { t } = useTranslation();
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
        style={{
          border: 'none',
          background: 'transparent',
          color: colors.dangerText,
          cursor: 'pointer',
          fontSize: 16,
          padding: 4,
        }}
        aria-label={t('portfolio.dismiss')}
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
