'use client';

import React, { useMemo } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { getColors } from '@/lib/design-tokens';
import { useTranslation } from '@/lib/i18n';
import { BrandingSettings } from '../BrandingSettings';
import { EnquiryAcknowledgementSettings } from '../EnquiryAcknowledgementSettings';
import { PackagesSection } from '../PackagesSection';
import { ResourceSettings } from '../ResourceSettings';
import { SettingsSection } from '../SettingsSection';

/**
 * What clients see, and what they can book.
 *
 * <p>Branding first because it is the studio's face, then how it answers an
 * enquiry, then the catalogue that face is selling, then the rooms and gear
 * that catalogue draws on — outward in to inward, which is the order a
 * photographer sets a studio up in.
 */
export default function StudioSettingsPage() {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const c = useMemo(() => getColors(theme), [theme]);

  return (
    <>
      <SettingsSection
        id="settings-branding"
        title={t('settings.branding.title')}
        description={t('settings.branding.description')}
        colors={c}
      >
        <BrandingSettings />
      </SettingsSection>

      <SettingsSection
        id="settings-enquiry-acknowledgement"
        title={t('settings.enquiryAck.title')}
        description={t('settings.enquiryAck.description')}
        colors={c}
      >
        <EnquiryAcknowledgementSettings />
      </SettingsSection>

      <PackagesSection theme={theme} />

      <SettingsSection
        id="settings-resources"
        title={t('settings.resources.title')}
        description={t('settings.resources.description')}
        colors={c}
      >
        <ResourceSettings />
      </SettingsSection>
    </>
  );
}
