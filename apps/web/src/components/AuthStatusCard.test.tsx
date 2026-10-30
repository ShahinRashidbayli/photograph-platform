import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { AuthStatusCard } from './AuthStatusCard';
import { useThemeStore } from '@/store/themeStore';
import { getColors } from '@/lib/design-tokens';

describe('AuthStatusCard', () => {
  // Wrapped in `act`: the store is subscribed to by mounted components, so a
  // bare setState schedules a React update outside act and warns.
  const setTheme = (theme: 'light' | 'dark') => act(() => useThemeStore.setState({ theme }));

  afterEach(() => setTheme('light'));

  it('announces the outcome politely rather than interrupting', () => {
    render(
      <AuthStatusCard tone="success" title="Email confirmed" message="Your address is confirmed." />
    );

    const live = screen.getByRole('status');
    expect(live).toHaveTextContent('Your address is confirmed.');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  /**
   * The three states must be distinguishable without colour: the heading is
   * what a screen reader, a greyscale display and a colour-blind user all get.
   */
  it.each([
    ['loading', 'Signing you in'],
    ['success', 'Welcome back'],
    ['error', 'Sign-in failed'],
  ] as const)('gives %s its own heading', (tone, title) => {
    render(<AuthStatusCard tone={tone} title={title} message="…" />);

    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
  });

  it('renders the actions it is given', () => {
    render(
      <AuthStatusCard tone="error" title="Sign-in failed" message="Expired.">
        <a href="/customer/auth/login">Request a new link</a>
      </AuthStatusCard>
    );

    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute(
      'href',
      '/customer/auth/login'
    );
  });

  /**
   * The bug this component was extracted to fix: both verify screens read a
   * static light-mode style snapshot, so a dark-theme user who clicked a link
   * in their inbox got a white card. Asserting on the resolved token rather
   * than a literal keeps this true if the palette is retuned.
   */
  it('follows the dark theme instead of a baked-in light palette', () => {
    setTheme('dark');
    render(<AuthStatusCard tone="success" title="Email confirmed" message="Done." />);

    const heading = screen.getByRole('heading', { name: 'Email confirmed' });
    expect(heading).toHaveStyle({ color: getColors('dark').text });
    expect(getColors('dark').text).not.toBe(getColors('light').text);
  });
});
