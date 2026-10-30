'use client';

import React, { useMemo } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { getColors } from '@/lib/design-tokens';
import { useTranslation } from '@/lib/i18n';
import { SettingsSection } from '../SettingsSection';
import { PersonalDataErasure } from '../PersonalDataErasure';

/** The studio's own data-protection duties toward its clients. */
export default function PrivacySettingsPage() {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const c = useMemo(() => getColors(theme), [theme]);

  return (
    <SettingsSection
      id="settings-privacy"
      title={t('privacy.title')}
      description={t('privacy.description')}
      colors={c}
    >
      <PersonalDataErasure />
    </SettingsSection>
  );
}
