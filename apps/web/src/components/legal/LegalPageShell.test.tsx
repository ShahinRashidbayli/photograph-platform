import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test-utils/render';
import { useThemeStore } from '@/store/themeStore';
import { LegalPageShell } from './LegalPageShell';
import { AGB } from '@/lib/legal-content';

describe('LegalPageShell', () => {
  // The marketing pages behave the same way: the landing nav and the legal
  // pages both offer the two-state toggle, and the choice carries between them.
  it.each([
    ['en', 'Switch to dark theme', 'Switch to light theme'],
    ['de', 'Zum dunklen Design wechseln', 'Zum hellen Design wechseln'],
  ] as const)('offers the theme toggle (%s)', async (lang, toDark, toLight) => {
    act(() => useThemeStore.setState({ theme: 'light', preference: 'system' }));
    renderWithProviders(<LegalPageShell doc={AGB} />, { lang });

    await userEvent.click(screen.getByRole('button', { name: toDark }));

    expect(useThemeStore.getState().preference).toBe('dark');
    expect(screen.getByRole('button', { name: toLight })).toBeInTheDocument();
  });
});
