'use client';

import type React from 'react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FotolioLogo } from '@/components/FotolioLogo';
import { Icon } from '@/components/Icon';
import { LanguageToggle } from '@/components/LanguageToggle';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTranslation, type TranslationKey } from '@/lib/i18n';
import { useThemeStore } from '@/store/themeStore';

/** One list for the bar, the phone menu and the footer, so they cannot drift. */
export const SECTIONS: { href: string; labelKey: TranslationKey }[] = [
  { href: '#product', labelKey: 'landing.nav.product' },
  { href: '#galleries', labelKey: 'landing.nav.galleries' },
  { href: '#workflow', labelKey: 'landing.nav.workflow' },
  { href: '#pricing', labelKey: 'landing.nav.pricing' },
  { href: '#faq', labelKey: 'landing.nav.faq' },
];

/** The bar follows the theme, so its controls take their ink from `.lp-nav`
 *  in `globals.css`: ink on paper, light on charcoal. */
const NAV_CONTROL = {
  color: 'var(--lp-nav-control)',
  ['--ui-btn-hover' as string]: 'var(--lp-nav-control-hover)',
} as React.CSSProperties;

export function Nav() {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Escape closes the phone menu, so it is dismissable without finding the toggle.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <header className="lp-nav" data-tone="theme" data-scrolled={scrolled}>
      <div className="lp-wrap lp-nav-inner">
        <Link href="/" aria-label={t('landing.aria.home')} style={{ display: 'inline-flex' }}>
          <FotolioLogo theme={theme} variant="brand" showText />
        </Link>
        <nav className="lp-nav-links" aria-label={t('landing.aria.sections')}>
          {SECTIONS.map((s) => (
            <a key={s.href} href={s.href} className="lp-navlink">
              {t(s.labelKey)}
            </a>
          ))}
        </nav>
        <div className="lp-nav-right">
          <LanguageToggle variant="bare" style={NAV_CONTROL} />
          <ThemeToggle variant="bare" style={NAV_CONTROL} />
          <Link href="/login" className="lp-navlink lp-nav-signin">
            {t('landing.nav.signIn')}
          </Link>
          <Link href="/register" className="lp-btn lp-btn-inverse lp-btn-sm">
            {t('landing.nav.getStarted')}
          </Link>
          <button
            type="button"
            className="lp-menu-btn"
            aria-expanded={menuOpen}
            aria-controls="lp-menu"
            aria-label={menuOpen ? t('landing.aria.closeMenu') : t('landing.aria.openMenu')}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} size={18} />
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav id="lp-menu" className="lp-menu" aria-label={t('landing.aria.sections')}>
          {SECTIONS.map((s) => (
            <a key={s.href} href={s.href} onClick={() => setMenuOpen(false)}>
              {t(s.labelKey)}
            </a>
          ))}
          <Link href="/login" onClick={() => setMenuOpen(false)}>
            {t('landing.nav.signIn')}
          </Link>
          <Link href="/register" onClick={() => setMenuOpen(false)}>
            {t('landing.nav.getStarted')}
          </Link>
        </nav>
      )}
    </header>
  );
}
