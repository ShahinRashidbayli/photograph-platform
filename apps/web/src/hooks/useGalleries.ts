import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

/** Mirrors `GalleryResponse` on the API. */
export interface Gallery {
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

export interface DeliveryPhoto {
  id: string;
  viewUrl: string | null;
  thumbnailUrl: string | null;
  originalFilename: string | null;
  fileSizeBytes: number | null;
  width: number | null;
  height: number | null;
  sortOrder: number;
}

/**
 * Mirrors `CustomerGalleryResponse` on the API: a gallery as its client sees it
 * in the portal — no view count, no retention bookkeeping.
 */
export interface CustomerGallery {
  id: string;
  bookingId: string;
  eventType: string | null;
  shootDate: string | null;
  photoCount: number;
  downloadEnabled: boolean;
  expiresAt: string | null;
  accessToken: string;
  /** Watermarked when the gallery is; null without storage or before processing. */
  coverUrl: string | null;
}

/** What the create-gallery picker needs from a booking — not the full `Booking`. */
export interface GalleryBookingOption {
  id: string;
  clientName: string;
  eventType: string | null;
  eventDate: string;
}

interface InitiateUploadResponse {
  photoId: string;
  r2Key: string;
  uploadUrl: string;
  /**
   * The type the URL was signed with — not necessarily the one we asked for,
   * since the API canonicalises it and resolves an unknown type from the
   * filename. Content-Type is a signed header on the presigned PUT, so sending
   * anything else fails the signature check.
   */
  contentType: string;
}

/**
 * Delivery galleries. The photographer manages them through `/api/galleries`;
 * a client lists their own through `/api/customer/galleries` and opens one by
 * its share link (`/g/{subdomain}/{token}`), like everyone the link reaches.
 *
 * <p>The list and each gallery's photos are separate cache entries on purpose.
 * The list carries `photoCount`, so anything that adds or removes a photo has
 * to refresh both — which is what the mutations below do, instead of each
 * screen remembering to reload the list itself.
 */

export function galleriesKey() {
  return ['galleries'] as const;
}

export function galleryPhotosKey(galleryId: string) {
  return ['galleries', galleryId, 'photos'] as const;
}

export function galleryBookingOptionsKey() {
  return ['bookings', 'gallery-options'] as const;
}

export function useGalleries(enabled = true) {
  return useQuery({
    queryKey: galleriesKey(),
    enabled,
    queryFn: async () => {
      const res = await api.get<Gallery[]>('/api/galleries');
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

export function customerGalleriesKey() {
  return ['galleries', 'customer'] as const;
}

/** Client view: the reachable, non-empty galleries of the client's own bookings. */
export function useCustomerGalleries(enabled = true) {
  return useQuery({
    queryKey: customerGalleriesKey(),
    enabled,
    queryFn: async () => {
      const res = await api.get<CustomerGallery[]>('/api/customer/galleries');
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

/**
 * Keyed by gallery, so a slow response for the previously selected gallery
 * lands in its own entry and can never paint its photos into the one now open.
 */
export function useGalleryPhotos(galleryId: string) {
  return useQuery({
    queryKey: galleryPhotosKey(galleryId),
    queryFn: async () => {
      const res = await api.get<DeliveryPhoto[]>(`/api/galleries/${galleryId}/photos`);
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

/**
 * Its own query rather than {@link useBookings}: that one falls back to demo
 * bookings in development, and a gallery created against a demo booking id is
 * a 404 the photographer cannot explain.
 *
 * <p>`staleTime: 0`: the modal used to fetch on every open, and a booking made
 * a moment ago on the bookings screen must be in the picker. Cached options
 * still show at once; they are revalidated behind them.
 */
export function useGalleryBookingOptions() {
  return useQuery({
    queryKey: galleryBookingOptionsKey(),
    staleTime: 0,
    queryFn: async () => {
      const res = await api.get<GalleryBookingOption[]>('/api/photographerBookings?size=100');
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

/** Writes one gallery back into the cached list, keeping its position. */
function replaceInList(list: Gallery[] | undefined, updated: Gallery) {
  return list?.map((g) => (g.id === updated.id ? updated : g));
}

export function useCreateGallery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bookingId: string) =>
      (await api.post<Gallery>('/api/galleries', { bookingId })).data,
    onSuccess: (created) =>
      qc.setQueryData<Gallery[]>(galleriesKey(), (list) => [created, ...(list ?? [])]),
  });
}

export function useUpdateGallery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; body: Record<string, unknown> }) =>
      (await api.patch<Gallery>(`/api/galleries/${input.id}`, input.body)).data,
    onSuccess: (updated) =>
      qc.setQueryData<Gallery[]>(galleriesKey(), (list) => replaceInList(list, updated)),
  });
}

/**
 * Grants one more full plan-sized window (ADR-001 §4.2). Works on a gallery
 * that already lapsed — that recovery path is precisely why the grace period
 * exists — and 409s once the photos have actually been deleted.
 */
export function useExtendGallery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.post<Gallery>(`/api/galleries/${id}/extend`, {})).data,
    onSuccess: (updated) =>
      qc.setQueryData<Gallery[]>(galleriesKey(), (list) => replaceInList(list, updated)),
  });
}

/**
 * Mirrors `SendGalleryRequest` on the API. `note` is the photographer's
 * optional Personal note to the Customer, at most 1000 characters; it is
 * never stored on the gallery.
 */
export interface SendGalleryRequest {
  note: string | null;
}

/**
 * "An Kunden senden": emails the booking's Customer the link to the gallery.
 * Each call is one message, so it can be sent again. The API answers 409
 * while the gallery has no photos, which is why the screen disables it then.
 */
export function useSendGallery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string } & SendGalleryRequest) =>
      (
        await api.post<Gallery>(`/api/galleries/${input.id}/send`, {
          note: input.note,
        } satisfies SendGalleryRequest)
      ).data,
    onSuccess: (updated) =>
      qc.setQueryData<Gallery[]>(galleriesKey(), (list) => replaceInList(list, updated)),
  });
}

