import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import RequestForm from './RequestForm';
import { PhotographerLegalFooter } from '@/components/legal/PhotographerLegalFooter';

export const revalidate = 300; // Matches /p/[subdomain] — same upstream payload.

interface Props {
  params: Promise<{ subdomain: string }>;
}

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:8080';

/**
 * Resolves the photographer behind the subdomain, or null when there isn't one.
 *
 * <p>This page used to render for *any* string: `/r/does-not-exist` produced a
 * complete, inviting request form addressed to a photographer who does not
 * exist, and the visitor only found out after filling it in and submitting,
 * when the POST came back 404. Its sibling `/p/[subdomain]` already resolves
 * the subdomain server-side and calls `notFound()`; this route now does the
 * same, which also gives us the real display name instead of printing the raw
 * URL slug at the reader ("Send anna-mueller a few details…").
 */
async function fetchPhotographer(subdomain: string): Promise<{ displayName: string } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/public/portfolio/${encodeURIComponent(subdomain)}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { photographer?: { displayName?: string } };
    const displayName = data.photographer?.displayName;
    return displayName ? { displayName } : null;
  } catch {
    // A backend outage must not turn a valid link into a 404 page — fall back
    // to rendering the form, which still validates the subdomain on submit.
    return { displayName: subdomain };
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subdomain } = await params;
  const photographer = await fetchPhotographer(subdomain);
  if (!photographer) return { title: 'Photographer not found · Fotolio' };
  return {
    title: `Request a session · ${photographer.displayName}`,
    description: `Send a booking request to ${photographer.displayName}.`,
  };
}

export default async function PublicRequestPage({ params }: Props) {
  const { subdomain } = await params;
  const photographer = await fetchPhotographer(subdomain);
  if (!photographer) notFound();

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#F9FAFB',
        padding: '32px 16px 80px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px', color: '#0F172A' }}>
          Request a session
        </h1>
        <p style={{ color: '#475569', margin: '0 0 32px' }}>
          Send {photographer.displayName} a few details about your shoot — they will reply shortly.
        </p>
        <RequestForm subdomain={subdomain} />
        {/*
          §5 DDG requires the Impressum to be reachable from every page of a
          commercial presence — and this page, where personal data is actually
          collected, is the one where it matters most.
        */}
        <PhotographerLegalFooter subdomain={subdomain} displayName={photographer.displayName} />
      </div>
    </main>
  );
}
