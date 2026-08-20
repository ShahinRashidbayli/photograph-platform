'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useThemeStore } from '@/store/themeStore';
import { getColors } from '@/lib/design-tokens';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTranslation } from '@/lib/i18n';

/**
 * Contracts and e-signature — not built yet.
 *
 * <p>This page used to render hard-coded sample documents: a photography
 * contract "awaiting signature", a model release marked SIGNED, and a GDPR
 * consent stating photos are deleted 12 months after delivery. It was unlinked
 * from the sidebar but the route stayed reachable, so any signed-in client who
 * typed the URL read fabricated legal statements about their own booking —
 * including that they had signed something they never signed.
 *
 * <p>An empty page is worse product and better software. It stays a route (the
 * nav entry returns with the backend) and says plainly that nothing is here.
 */
export default function DocumentsPage() {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const c = useMemo(() => getColors(theme), [theme]);

  return (
    <div style={{ padding: '28px 28px 40px', maxWidth: 860, margin: '0 auto', color: c.text }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 6 }}>
        {t('stubs.documents.title')}
      </h1>
      <p style={{ fontSize: '0.95rem', color: c.textMuted, marginBottom: 24 }}>
        {t('stubs.documents.subtitle')}
      </p>

      <Card>
        <EmptyState
          title={t('stubs.documents.notAvailable')}
          body={t('stubs.documents.body')}
          action={
            <Link
              href="/bookings"
              style={{
                display: 'inline-block',
                padding: '9px 18px',
                borderRadius: 10,
                background: c.primarySolid,
                color: '#fff',
                fontSize: '0.88rem',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              {t('stubs.documents.back')}
            </Link>
          }
        />
      </Card>
    </div>
  );
}
