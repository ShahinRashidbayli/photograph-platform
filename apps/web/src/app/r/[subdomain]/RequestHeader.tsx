'use client';

import { useTranslation } from '@/lib/i18n';

/**
 * The request page's heading, in the visitor's language. The page around it is
 * a Server Component (it resolves the studio before rendering), so the words
 * that need the language store live in this small client island.
 */
export function RequestHeader({ displayName }: Readonly<{ displayName: string }>) {
  const { t } = useTranslation();
  return (
    <>
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px', color: '#0F172A' }}>
        {t('request.title')}
      </h1>
      <p style={{ color: '#475569', margin: '0 0 32px' }}>
        {t('request.lede', { name: displayName })}
      </p>
    </>
  );
}
