import { act, screen } from '@testing-library/react';
import { renderWithProviders, setupUser } from '@/test-utils/render';
import { useThemeStore } from '@/store/themeStore';
import { getColors } from '@/lib/design-tokens';
import { DashboardHeader } from './DashboardHeader';

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn(), back: jest.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

function renderHeader() {
  const theme = useThemeStore.getState().theme;
  const c = getColors(theme);
  return renderWithProviders(
    <DashboardHeader
      user={null}
      theme={theme}
      handleLogout={jest.fn()}
      colors={{
        headerBg: c.surface,
        border: c.border,
        text: c.text,
        subText: c.textMuted,
        cardBg: c.surface,
        surfaceHover: c.surfaceHover,
        surfaceActive: c.surfaceActive,
        danger: c.danger,
        shadowPopover: 'none',
      }}
      isOpen={false}
      setIsOpen={jest.fn()}
      attentionCount={null}
      attention={null}
      onAttentionHandled={jest.fn()}
    />,
    { lang: 'en' }
  );
}

describe('DashboardHeader appearance', () => {
  beforeEach(() => {
    // Following the system, and the system is dark.
    act(() => useThemeStore.setState({ preference: 'system', systemTheme: 'dark', theme: 'dark' }));
  });

  it('keeps the theme toggle', () => {
    renderHeader();
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
  });

  it('offers Light, Dark and System in the avatar menu, with the current one checked', async () => {
    const user = setupUser();
    renderHeader();
    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(screen.getByRole('group', { name: 'Appearance' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'System' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByRole('menuitemradio', { name: 'Light' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
  });

  it('makes Light an explicit choice and System the way back', async () => {
    const user = setupUser();
    renderHeader();
    await user.click(screen.getByRole('button', { name: 'Account menu' }));

    await user.click(screen.getByRole('menuitemradio', { name: 'Light' }));
    expect(useThemeStore.getState()).toMatchObject({ preference: 'light', theme: 'light' });

    await user.click(screen.getByRole('menuitemradio', { name: 'System' }));
    expect(useThemeStore.getState()).toMatchObject({ preference: 'system', theme: 'dark' });
  });
});
