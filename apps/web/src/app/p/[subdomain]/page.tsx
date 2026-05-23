import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import PublicPortfolioView from './PublicPortfolioView';

export const revalidate = 300; // 5-minute ISR — matches BE Cache-Control hint.

export interface PhotographerPublic {
  subdomain: string;
  displayName: string;
  plan: string;
  avatarUrl: string | null;
}

export interface PublicPhoto {
  id: string;
  viewUrl: string | null;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  sortOrder: number;
}

export interface PublicPortfolioPayload {
  photographer: PhotographerPublic;
  photos: PublicPhoto[];
}

interface Props {
  params: Promise<{ subdomain: string }>;
}

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:8080';

// SSR fetch. The BE endpoint is fully public (no auth, no tenant cookie); the
// subdomain is the only identifier. Failures (404, 5xx, network) collapse to
// `null` so the page can render notFound() rather than crashing the route.
async function fetchPortfolio(subdomain: string): Promise<PublicPortfolioPayload | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/public/portfolio/${encodeURIComponent(subdomain)}`,
      { next: { revalidate: 300 } }
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error('portfolio fetch failed', subdomain, res.status);
      return null;
    }
    return (await res.json()) as PublicPortfolioPayload;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('portfolio fetch error', subdomain, err);
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subdomain } = await params;
  const data = await fetchPortfolio(subdomain);
  if (!data) {
    return { title: 'Photographer not found · Fotolio' };
  }
  const name = data.photographer.displayName;
  const heroImage = data.photos[0]?.viewUrl ?? undefined;
  return {
    title: `${name} · Photography portfolio`,
    description: `Browse work by ${name} and request a booking.`,
    openGraph: {
      title: name,
      description: `Photography by ${name}`,
      images: heroImage ? [heroImage] : [],
      type: 'website',
    },
    twitter: {
      card: heroImage ? 'summary_large_image' : 'summary',
      title: name,
      images: heroImage ? [heroImage] : [],
    },
  };
}

export default async function PublicPortfolioPage({ params }: Props) {
  const { subdomain } = await params;
  const data = await fetchPortfolio(subdomain);
  if (!data) notFound();

  return <PublicPortfolioView data={data} />;
}
