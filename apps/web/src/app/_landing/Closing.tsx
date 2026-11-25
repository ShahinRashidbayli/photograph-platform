'use client';

import Link from 'next/link';
import { FotolioLogo } from '@/components/FotolioLogo';
import { Icon } from '@/components/Icon';
import { useTranslation } from '@/lib/i18n';
import { SECTIONS } from './Nav';

/** The close and the footer as one dark block: the last ask, then the links. */
// PROTOTYPE (#81): `logoTheme` lets a light closing band carry the light logo.
export function Closing({ logoTheme = 'dark' }: { logoTheme?: 'light' | 'dark' } = {}) {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="lp-dark lp-footer">
      <div className="lp-wrap">
        <div className="lp-head-row">
          <div style={{ maxWidth: 720 }}>
            <h2 className="lp-h2">{t('landing.close.title')}</h2>
            <p className="lp-lede" style={{ marginTop: 18, fontSize: '1.1rem' }}>
              {t('landing.close.text')}
            </p>
          </div>
          {/* One ask, in the page's primary style (ink, inverted on the dark
              block) — pricing sits directly above, so a "See pricing" here
              only sent people back up. */}
          <div className="lp-actions" style={{ marginTop: 0 }}>
            <Link href="/register" className="lp-btn lp-btn-inverse">
              {t('landing.close.cta')}
              <Icon name="arrow-right" size={16} strokeWidth={2} />
            </Link>
          </div>
        </div>

        <div className="lp-footer-grid">
          <div className="lp-footer-brand">
            <FotolioLogo theme={logoTheme} variant="brand" showText />
            <p>{t('landing.footer.brandText')}</p>
          </div>
          <nav className="lp-footer-col" aria-label={t('landing.footer.product')}>
            <h3>{t('landing.footer.product')}</h3>
            {SECTIONS.map((s) => (
              <a key={s.href} href={s.href}>
                {t(s.labelKey)}
              </a>
            ))}
          </nav>
          <nav className="lp-footer-col" aria-label={t('landing.footer.account')}>
            <h3>{t('landing.footer.account')}</h3>
            <Link href="/login">{t('landing.nav.signIn')}</Link>
            <Link href="/register">{t('landing.nav.getStarted')}</Link>
            <Link href="/customer/auth/login">{t('landing.nav.clientSignIn')}</Link>
          </nav>
          <nav className="lp-footer-col" aria-label={t('landing.footer.legal')}>
            <h3>{t('landing.footer.legal')}</h3>
            <Link href="/impressum">Impressum</Link>
            <Link href="/datenschutz">Datenschutz</Link>
            <Link href="/agb">AGB</Link>
          </nav>
        </div>

        <div className="lp-footer-bottom">
          <span>{t('landing.footer.rights', { year: String(year) })}</span>
        </div>
      </div>
    </footer>
  );
}
