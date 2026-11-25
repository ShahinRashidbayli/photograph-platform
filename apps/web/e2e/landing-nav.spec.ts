import { expect, test } from '@playwright/test';

/**
 * The landing nav's theme toggle, at the widths the CSS lays the bar out for.
 *
 * <p>Which bar controls show at which width is decided by media queries in
 * globals.css, which jsdom does not apply — so landing.claims.test.tsx can pin
 * that the toggle is in the bar and not in the phone menu, but only a browser
 * can see that a phone-width rule has not hidden it.
 */
const WIDTHS = { desktop: 1440, phone: 390 } as const;
const NAMES = {
  en: { light: 'Switch to dark theme', dark: 'Switch to light theme' },
  de: { light: 'Zum dunklen Design wechseln', dark: 'Zum hellen Design wechseln' },
} as const;

for (const lang of ['en', 'de'] as const) {
  for (const [label, width] of Object.entries(WIDTHS)) {
    test(`the theme toggle is visible in the nav bar at ${label} width (${lang})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(
        ([l]) => {
          localStorage.setItem('lang-storage', JSON.stringify({ state: { lang: l }, version: 0 }));
          localStorage.setItem('theme-storage', JSON.stringify({ state: { theme: 'light' } }));
        },
        [lang]
      );
      await page.goto('/');

      const bar = page.locator('.lp-nav-inner');
      const toggle = bar.getByRole('button', { name: NAMES[lang].light });
      await expect(toggle).toBeVisible();

      await toggle.click();
      await expect(bar.getByRole('button', { name: NAMES[lang].dark })).toBeVisible();
    });
  }
}
