'use client';

import React, { useEffect } from 'react';

/**
 * Dashboard-scoped error boundary.
 *
 * <p>Nested under the dashboard layout on purpose: a failure inside one screen
 * keeps the sidebar, the theme and the session, so the user can move to another
 * page instead of being thrown out to a full-page error. Only the pane that
 * failed is replaced.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The only reporting channel this app has: no error tracker is wired up
    // yet, and swallowing a boundary's cause makes production reports
    // unactionable.
    // eslint-disable-next-line no-console
    console.error('Dashboard screen failed', error);
  }, [error]);

  return (
    <div style={{ padding: '48px 28px', maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
      <h1 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 8 }}>
        This page didn’t load
      </h1>
      <p style={{ fontSize: '0.92rem', lineHeight: 1.6, opacity: 0.75, marginBottom: 20 }}>
        Something went wrong while loading this screen. Nothing was saved or changed — the rest of
        your workspace is still available in the sidebar.
      </p>
      <button
        type="button"
        onClick={reset}
        style={{
          padding: '10px 20px',
          borderRadius: 10,
          border: 'none',
          background: 'var(--ui-ink)',
          color: 'var(--ui-paper)',
          fontSize: '0.9rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  );
}
