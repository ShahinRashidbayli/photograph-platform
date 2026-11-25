import { act, render } from '@testing-library/react';
import { ThemeSync } from '@/components/ThemeSync';
import { useThemeStore as sharedStore, type ThemePreference } from './themeStore';

/**
 * The theme rule: an explicit choice wins, otherwise the system setting — and
 * the system setting is followed live.
 *
 * <p>The store reads `prefers-color-scheme` and storage when its module
 * loads, so those tests set the system first and then load a fresh copy of the
 * module. The live tests render `ThemeSync`, which must share React with the
 * store, so they use the regular import and set its starting state.
 */

type Listener = () => void;

/** A controllable `prefers-color-scheme: dark`. */
function mockSystem(initialDark: boolean) {
  const listeners = new Set<Listener>();
  const list = {
    matches: initialDark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  };
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: () => list,
  });
  return {
    set(dark: boolean) {
      list.matches = dark;
      listeners.forEach((l) => l());
    },
  };
}

function load() {
  let mod!: typeof import('./themeStore');
  jest.isolateModules(() => {
    mod = require('./themeStore');
  });
  return mod;
}

/** The shared store as it would load with this choice and a light system. */
function start(preference: ThemePreference) {
  const theme = preference === 'system' ? 'light' : preference;
  act(() => sharedStore.setState({ preference, systemTheme: 'light', theme }));
  localStorage.clear();
}

const stored = () => JSON.parse(localStorage.getItem('theme-storage') ?? 'null')?.state ?? null;

describe('resolveTheme', () => {
  it('lets an explicit choice win and falls back to the system', () => {
    const { resolveTheme } = load();
    expect(resolveTheme('dark', 'light')).toBe('dark');
    expect(resolveTheme('light', 'dark')).toBe('light');
    expect(resolveTheme('system', 'dark')).toBe('dark');
    expect(resolveTheme('system', 'light')).toBe('light');
  });
});

describe('without an explicit choice', () => {
  it('follows a dark system', () => {
    mockSystem(true);
    const { useThemeStore } = load();
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(useThemeStore.getState().preference).toBe('system');
  });

  it('follows a light system', () => {
    mockSystem(false);
    const { useThemeStore } = load();
    expect(useThemeStore.getState().theme).toBe('light');
  });

  it('switches live when the system setting changes, and saves nothing', () => {
    const system = mockSystem(false);
    start('system');
    render(<ThemeSync />);
    act(() => system.set(true));
    expect(sharedStore.getState().theme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(stored()?.theme).toBeUndefined();
  });

  it('makes a toggle click an explicit choice of the opposite of what is on screen', () => {
    mockSystem(true);
    const { useThemeStore } = load();
    act(() => useThemeStore.getState().toggleTheme());
    expect(useThemeStore.getState().theme).toBe('light');
    expect(useThemeStore.getState().preference).toBe('light');
    expect(stored()).toEqual({ theme: 'light' });
  });
});

describe('with an explicit choice', () => {
  it('reads a value stored before "system" existed as that choice', () => {
    localStorage.setItem('theme-storage', JSON.stringify({ state: { theme: 'dark' }, version: 0 }));
    mockSystem(false);
    const { useThemeStore } = load();
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(useThemeStore.getState().preference).toBe('dark');
  });

  it('ignores a system change', () => {
    const system = mockSystem(false);
    start('light');
    render(<ThemeSync />);
    act(() => system.set(true));
    expect(sharedStore.getState().theme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('goes back to following the system when System is chosen', () => {
    localStorage.setItem(
      'theme-storage',
      JSON.stringify({ state: { theme: 'light' }, version: 0 })
    );
    mockSystem(true);
    const { useThemeStore, readStoredChoice } = load();
    act(() => useThemeStore.getState().setPreference('system'));
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(readStoredChoice()).toBeNull();
  });
});
