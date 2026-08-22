import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import GalleryView from './GalleryView';
import ExpiredGalleryNotice from './ExpiredGalleryNotice';

// No ISR: each view increments the gallery's view count and the photo URLs are
// short-lived presigned links, so a cached page would both under-count views
// and serve expired image URLs.
export const dynamic = 'force-dynamic';

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

export interface PublicGalleryPayload {
  photographerName: string;
  bookingName: string | null;
  eventType: string | null;
  shootDate: string | null;
  downloadEnabled: boolean;
  watermarkEnabled: boolean;
  expiresAt: string | null;
  // True once the retention window has passed (ADR-001). `photos` is then
  // empty and the page renders a tombstone rather than 404ing — see
  // ExpiredGalleryNotice for why that is the kinder and no less private
  // answer.
  expired: boolean;
  photos: DeliveryPhoto[];
}

interface Props {
  params: Promise<{ subdomain: string; token: string }>;
}

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:8080';

// The BE endpoint is public (no auth); the subdomain resolves the tenant and
// the token authorises the gallery. 404 (missing or expired) collapses to null
// so the route renders notFound() rather than crashing.
async function fetchGallery(
  subdomain: string,
  token: string
): Promise<PublicGalleryPayload | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/public/galleries/${encodeURIComponent(subdomain)}/${encodeURIComponent(token)}`,
      { cache: 'no-store' }
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error('gallery fetch failed', subdomain, res.status);
      return null;
    }
    return (await res.json()) as PublicGalleryPayload;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('gallery fetch error', subdomain, err);
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subdomain, token } = await params;
  const data = await fetchGallery(subdomain, token);
  if (!data) return { title: 'Gallery not found · Fotolio' };
  if (data.expired) {
    return {
      title: `Gallery expired · ${data.photographerName}`,
      robots: { index: false, follow: false },
    };
  }
  const title = data.bookingName ? `${data.bookingName} · Gallery` : 'Your gallery';
  return {
    title: `${title} · ${data.photographerName}`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicGalleryPage({ params }: Props) {
  const { subdomain, token } = await params;
  const data = await fetchGallery(subdomain, token);
  if (!data) notFound();

  if (data.expired) {
    return (
      <ExpiredGalleryNotice photographerName={data.photographerName} expiresAt={data.expiresAt} />
    );
  }

  return <GalleryView data={data} subdomain={subdomain} token={token} />;
}
