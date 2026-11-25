import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import { LegalPageShell } from './LegalPageShell';
import { AGB } from '@/lib/legal-content';

describe('LegalPageShell', () => {
  // Like the landing page, the legal pages follow the system or the choice
  // made in the app; the toggle lives on the auth pages and in the dashboard.
  it.each([
    ['en', /dark theme|light theme/i],
    ['de', /dunklen Design|hellen Design/i],
  ] as const)('offers no theme toggle (%s)', (lang, name) => {
    renderWithProviders(<LegalPageShell doc={AGB} />, { lang });
    expect(screen.queryByRole('button', { name })).toBeNull();
  });
});
