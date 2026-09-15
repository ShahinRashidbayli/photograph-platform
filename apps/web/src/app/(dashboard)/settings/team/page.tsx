'use client';

import React, { useMemo } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { getColors } from '@/lib/design-tokens';
import { useTranslation } from '@/lib/i18n';
import { SettingsSection } from '../SettingsSection';
import { TeamSettings } from '../TeamSettings';

/** Who else works in this studio. Seat count comes from the plan. */
export default function TeamSettingsPage() {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const c = useMemo(() => getColors(theme), [theme]);

  return (
    <SettingsSection
      id="settings-team"
      title={t('settings.team.title')}
      description={t('settings.team.description')}
      colors={c}
    >
      <TeamSettings />
    </SettingsSection>
  );
}
