import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

/** Mirrors `PortfolioPhotoResponse` on the API. */
export interface PortfolioPhoto {
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

/** Mirrors `PortfolioCategoryResponse` on the API. */
export interface PortfolioCategory {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
}

interface InitiateUploadResponse {
  photoId: string;
  r2Key: string;
  uploadUrl: string;
  /**
   * The type the URL was signed with — not necessarily the one we asked for,
   * since the API canonicalises it. Content-Type is a signed header on the
   * presigned PUT, so sending anything else fails the signature check.
   */
  contentType: string;
}

/**
 * The photographer's portfolio: photos, and the categories they are filed in.
 *
 * <p>Two cache entries that are not independent: deleting a category leaves
 * its photos pointing at nothing, so that mutation writes to both. Every other
 * mutation touches only the entry it changed.
 */

export function portfolioPhotosKey() {
  return ['portfolio', 'photos'] as const;
}

export function portfolioCategoriesKey() {
  return ['portfolio', 'categories'] as const;
}

export function usePortfolioPhotos() {
  return useQuery({
    queryKey: portfolioPhotosKey(),
    queryFn: async () => {
      const res = await api.get<PortfolioPhoto[]>('/api/portfolio/photos');
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

export function usePortfolioCategories() {
  return useQuery({
    queryKey: portfolioCategoriesKey(),
    queryFn: async () => {
      const res = await api.get<PortfolioCategory[]>('/api/portfolio/categories');
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

/** Writes one photo back into the cached list, keeping its position. */
function replacePhoto(list: PortfolioPhoto[] | undefined, updated: PortfolioPhoto) {
  return list?.map((p) => (p.id === updated.id ? updated : p));
}

export function useCreatePortfolioCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) =>
      (await api.post<PortfolioCategory>('/api/portfolio/categories', { name })).data,
    onSuccess: (created) =>
      qc.setQueryData<PortfolioCategory[]>(portfolioCategoriesKey(), (list) => [
        ...(list ?? []),
        created,
      ]),
  });
}

export function useRenamePortfolioCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name: string }) =>
      (
        await api.patch<PortfolioCategory>(`/api/portfolio/categories/${input.id}`, {
          name: input.name,
        })
      ).data,
    onSuccess: (renamed) =>
      qc.setQueryData<PortfolioCategory[]>(portfolioCategoriesKey(), (list) =>
        list?.map((c) => (c.id === renamed.id ? renamed : c))
      ),
  });
}

export function useDeletePortfolioCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/portfolio/categories/${id}`);
    },
    onSuccess: (_void, id) => {
      qc.setQueryData<PortfolioCategory[]>(portfolioCategoriesKey(), (list) =>
        list?.filter((c) => c.id !== id)
      );
      // Photos keep their now-dangling categoryId server-side until reassigned;
      // reflect the removal locally so the filter and chips stay consistent.
      qc.setQueryData<PortfolioPhoto[]>(portfolioPhotosKey(), (list) =>
        list?.map((p) => (p.categoryId === id ? { ...p, categoryId: null } : p))
      );
    },
  });
}

export function useSetPortfolioPhotoCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; categoryId: string | null }) =>
      (
        await api.patch<PortfolioPhoto>(`/api/portfolio/photos/${input.id}/category`, {
          categoryId: input.categoryId,
        })
      ).data,
    onSuccess: (updated) =>
      qc.setQueryData<PortfolioPhoto[]>(portfolioPhotosKey(), (list) =>
        replacePhoto(list, updated)
      ),
  });
}

/** Publishing is what puts a photo on the public page; unpublishing takes it off. */
export function useSetPortfolioPhotoPublished() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; published: boolean }) =>
      (
        await api.post<PortfolioPhoto>(
          `/api/portfolio/photos/${input.id}/${input.published ? 'publish' : 'unpublish'}`
        )
      ).data,
    onSuccess: (updated) =>
      qc.setQueryData<PortfolioPhoto[]>(portfolioPhotosKey(), (list) =>
        replacePhoto(list, updated)
      ),
  });
}

export function useDeletePortfolioPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/portfolio/photos/${id}`);
    },
    onSuccess: (_void, id) =>
      qc.setQueryData<PortfolioPhoto[]>(portfolioPhotosKey(), (list) =>
        list?.filter((p) => p.id !== id)
      ),
  });
}

/**
 * One file: initiate, PUT straight to storage, complete.
 *
 * <p>Each file is its own call, so several run side by side and each reports
 * its own progress — the mutation's shared state is therefore not meaningful
 * here; callers use `mutateAsync` per file and track the queue themselves.
 */
export function useUploadPortfolioPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { file: File; onProgress: (_pct: number) => void }) => {
      const { file, onProgress } = input;
      // Read intrinsic dimensions client-side so the BE can persist them
      // immediately; the thumbnail job will re-extract authoritatively.
      const dims = await readImageDimensions(file).catch(() => null);
      onProgress(5);

      const { data: init } = await api.post<InitiateUploadResponse>(
        '/api/portfolio/photos/initiate-upload',
        // The size is required: the API signs it into the URL as Content-Length,
        // which is what bounds the upload. It is also the size recorded against
        // the photo, so it is no longer sent again at complete-time.
        { filename: file.name, contentType: file.type, fileSizeBytes: file.size }
      );

      await fetchPutWithProgress(init.uploadUrl, file, init.contentType, (pct) =>
        onProgress(5 + pct * 0.9)
      );

      await api.post(`/api/portfolio/photos/${init.photoId}/complete`, {
        width: dims?.width ?? null,
        height: dims?.height ?? null,
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: portfolioPhotosKey() }),
  });
}

/**
 * An upload failure with a translatable cause.
 *
 * <p>The helpers below are plain functions outside the component tree, so they
 * cannot reach the translation hook. Carrying a code instead lets the component
 * that *can* translate do so, rather than showing a German-speaking
 * photographer an English sentence from a utility function.
 */
export class UploadError extends Error {
  constructor(readonly code: 'readError' | 'networkError') {
    super(code);
    this.name = 'UploadError';
  }
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
      reject(new UploadError('readError'));
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
  contentType: string,
  onProgress: (_pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    // The type the API signed, not `file.type` — see InitiateUploadResponse.
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress((e.loaded / e.total) * 100);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new UploadError('networkError'));
    xhr.send(file);
  });
}
