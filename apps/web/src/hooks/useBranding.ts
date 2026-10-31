import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

/** Mirrors `BrandingResponse` on the API. */
export interface Branding {
  logoUrl: string | null;
  brandColor: string | null;
  whiteLabel: boolean;
}

/**
 * The studio's white-label branding: a logo and a colour.
 *
 * <p>Each write sends only the field it changes. Absent means "leave it" on
 * the server and `""` means "clear it" — sending both fields on every save is
 * what made saving a colour delete the logo, since the form never holds the
 * logo's key, only its (expiring) URL.
 */

export function brandingKey() {
  return ['branding'] as const;
}

export function useBranding() {
  return useQuery({
    queryKey: brandingKey(),
    queryFn: async () => (await api.get<Branding>('/api/settings/branding')).data,
  });
}

async function putBranding(next: { logoKey?: string | null; brandColor?: string | null }) {
  const body: Record<string, string> = {};
  if (next.logoKey !== undefined) body.logoKey = next.logoKey ?? '';
  if (next.brandColor !== undefined) body.brandColor = next.brandColor ?? '';
  return (await api.put<Branding>('/api/settings/branding', body)).data;
}

/** Sets or clears one field: `{ brandColor }` or `{ logoKey: null }`. */
export function useSaveBranding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: putBranding,
    onSuccess: (saved) => qc.setQueryData(brandingKey(), saved),
  });
}

/**
 * Uploads straight to R2 through a pre-signed PUT, then stores the object
 * key — never the view URL, which expires within the hour. Same flow as the
 * profile photo, down to sending back the content type the URL was signed
 * with rather than the browser's own guess.
 */
export function useUploadBrandingLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const contentType = file.type || 'image/png';
      const { data: presign } = await api.post<{
        uploadUrl: string;
        r2Key: string;
        contentType: string;
      }>(
        `/api/settings/branding/logo/presign?contentType=${encodeURIComponent(contentType)}` +
          `&fileSizeBytes=${file.size}`
      );
      const res = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': presign.contentType },
        body: file,
      });
      if (!res.ok) throw new Error('upload failed');
      return putBranding({ logoKey: presign.r2Key });
    },
    onSuccess: (saved) => qc.setQueryData(brandingKey(), saved),
  });
}