export function useDeleteGallery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/galleries/${id}`);
    },
    onSuccess: (_void, id) => {
      qc.setQueryData<Gallery[]>(galleriesKey(), (list) => list?.filter((g) => g.id !== id));
      qc.removeQueries({ queryKey: galleryPhotosKey(id) });
    },
  });
}

export function useDeleteGalleryPhoto(galleryId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photoId: string) => {
      await api.delete(`/api/galleries/photos/${photoId}`);
    },
    onSuccess: (_void, photoId) => {
      qc.setQueryData<DeliveryPhoto[]>(galleryPhotosKey(galleryId), (photos) =>
        photos?.filter((p) => p.id !== photoId)
      );
      // photoCount on the list row.
      qc.invalidateQueries({ queryKey: galleriesKey(), exact: true });
    },
  });
}

/**
 * Uploads each file straight to storage through a presigned URL, then marks it
 * complete. Sequential, so a failure stops at the file that failed.
 *
 * <p>Refreshes on settle, not only on success: a batch that fails on its third
 * file has still stored the first two, and the counts must say so.
 */
export function useUploadGalleryPhotos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; files: File[] }) => {
      for (const file of input.files) {
        const { data: init } = await api.post<InitiateUploadResponse>(
          `/api/galleries/${input.id}/photos/initiate-upload`,
          // The size is required: the API signs it into the URL as
          // Content-Length, which is what bounds the upload, and it is the size
          // recorded against the photo — so it is not sent again at complete.
          {
            filename: file.name,
            contentType: file.type || 'application/octet-stream',
            fileSizeBytes: file.size,
          }
        );
        const put = await fetch(init.uploadUrl, {
          method: 'PUT',
          body: file,
          // The type the API signed, not our own guess — see above.
          headers: { 'Content-Type': init.contentType },
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
        await api.post(`/api/galleries/photos/${init.photoId}/complete`, {});
      }
    },
    onSettled: (_void, _error, input) => {
      qc.invalidateQueries({ queryKey: galleriesKey(), exact: true });
      qc.invalidateQueries({ queryKey: galleryPhotosKey(input.id) });
    },
  });
}
