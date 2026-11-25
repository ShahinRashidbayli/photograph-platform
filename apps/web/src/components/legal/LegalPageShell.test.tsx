import { act, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import { LegalPageShell } from './LegalPageShell';
import { AGB } from '@/lib/legal-content';
import { useThemeStore } from '@/store/themeStore';

describe('LegalPageShell', () => {
  const asTheme = (theme: 'light' | 'dark') =>
    act(() => useThemeStore.setState({ preference: theme, systemTheme: theme, theme }));
  // Back to the store's initial state: following a light system.
  afterEach(() =>
    act(() =>
      useThemeStore.setState({ preference: 'system', systemTheme: 'light', theme: 'light' })
    )
  );

  // Like the landing nav, the legal pages' header offers the theme toggle,
  // named after what a click switches to.
  it.each([
    ['en', 'light', 'Switch to dark theme'],
    ['en', 'dark', 'Switch to light theme'],
    ['de', 'light', 'Zum dunklen Design wechseln'],
    ['de', 'dark', 'Zum hellen Design wechseln'],
  ] as const)('offers the theme toggle in the header (%s, %s)', (lang, theme, name) => {
    asTheme(theme);
    renderWithProviders(<LegalPageShell doc={AGB} />, { lang });
    const headerNav = screen.getByRole('navigation');
    expect(headerNav).toContainElement(screen.getByRole('button', { name }));
  });
});
