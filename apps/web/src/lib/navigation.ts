/**
 * A full page load, for the few places that must not use the router: a fresh
 * session has to boot the app shell with its new cookies already attached.
 *
 * One function so a component test can mock it and see where the page went.
 * jsdom 26 makes `window.location` unforgeable, so a test can no longer
 * redefine it to record the URL, and jsdom itself does not navigate.
 */
export function hardNavigate(url: string): void {
  window.location.href = url;
}
