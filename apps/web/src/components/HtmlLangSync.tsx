'use client';

import { useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';

/**
 * Keeps `<html lang>` in step with the chosen UI language.
 *
 * The attribute is not cosmetic: screen readers pick their pronunciation rules
 * from it, so German copy under `lang="en"` is read aloud with English
 * phonetics. It also drives browser translation offers and `:lang()` CSS.
 *
 * The root layout is a server component and renders the source locale; the
 * inline script in <head> corrects it before first paint, and this effect keeps
 * it correct when the user toggles language at runtime.
 */
export function HtmlLangSync() {
  const { lang } = useTranslation();

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return null;
}
