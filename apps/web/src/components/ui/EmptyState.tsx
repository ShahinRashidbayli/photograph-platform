'use client';

import React from 'react';
import { useColors } from './tokens';

export interface EmptyStateProps {
  title: React.ReactNode;
  body?: React.ReactNode;
  action?: React.ReactNode;
}

/**
 * "Nothing here yet." Centralised because an honest empty state is the app's
 * substitute for placeholder data, so it appears on almost every screen and
 * should read the same way each time.
 */
export function EmptyState({ title, body, action }: EmptyStateProps) {
  const c = useColors();
  return (
    <div style={{ padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: '1.05rem', fontWeight: 600, color: c.text, marginBottom: 6 }}>
        {title}
      </div>
      {body ? (
        <p
          style={{
            fontSize: '0.9rem',
            color: c.textMuted,
            lineHeight: 1.55,
            maxWidth: 460,
            margin: '0 auto 16px',
          }}
        >
          {body}
        </p>
      ) : null}
      {action}
    </div>
  );
}
