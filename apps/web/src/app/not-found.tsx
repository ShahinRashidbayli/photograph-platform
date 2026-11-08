import React from 'react';
import Link from 'next/link';

/**
 * 404. Reached both by an unknown URL and by `notFound()` — which the public
 * portfolio and request pages call for a subdomain that has no photographer,
 * so this page is part of a real flow, not just a fallback.
 */
export default function NotFound() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: '#0A0A0C',
        color: '#F4F4F5',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <p
          style={{
            fontSize: '0.8rem',
            letterSpacing: '0.14em',
            color: '#71717A',
            margin: '0 0 10px',
          }}
        >
          404
        </p>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 8px' }}>Page not found</h1>
        <p style={{ fontSize: '0.95rem', lineHeight: 1.6, color: '#A1A1AA', margin: '0 0 22px' }}>
          This link may be outdated, or the photographer’s page may have moved.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            padding: '10px 20px',
            borderRadius: 10,
            background: 'var(--ui-ink)',
            color: 'var(--ui-paper)',
            fontSize: '0.9rem',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Go to the homepage
        </Link>
      </div>
    </main>
  );
}
