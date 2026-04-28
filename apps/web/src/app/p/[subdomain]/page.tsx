import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const revalidate = 300; // 5-minute ISR — matches the BE Cache-Control hint.

interface Photo {
  id: string;
  viewUrl: string | null;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  sortOrder: number;
}

interface Props {
  params: Promise<{ subdomain: string }>;
}

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:8080';

async function fetchPortfolio(subdomain: string): Promise<Photo[] | null> {
  // The BE endpoint is fully public (no auth, no tenant cookie); the subdomain
  // is the only identifier. Failures (404, 5xx, network) collapse to `null`
  // so the page can render notFound() rather than crashing the whole route.
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
    return (await res.json()) as Photo[];
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('portfolio fetch error', subdomain, err);
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subdomain } = await params;
  const title = `${subdomain} · Fotolio`;
  return {
    title,
    description: `Photography portfolio of ${subdomain}.`,
    openGraph: { title, type: 'website' },
  };
}

export default async function PublicPortfolioPage({ params }: Props) {
  const { subdomain } = await params;
  const photos = await fetchPortfolio(subdomain);

  if (photos === null) {
    notFound();
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0F172A',
        color: '#F8FAFC',
        padding: '32px 24px 96px',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <header style={{ maxWidth: 1200, margin: '0 auto 48px' }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>{subdomain}</h1>
        <p style={{ color: '#94A3B8', marginTop: 8 }}>
          Photography portfolio · Powered by{' '}
          <Link href="/" style={{ color: '#38BDF8' }}>
            Fotolio
          </Link>
        </p>
      </header>

      {photos.length === 0 ? (
        <p style={{ maxWidth: 1200, margin: '0 auto', color: '#94A3B8' }}>
          No photos published yet.
        </p>
      ) : (
        <section
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {photos.map((photo) => {
            const src = photo.viewUrl ?? photo.thumbnailUrl;
            if (!src) return null;
            return (
              <figure
                key={photo.id}
                style={{
                  margin: 0,
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: '#1E293B',
                  aspectRatio:
                    photo.width && photo.height
                      ? `${photo.width} / ${photo.height}`
                      : '4 / 3',
                }}
              >
                {/* Native <img> is intentional: portfolio photos come from R2
                    via presigned URLs that change per request, which doesn't
                    play well with next/image's optimizer cache. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </figure>
            );
          })}
        </section>
      )}

      <footer
        style={{
          maxWidth: 1200,
          margin: '64px auto 0',
          paddingTop: 24,
          borderTop: '1px solid #1E293B',
          color: '#64748B',
          fontSize: 13,
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <span>
          Photos: {subdomain} · Powered by{' '}
          <Link href="/" style={{ color: '#94A3B8' }}>
            Fotolio
          </Link>
        </span>
        <Link href={`/r/${encodeURIComponent(subdomain)}`} style={{ color: '#38BDF8' }}>
          Get in touch →
        </Link>
      </footer>
    </main>
  );
}
