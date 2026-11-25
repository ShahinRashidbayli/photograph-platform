'use client';

/**
 * PROTOTYPE ONLY — "How does the landing's first screen look in light mode?"
 * (wayfinder ticket #80, map #77). Throwaway branch `prototype/landing-light-hero`.
 *
 * Three variants of the nav + hero in LIGHT mode, switchable via `?variant=A|B|C`
 * on the existing `/` route. In DARK mode every variant renders today's hero,
 * so the theme toggle in the nav flips between the variant and today's dark.
 * Without `?variant=` the page is exactly today's.
 *
 *   A — Paper: paper ground, the photograph framed as an object, the booking
 *       page in front of it.
 *   B — Light wash: the photograph full-bleed behind a paper wash (a daylight
 *       photo, since a night photo under a light wash turns grey).
 *   C — Split: paper on the left, the photograph edge to edge on the right, the
 *       booking page across the seam; on a phone the photograph comes first.
 *
 * Accent word on paper: #86652f (5.06:1 on --lp-bg, 4.68:1 on --lp-band).
 */

import type React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FotolioLogo } from '@/components/FotolioLogo';
import { Icon } from '@/components/Icon';
import { LanguageToggle } from '@/components/LanguageToggle';
import { PrototypeSwitcher } from '@/components/prototype/PrototypeSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTranslation, type TranslationKey } from '@/lib/i18n';
import { useThemeStore } from '@/store/themeStore';
import { FACTS } from '../FormatsBand';
import { Hero } from '../Hero';
import { SAMPLE } from '../mock';
import { Nav, SECTIONS } from '../Nav';
import { STOCK, STOCK_THUMB } from '../stock';
import './prototype.css';

const VARIANTS = [
  { key: 'A', name: 'Paper' },
  { key: 'B', name: 'Light wash' },
  { key: 'C', name: 'Split' },
];

function useVariant(): string | null {
  const v = useSearchParams().get('variant');
  if (process.env.NODE_ENV === 'production') return null;
  return v && VARIANTS.some((x) => x.key === v) ? v : null;
}

const DARK_CONTROL = {
  color: '#e6dfd2',
  ['--ui-btn-hover' as string]: 'rgba(230, 223, 210, 0.1)',
} as React.CSSProperties;
const LIGHT_CONTROL = {
  color: 'var(--lp-text)',
  ['--ui-btn-hover' as string]: 'rgba(28, 25, 23, 0.06)',
} as React.CSSProperties;

/* ── Nav: today's bar plus the toggle; paper in light mode ─────────────── */

export function PrototypeNav() {
  const variant = useVariant();
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!variant) return <Nav />;
  const light = theme === 'light';
  const control = light ? LIGHT_CONTROL : DARK_CONTROL;

  return (
    <header className={`lp-nav${light ? ' proto-nav-light' : ''}`} data-scrolled={scrolled}>
      <div className="lp-wrap lp-nav-inner">
        <Link href="/" aria-label={t('landing.aria.home')} style={{ display: 'inline-flex' }}>
          <FotolioLogo theme={light ? 'light' : 'dark'} variant="brand" showText />
        </Link>
        <nav className="lp-nav-links" aria-label={t('landing.aria.sections')}>
          {SECTIONS.map((s) => (
            <a key={s.href} href={s.href} className="lp-navlink">
              {t(s.labelKey)}
            </a>
          ))}
        </nav>
        <div className="lp-nav-right">
          <LanguageToggle variant="bare" style={control} />
          <ThemeToggle variant="bare" style={control} />
          <Link href="/login" className="lp-navlink lp-nav-signin">
            {t('landing.nav.signIn')}
          </Link>
          <Link
            href="/register"
            className={`lp-btn ${light ? 'lp-btn-ink' : 'lp-btn-inverse'} lp-btn-sm`}
          >
            {t('landing.nav.getStarted')}
          </Link>
          <button
            type="button"
            className="lp-menu-btn"
            aria-expanded={menuOpen}
            aria-controls="lp-menu"
            aria-label={menuOpen ? t('landing.aria.closeMenu') : t('landing.aria.openMenu')}
            onClick={() => setMenuOpen((o) => !o)}
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
        </nav>
      )}
    </header>
  );
}

/* ── Hero pieces shared as content (not layout) ───────────────────────── */

