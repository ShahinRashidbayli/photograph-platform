'use client';

import React, { useMemo } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { getColors } from '@/lib/design-tokens';
import { useTranslation } from '@/lib/i18n';
import { Note } from '@/components/ui';
import { BillingProfileSection } from '../BillingSettings';
import { LegalDetailsSection } from '../LegalDetailsSection';

/**
 * Who the photographer is on paper.
 *
 * <p>These two forms were previously separated by three other sections, and
 * that is the whole reason they are together now: they ask for the same six
 * facts. `businessName`/`legalName`, `addressLine1`/`legalStreet`,
 * `postalCode`/`legalPostalCode`, `city`/`legalCity`, `country`/`legalCountry`
 * and `vatId`/`legalVatId` are separate columns on `tenants`, filled in by
 * separate forms, with no link between them.
 *
 * <p>The duplication is not merely tedious typing. An invoice that names one
 * address and an Impressum that names another are two statutory documents from
 * one business that disagree — and the defaults already disagree out of the
 * box, since the invoicing country defaults to `DE` and the legal one to
 * `Deutschland`.
 *
 * <p>Merging the columns is a data migration with legal consequences and is not
 * something a layout change should decide, so this panel does the part that is
 * safely in its gift: it puts the two forms next to each other and says out
 * loud that they overlap, where a photographer filling in the second one can
 * still see the first.
 */
export default function BusinessSettingsPage() {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const c = useMemo(() => getColors(theme), [theme]);

  return (
    <>
      <Note style={{ marginBottom: 20 }}>{t('settings.business.overlapNote')}</Note>

      <BillingProfileSection />
      <LegalDetailsSection theme={theme} />

      <p
        style={{
          fontSize: '0.8rem',
          color: c.textMuted,
          lineHeight: 1.55,
          margin: '4px 2px 0',
        }}
      >
        {t('settings.business.footnote')}
      </p>
    </>
  );
}
