'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

/**
 * Route-level error boundary.
 *
 * <p>The App Router has always supported this file; without it, a render error
 * anywhere in the tree fell through to Next's own error screen — a stack trace
 * in development and an unbranded "something went wrong" in production, with
 * no way back into the app and no reset.
 *
 * <p>Deliberately styled without the theme store: this renders *because*
 * something failed, and reading from a store during a failure is how a boundary
 * ends up throwing inside itself. Colours are inlined against a neutral
 * background that is legible in both themes.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Nothing is wired to an error tracker yet; the console at least puts the
    // digest next to the stack so a production report can be matched to a log.
    // The only reporting channel this app has: no error tracker is wired up
    // yet, and swallowing a boundary's cause makes production reports
    // unactionable.
    // eslint-disable-next-line no-console
    console.error('Unhandled UI error', error);
  }, [error]);

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
      <div style={{ maxWidth: 460, textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 8px' }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: '0.95rem', lineHeight: 1.6, color: '#A1A1AA', margin: '0 0 20px' }}>
          The page failed to load. Your data is safe — nothing was saved or changed by this error.
        </p>
        {error.digest ? (
          <p style={{ fontSize: '0.75rem', color: '#71717A', margin: '0 0 20px' }}>
            Reference: <span style={{ fontFamily: 'ui-monospace, monospace' }}>{error.digest}</span>
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              border: 'none',
              background: '#6366F1',
              color: '#fff',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              border: '1px solid #26262E',
              color: '#F4F4F5',
              fontSize: '0.9rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
