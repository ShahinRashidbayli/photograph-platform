import '@testing-library/jest-dom';

/**
 * Zustand stores persist to localStorage, and jsdom shares one instance across
 * every test in a file — a theme or language set by one test would otherwise
 * leak into the next and make assertions order-dependent.
 */
afterEach(() => {
  globalThis.localStorage?.clear();
});