function Copy() {
  const { t } = useTranslation();
  return (
    <div className="proto-copy">
      <h1 id="lp-hero-title" className="lp-h1">
        {t('landing.hero.title1')}
        <br />
        {t('landing.hero.title2pre')}
        <em className="lp-accent-word">{t('landing.hero.title2accent')}</em>.
      </h1>
      <p className="lp-lede">{t('landing.hero.lede')}</p>
      <div className="lp-actions">
        <Link href="/register" className="lp-btn lp-btn-ink">
          {t('landing.hero.ctaPrimary')}
        </Link>
        <a href="#product" className="lp-btn lp-btn-line">
          {t('landing.hero.ctaSecondary')}
          <Icon name="arrow-right" size={16} strokeWidth={2} />
        </a>
      </div>
      <dl className="lp-hero-facts">
        {FACTS.map((f) => (
          <div key={f.labelKey}>
            <dt>{t(f.labelKey)}</dt>
            <dd>{t(f.valueKey)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function BookingPage({ className }: { className?: string }) {
  const { t, format } = useTranslation();
  const fields: { labelKey: TranslationKey; value: string; wide?: boolean; select?: boolean }[] = [
    { labelKey: 'request.name', value: 'Lena Hoffmann' },
    { labelKey: 'request.email', value: 'lena@example.com' },
    { labelKey: 'request.date', value: format.dayMonthYearLong(SAMPLE.weddingDate) },
    { labelKey: 'request.type', value: t('leadEvent.WEDDING'), select: true },
    { labelKey: 'request.message', value: t('landing.book.messageValue'), wide: true },
  ];
  return (
    <div className={`lp-site lp-ui ${className ?? ''}`} aria-hidden="true">
      <div className="lp-browser-bar">
        <span className="lp-browser-dot" />
        <span className="lp-browser-dot" />
        <span className="lp-browser-dot" />
        <span className="lp-browser-url">studio-berg.fotolio.app</span>
      </div>
      <div className="lp-site-cover">
        <Image src={STOCK.embrace.src} alt="" fill sizes="620px" className="lp-site-cover-img" />
        <p className="lp-site-name">Studio Berg</p>
        <p className="lp-site-tagline">{t('landing.book.tagline')}</p>
      </div>
      <div className="lp-site-form">
        <div className="lp-site-title">{t('request.title')}</div>
        <div className="lp-site-grid">
          {fields.map((f) => (
            <div key={f.labelKey} className={f.wide ? 'lp-site-wide' : undefined}>
              <span className="lp-site-label">{t(f.labelKey)}</span>
              <span className="lp-site-input" data-select={f.select || undefined}>
                {f.value}
              </span>
            </div>
          ))}
        </div>
        <span className="lp-site-send">{t('request.send')}</span>
      </div>
    </div>
  );
}

function ResultCard() {
  const { t, format } = useTranslation();
  const steps = [
    { label: t('landing.hero.stepEnquiry'), value: t('landing.flow.enquiryData') },
    { label: t('landing.hero.stepContract'), value: `✓ ${format.dayMonth(SAMPLE.contractSigned)}` },
    { label: t('landing.hero.stepDeposit'), value: `✓ ${t('landing.hero.depositReceived')}` },
    {
      label: t('landing.hero.stepGallery'),
      value: t('landing.mock.photos', { count: format.number(SAMPLE.galleryPhotos) }),
    },
  ];
  return (
    <div className="lp-art-card lp-ui">
      <div className="lp-art-card-head">
        <Image src={STOCK_THUMB} alt="" width={44} height={44} className="lp-art-thumb" />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>Lena &amp; Kaan</div>
          <div className="lp-ui-muted" style={{ fontSize: '0.8rem' }}>
            {t('landing.mock.type.wedding')} · {format.dayMonth(SAMPLE.weddingDate)}
          </div>
        </div>
      </div>
      <ul className="lp-art-steps">
        {steps.map((s) => (
          <li key={s.label}>
            <span>{s.label}</span>
            <span className="lp-mono">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── A — Paper: the photograph is a framed object ─────────────────────── */

function VariantA() {
  return (
    <section className="proto-light proto-a" aria-labelledby="lp-hero-title">
      <div className="lp-wrap proto-hero">
        <Copy />
        <figure className="proto-a-art">
          <div className="proto-a-photo">
            <Image
              src={STOCK.sparks.src}
              alt=""
              fill
              priority
              sizes="520px"
              style={{ objectFit: 'cover' }}
            />
          </div>
          <BookingPage className="proto-a-site" />
        </figure>
      </div>
    </section>
  );
}

/* ── B — Light wash: the photograph is the room, washed with paper ─────── */

function VariantB() {
  return (
    <section className="proto-light proto-b" aria-labelledby="lp-hero-title">
      <Image
        src={STOCK.field.src}
        alt=""
        fill
        priority
        sizes="100vw"
        className="lp-hero-photo proto-b-room"
      />
      <div className="proto-b-scrim" aria-hidden="true" />
      {/* Decided on #80: on a phone the daylight photo is an unwashed band above the headline. */}
      <div className="proto-b-band" aria-hidden="true">
        <Image src={STOCK.field.src} alt="" fill sizes="100vw" style={{ objectFit: 'cover' }} />
      </div>
      <div className="lp-wrap proto-hero">
        <Copy />
        <figure className="lp-art">
          <BookingPage />
          <ResultCard />
        </figure>
      </div>
    </section>
  );
}

/* ── C — Split: paper | photograph, the booking page across the seam ──── */

function VariantC() {
  return (
    <section className="proto-light proto-c" aria-labelledby="lp-hero-title">
      <div className="proto-c-photo">
        <Image
          src={STOCK.sparks.src}
          alt=""
          fill
          priority
          sizes="50vw"
          style={{ objectFit: 'cover', objectPosition: '60% 40%' }}
        />
      </div>
      <div className="lp-wrap proto-hero">
        <Copy />
        <figure className="lp-art proto-c-art">
          <BookingPage />
          <ResultCard />
        </figure>
      </div>
    </section>
  );
}

export function PrototypeHero() {
  const variant = useVariant();
  const theme = useThemeStore((s) => s.theme);
  if (!variant) return <Hero />;
  return (
    <>
      {theme === 'dark' ? (
        <Hero />
      ) : variant === 'A' ? (
        <VariantA />
      ) : variant === 'B' ? (
        <VariantB />
      ) : (
        <VariantC />
      )}
      <PrototypeSwitcher
        variants={VARIANTS}
        current={variant}
        status={theme === 'dark' ? 'dark = today' : 'light'}
      />
    </>
  );
}
