import type { Metadata } from 'next';
import RequestForm from './RequestForm';

interface Props {
  params: Promise<{ subdomain: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subdomain } = await params;
  return {
    title: `Request a session · ${subdomain}`,
    description: `Send a booking request to ${subdomain}.`,
  };
}

export default async function PublicRequestPage({ params }: Props) {
  const { subdomain } = await params;
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#F9FAFB',
        padding: '32px 16px 80px',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px', color: '#0F172A' }}>
          Request a session
        </h1>
        <p style={{ color: '#475569', margin: '0 0 32px' }}>
          Send {subdomain} a few details about your shoot — they will reply
          shortly.
        </p>
        <RequestForm subdomain={subdomain} />
      </div>
    </main>
  );
}
