import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import { LegalPageShell } from './LegalPageShell';
import { AGB } from '@/lib/legal-content';

describe('LegalPageShell', () => {
  // Like the landing page, the legal pages follow the system or the choice
  // made in the app; the toggle lives on the auth pages and in the dashboard.
  it('offers no theme toggle', () => {
    renderWithProviders(<LegalPageShell doc={AGB} />, { lang: 'en' });
    expect(screen.queryByRole('button', { name: /dark theme|light theme/i })).toBeNull();
  });
});
