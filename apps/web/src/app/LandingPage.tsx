'use client';

import { ComingSoon } from '@/components/ComingSoon';
import { FotolioLogo } from '@/components/FotolioLogo';
import { Icon, type IconName } from '@/components/Icon';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { getColors } from '@/lib/design-tokens';
import { useThemeStore } from '@/store/themeStore';
import { useTranslation, type TranslationKey } from '@/lib/i18n';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getLandingStyles, PHOTO_GRADIENTS } from './landing.styles';

// ── Content ─────────────────────────────────────────────────────────────
// Honest copy only: real product surfaces, no invented stats or client logos.

/**
 * The page's own sections, in the order they appear.
 *
 * <p>One list feeding three places — the desktop nav, the mobile menu and the
 * footer's Product column. They were three hand-written copies of the same four
 * anchors, which is how a fourth surface (the mobile menu) is easy to forget
 * and an anchor rename is easy to half-finish.
 */
const SECTIONS: { href: string; labelKey: TranslationKey }[] = [
  { href: '#features', labelKey: 'landing.nav.features' },
  { href: '#workflow', labelKey: 'landing.nav.howItWorks' },
  { href: '#pricing', labelKey: 'landing.nav.pricing' },
  { href: '#audience', labelKey: 'landing.nav.studio' },
];

// `soon` flags the surfaces that aren't live yet, so the marquee stays honest
// about what ships today vs. what's on the roadmap.
//
// The badge is only honest in the direction it was written for. Stripe payments
// (2026-08-18) and GoBD invoices both shipped and kept theirs, so the same
// screen told a visitor that "Karten & SEPA (2 %)" was included in Starter and
// that "Stripe-Zahlungen" was not built — understating the product to the one
// person being asked to pay for it. docs/PRICING.md §"What the landing page
// sells vs. what is built" is the source of truth; check a badge against that
// table before adding or keeping one.
const CAPABILITIES: { labelKey: TranslationKey; soon?: boolean }[] = [
  { labelKey: 'landing.cap.leadScoring' },
  { labelKey: 'landing.cap.onlineBooking' },
  { labelKey: 'landing.cap.esign', soon: true },
  { labelKey: 'landing.cap.stripe' },
  { labelKey: 'landing.cap.galleries' },
  { labelKey: 'landing.cap.invoices' },
  { labelKey: 'landing.cap.bilingual' },
];

// A slice of the real product — this week's bookings with their live states.
// The names and dates are translation keys for the same reason the feature
// previews' are: hardcoded English weekdays under German marketing copy tell a
// German photographer, above the fold, that the product was built for someone
// else.
const BOOKINGS: {
  initials: string;
  gradient: string;
  nameKey: TranslationKey;
  metaKey: TranslationKey;
  labelKey: TranslationKey;
  tone: 'conf' | 'paid' | 'pend';
}[] = [
  {
    initials: 'LK',
    gradient: 'linear-gradient(135deg, #7A66F5, #B06BE0)',
    nameKey: 'landing.booking.n1Name',
    metaKey: 'landing.booking.n1Meta',
    labelKey: 'landing.booking.confirmed',
    tone: 'conf',
  },
  {
    initials: 'MB',
    gradient: 'linear-gradient(135deg, #4C8DE0, #6E56F0)',
    nameKey: 'landing.booking.n2Name',
    metaKey: 'landing.booking.n2Meta',
    labelKey: 'landing.booking.depositPaid',
    tone: 'paid',
  },
  {
    initials: 'JT',
    gradient: 'linear-gradient(135deg, #0EA5E9, #6366F1)',
    nameKey: 'landing.booking.n3Name',
    metaKey: 'landing.booking.n3Meta',
    labelKey: 'landing.booking.contractSent',
    tone: 'pend',
  },
];

// Ordered lifecycle — every booking moves through these five stages in order,
// so the numbering encodes a real sequence rather than decoration.
const PIPELINE: {
  icon: IconName;
  titleKey: TranslationKey;
  textKey: TranslationKey;
  soon?: boolean;
}[] = [
  {
    icon: 'target',
    titleKey: 'landing.pipeline.enquiryTitle',
    textKey: 'landing.pipeline.enquiryText',
  },
  {
    icon: 'calendar',
    titleKey: 'landing.pipeline.bookingTitle',
    textKey: 'landing.pipeline.bookingText',
  },
  {
    icon: 'contract',
    titleKey: 'landing.pipeline.contractTitle',
    textKey: 'landing.pipeline.contractText',
    soon: true,
  },
  {
    icon: 'card',
    titleKey: 'landing.pipeline.paymentTitle',
    textKey: 'landing.pipeline.paymentText',
  },
  {
    icon: 'gallery',
    titleKey: 'landing.pipeline.galleryTitle',
    textKey: 'landing.pipeline.galleryText',
  },
];

/**
 * What the photographer walks away with.
 *
 * <p>Each line pairs the outcome with the detail that makes it concrete. The
 * list this replaces re-stated the feature cards above it in fewer words and
 * with a green tick against items marked "Soon" — telling the reader the same
 * thing was both shipped and unbuilt. Everything here is live today.
 *
 * <p>The icon names the surface the outcome lives on. Four identical ticks
 * carried no information and borrowed the pricing table's "included in your
 * plan" language one screen above the pricing table.
 */
const STUDIO_OUTCOMES: { icon: IconName; titleKey: TranslationKey; textKey: TranslationKey }[] = [
  {
    icon: 'globe',
    titleKey: 'landing.studio.portfolioTitle',
    textKey: 'landing.studio.portfolioText',
  },
  { icon: 'target', titleKey: 'landing.studio.leadsTitle', textKey: 'landing.studio.leadsText' },
  {
    icon: 'gallery',
    titleKey: 'landing.studio.galleriesTitle',
    textKey: 'landing.studio.galleriesText',
  },
  { icon: 'user', titleKey: 'landing.studio.dataTitle', textKey: 'landing.studio.dataText' },
];

/**
 * The client's side of the same product — an argument aimed at the
 * photographer, not a second audience being sold to.
 *
 * <p>It carries no call to action of its own. The "Find a photographer" button
 * that used to sit under this list linked to the customer sign-in form,
 * because there is no photographer directory to send anyone to; a visitor who
 * clicked it was asked to log in to an account they had no way to hold. It
 * also split the conversion path one screen above the pricing table, on a page
 * whose buyer is the photographer.
 */
const CLIENT_EXPERIENCE: { icon: IconName; labelKey: TranslationKey }[] = [
  { icon: 'calendar', labelKey: 'landing.clientExp.book' },
  { icon: 'gallery', labelKey: 'landing.clientExp.gallery' },
  { icon: 'globe', labelKey: 'landing.clientExp.link' },
];

// Frame number + orientation, so the mock reads as a real gallery that mixes
// portrait and landscape shots rather than a uniform grid of squares.
const GALLERY_FRAMES: {
  no: string;
  ar: string;
  /**
   * Photograph for this slot, once one has been licensed and committed.
   *
   * <p>Every frame used to name a file under `public/brand/gallery`, and none
   * of those files was ever committed — so each load of the landing page fired
   * eight requests that 404'd before falling back to the gradient underneath.
   * A path here is a promise that the file exists; add the JPEG first, then the
   * `src`. See `public/brand/gallery/README.md` for the sizes and the licence
   * question, which is the actual blocker.
   */
  src?: string;
  fav?: boolean;
  selected?: boolean;
}[] = [
  { no: '24A', ar: '3 / 4', fav: true },
  { no: '25', ar: '1 / 1' },
  { no: '26', ar: '1 / 1', selected: true },
  { no: '27', ar: '4 / 5' },
  { no: '28', ar: '1 / 1' },
  { no: '29', ar: '3 / 4', fav: true },
  { no: '30', ar: '4 / 5' },
  { no: '31', ar: '1 / 1' },
];

// Mirrors docs/PRICING.md. That document is the spec — this array must not
// drift from it, because whatever is listed here is a promise to a customer.
//
// Two placements are deliberate and load-bearing (PRICING.md §4/§5):
//   - Stripe deposits sit in STARTER, not Pro. Every plan can take money; the
//     Starter photographer pays a commission on it and Pro pays none. Locking
//     payments away from Starter would mean they never see the core value, so
//     they would never upgrade at all.
//   - CRM sits in Starter because a client list is table stakes, not a growth
//     feature.
// The 2% Starter commission is stated in the label rather than buried, because
// it is the thing a photographer will compare against Pro; the footnote adds
// that it sits on top of Stripe's own fee.
//
// Both payment rows lost their "soon" badge on 2026-08-18, when card/SEPA
// shipped on Stripe Connect Express. The three gallery-retention rows lost
// theirs on 2026-08-22, when the expiry job landed (ADR-001) — retention is the
// value metric these plans are priced on, so leaving all three badged as
// unbuilt meant the one axis that separates the tiers read as vapour on every
// card at once.
//
// Studio's seats lost theirs when staff invitations shipped (V25). Until then
// Studio was the weakest card on the page: three of its five rows were badged,
// and the only thing it actually gave you over Pro was one more year of
// retention for another €40 a month.
//
// Labels answer "what do I actually get?" for a first-time visitor — no
// internal jargon ("lead", "portfolio & website"). They stay short because a
// pricing bullet is scanned, not read, and the row lays its check icon out with
// `alignItems: center`, so a wrapped label breaks the alignment. Detail that
// does not fit goes in the footnote.
//
// `id` is the plan the CTA carries to /register?plan=… so the visitor lands on
// a page that confirms the plan they picked. Keep it in sync with the DB's
// CHECK constraint on tenants.plan (STARTER | PRO | STUDIO).
const PRICING: {
  id: 'starter' | 'pro' | 'studio';
  tier: string;
  monthly: string;
  yearly: string;
  highlighted: boolean;
  features: { labelKey: TranslationKey; soon?: boolean; footnote?: boolean }[];
}[] = [
  {
    // Retention — not gigabytes — is the value metric: storage is production ×
    // retention, so the time window already prices the space, and a
    // photographer can reason about "60 days" but not about "30 GB". The GB
    // caps still exist as a fair-use guard, documented in docs/PRICING.md §7.4
    // rather than sold here.
    id: 'starter',
    tier: 'Starter',
    monthly: '19',
    yearly: '16',
    highlighted: false,
    features: [
      { labelKey: 'landing.price.f.portfolioWebsite' },
      { labelKey: 'landing.price.f.leadMgmt' },
      { labelKey: 'landing.price.f.onlineBookings' },
      { labelKey: 'landing.price.f.crm' },
      { labelKey: 'landing.price.f.stripeDeposits', footnote: true },
      { labelKey: 'landing.price.f.retention60' },
    ],
  },
  {
    // Ordered strongest-first: Instagram DM automation is the one thing no
    // competitor has (ROADMAP §4.5); 0% commission is the arithmetic that makes
    // the upgrade pay for itself.
    id: 'pro',
    tier: 'Pro',
    monthly: '39',
    yearly: '32',
    highlighted: true,
    features: [
      { labelKey: 'landing.price.f.everythingStarter' },
      { labelKey: 'landing.price.f.instagramDm', soon: true },
      { labelKey: 'landing.price.f.zeroCommission' },
      { labelKey: 'landing.price.f.contractsEsign', soon: true },
      { labelKey: 'landing.price.f.retention1y' },
    ],
  },
  {
    id: 'studio',
    tier: 'Studio',
    monthly: '79',
    yearly: '65',
    highlighted: false,
    features: [
      { labelKey: 'landing.price.f.everythingPro' },
      { labelKey: 'landing.price.f.upTo3' },
      { labelKey: 'landing.price.f.analytics', soon: true },
      { labelKey: 'landing.price.f.whiteLabel', soon: true },
      { labelKey: 'landing.price.f.retention2y' },
    ],
  },
];

export default function LandingPage() {
  const { theme } = useThemeStore();
  const c = getColors(theme);
  const s = getLandingStyles(theme);
  const { t, format } = useTranslation();
  const year = new Date().getFullYear();

  const [yearly, setYearly] = useState(false);

  // The mobile section menu. Closes on Escape as well as on a link, so it is
  // dismissable from the keyboard without hunting for the toggle.
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // Nav gains a shadow + stronger backdrop once the page scrolls past the hero,
  // so the sticky bar reads as a floating layer rather than a flat strip.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll-reveal — reveal below-the-fold blocks as they enter the viewport.
  //
  // The hidden starting state is gated on `html.js`, which the inline script in
  // the root layout sets before first paint. It cannot be armed from here: a
  // class added after mount would hide blocks that had already painted, so the
  // page would flash visible-then-hidden before the observer revealed them
  // again. Gating it in the stylesheet without that flag was the other failure
  // — everything below the hero stayed at `opacity: 0` whenever the bundle did
  // not execute.
  useEffect(() => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>('.landing-reveal, .landing-reveal-stagger')
    );
    if (typeof IntersectionObserver === 'undefined') {
      els.forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const statusStyle = (tone: 'conf' | 'paid' | 'pend') =>
    tone === 'conf' ? s.statusConf : tone === 'paid' ? s.statusPaid : s.statusPend;

  /**
   * A plan's headline price, with the € on the side the active locale puts it.
   *
   * <p>It was a literal `€` in front of the digits, which is the English form —
   * German writes `19 €`. Two spans rather than one formatted string because
   * the card sets the digits in display-size serif and the symbol small, so
   * `eurParts` supplies Intl's ordering while each half keeps its own type.
   *
   * <p>The symbol is a raised superscript only when it leads. Trailing, German
   * sets it on the baseline beside the number, and a raised € after the digits
   * reads as a footnote marker rather than a currency.
   */
  const priceAmount = (euros: string) => {
    const { symbol, value, symbolFirst } = format.eurParts(Number(euros) * 100);
    const cur = (
      <span
        style={
          symbolFirst
            ? s.amountCur
            : // The 2px flex gap is right between digits and "/mo"; German's
              // number–symbol pair needs the wider space Intl puts there.
              { ...s.amountCur, alignSelf: 'baseline', marginTop: 0, marginLeft: 4 }
        }
      >
        {symbol}
      </span>
    );
    return (
      <div style={s.amount}>
        {symbolFirst && cur}
        <span style={s.amountVal}>{value}</span>
        {!symbolFirst && cur}
        <span style={s.amountPer}>{t('landing.pricing.perMonth')}</span>
      </div>
    );
  };

  return (
    <div className="landing-root" style={s.page}>
      <div
        className="landing-grain"
        style={{ opacity: c.isDark ? 0.06 : 0.035 }}
        aria-hidden="true"
      />

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav style={{ ...s.navbar, ...(scrolled ? s.navbarScrolled : {}) }}>
        <div style={s.navInner}>
          <Link href="/" style={s.navLogo} aria-label={t('landing.aria.home')}>
            <FotolioLogo theme={theme} variant="brand" showText={true} />
          </Link>

          <div style={s.navLinks} className="landing-nav-links">
            {SECTIONS.map((sec) => (
              <a key={sec.href} href={sec.href} style={s.navLink}>
                {t(sec.labelKey)}
              </a>
            ))}
          </div>

          <div style={s.navRight}>
            <LanguageToggle variant="pill" />
            <ThemeToggle variant="pill" />
            <Link href="/login" style={s.navSignIn} className="landing-nav-signin">
              {t('landing.nav.signIn')}
            </Link>
            <Link
              href="/register"
              className="landing-btn landing-btn-primary"
              style={{ padding: '10px 18px', fontSize: '0.88rem' }}
            >
              {t('landing.nav.getStarted')}
            </Link>

            {/* Below 860px the section links collapse behind this. They were
                simply `display: none` with nothing in their place, so the whole
                in-page nav did not exist on a phone — the audience this page is
                most likely to be opened by. */}
            <button
              type="button"
              className="landing-nav-menu-btn"
              style={s.navMenuBtn}
              aria-label={t(menuOpen ? 'landing.aria.closeMenu' : 'landing.aria.openMenu')}
              aria-expanded={menuOpen}
              aria-controls="landing-mobile-menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Icon name={menuOpen ? 'close' : 'menu'} size={20} strokeWidth={2} />
            </button>
          </div>
        </div>

        {menuOpen && (
          <div
            id="landing-mobile-menu"
            className="landing-nav-menu"
            style={s.navMenu}
            aria-label={t('landing.aria.sections')}
          >
            {SECTIONS.map((sec) => (
              <a
                key={sec.href}
                href={sec.href}
                style={s.navMenuLink}
                onClick={() => setMenuOpen(false)}
              >
                {t(sec.labelKey)}
                <Icon name="arrow-right" size={15} strokeWidth={2} />
              </a>
            ))}
            <Link href="/login" style={s.navMenuLink} onClick={() => setMenuOpen(false)}>
              {t('landing.nav.signIn')}
              <Icon name="arrow-right" size={15} strokeWidth={2} />
            </Link>
          </div>
        )}
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <header style={s.hero} id="top">
        <span className="landing-aurora" style={s.heroAurora} aria-hidden="true" />
        <span style={s.heroGlow} aria-hidden="true" />
        <span style={s.heroBg} aria-hidden="true" />
        <div className="landing-hero-grid" style={s.heroInner}>
          <div>
            <span style={s.pill}>
              <span style={s.pillFlag} aria-hidden="true">
                <i style={{ flex: 1, background: '#191919' }} />
                <i style={{ flex: 1, background: '#d1252b' }} />
                <i style={{ flex: 1, background: '#f2c200' }} />
              </span>
              <b style={{ color: c.text, fontWeight: 600 }}>Made in Germany</b> · DSGVO-konform
            </span>

            <h1 style={s.heroTitle}>
              {t('landing.hero.title1')}
              <br />
              {t('landing.hero.title2pre')}
              <span className="landing-accent-shimmer" style={s.heroAccent}>
                {t('landing.hero.title2accent')}
              </span>
              .
            </h1>

            <p style={s.lede}>{t('landing.hero.lede')}</p>

            <div style={s.heroCta}>
              <Link href="/register" className="landing-btn landing-btn-primary">
                {t('landing.hero.ctaPrimary')}
                <Icon name="arrow-right" size={16} strokeWidth={2} />
              </Link>
              <a
                href="#workflow"
                style={s.btnOutline}
                onMouseEnter={(e) => (e.currentTarget.style.background = c.surfaceHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {t('landing.hero.ctaSecondary')}
              </a>
            </div>

            <div style={s.heroMicro}>
              {[t('landing.hero.microNoCard'), t('landing.hero.microCancel')].map((item) => (
                <span key={item} style={s.heroMicroItem}>
                  <span style={{ color: c.success, display: 'flex' }}>
                    <Icon name="check" size={15} strokeWidth={2.6} />
                  </span>
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Product mockup */}
          <div className="landing-hero-visual">
            <div style={s.mock} role="img" aria-label={t('landing.aria.mockPreview')}>
              <div style={s.mockTop}>
                <div style={s.dots} aria-hidden="true">
                  <span style={s.dot} />
                  <span style={s.dot} />
                  <span style={s.dot} />
                </div>
                <div style={s.mockTab}>
                  <span style={s.live} />
                  Fotolio · Bookings
                </div>
              </div>

              <div style={s.mockTitle}>
                <h4 style={s.mockTitleH}>{t('landing.hero.mockThisWeek')}</h4>
                <span style={s.mockChip}>
                  {t('landing.hero.mockExpected', { amount: format.eur(124_000) })}
                </span>
              </div>

              {BOOKINGS.map((b, i) => (
                <div
                  key={b.nameKey}
                  style={{ ...s.row, ...(i === BOOKINGS.length - 1 ? { marginBottom: 0 } : {}) }}
                >
                  <span style={{ ...s.avatar, background: b.gradient }}>{b.initials}</span>
                  <span style={s.rowInfo}>
                    <span style={s.rowName}>{t(b.nameKey)}</span>
                    <span style={s.rowMeta}>{t(b.metaKey)}</span>
                  </span>
                  <span style={{ ...s.status, ...statusStyle(b.tone) }}>{t(b.labelKey)}</span>
                </div>
              ))}

              <div className="landing-float" style={s.toast}>
                <span style={s.toastTick} aria-hidden="true">
                  <Icon name="check" size={18} strokeWidth={2.4} />
                </span>
                <div>
                  <span style={s.toastB}>{t('landing.hero.toastTitle')}</span>
                  <span style={s.toastSpan}>
                    {t('landing.hero.toastMeta', { amount: format.eur(48_000) })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Capability strip ────────────────────────────────────── */}
      <div style={s.strip} aria-hidden="true">
        <div className="landing-marquee">
          {[...CAPABILITIES, ...CAPABILITIES].map((cap, i) => (
            <span key={`${cap.labelKey}-${i}`} style={s.stripItem}>
              <span style={s.stripDiamond}>◆</span>
              {t(cap.labelKey)}
              {cap.soon && <ComingSoon size="sm" style={{ marginLeft: 8 }} />}
            </span>
          ))}
        </div>
      </div>

      {/* ── Features (bento) ────────────────────────────────────── */}
      <section id="features" style={s.section}>
        <div className="landing-reveal" style={s.headCenter}>
          <span style={s.eyebrow}>
            <span style={s.eyebrowLine} />
            {t('landing.features.eyebrow')}
            <span style={s.eyebrowLine} />
          </span>
          <h2 style={s.sectionTitle}>{t('landing.features.title')}</h2>
          <p style={s.sectionSub}>{t('landing.features.sub')}</p>
        </div>

        <div className="landing-bento landing-reveal-stagger">
          {/* Hero tile — galleries */}
          <div className="tile-big landing-card-hover" style={s.tileBig}>
            <div style={s.bigBody}>
              <h3 style={s.bigTitle}>{t('landing.features.galleriesTitle')}</h3>
              <p style={s.bigText}>{t('landing.features.galleriesText')}</p>
            </div>
            <div style={s.galleryPrevWrap}>
              <div style={s.galleryBar}>
                <div>
                  <p style={s.galleryBarName}>{t('landing.features.galleryBarName')}</p>
                  <span style={s.galleryBarMeta}>{t('landing.features.galleryBarMeta')}</span>
                </div>
                <span style={s.galleryBarAction}>
                  <Icon name="check" size={14} strokeWidth={2.25} />
                  {t('landing.features.downloadAll')}
                </span>
              </div>
              <div className="landing-gallery-prev">
                {GALLERY_FRAMES.map((frame, i) => (
                  <div
                    key={frame.no}
                    style={{
                      ...s.gp,
                      aspectRatio: frame.ar,
                      // Two layers where a photograph exists: the image, and
                      // the duotone gradient underneath it. Naming a file that
                      // is not on disk still costs a failed request per frame,
                      // so a frame with no `src` paints the gradient alone.
                      backgroundImage: frame.src
                        ? `url('${frame.src}'), ${PHOTO_GRADIENTS[i % PHOTO_GRADIENTS.length]}`
                        : PHOTO_GRADIENTS[i % PHOTO_GRADIENTS.length],
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    <span style={s.gpShade} />
                    {frame.fav && (
                      <span style={s.gpFav} aria-hidden="true">
                        <Icon name="heart" size={16} strokeWidth={0} style={{ fill: '#fff' }} />
                      </span>
                    )}
                    {frame.selected && (
                      <>
                        <span style={s.gpSel} aria-hidden="true" />
                        <span style={s.gpCheck} aria-hidden="true">
                          <Icon name="check" size={13} strokeWidth={2.5} />
                        </span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* The remaining five tiles, in grid order. Contracts is the only one
              still being built; it looks like every other card because it will
              be every other card — what marks it out is the badge, not a
              downgraded box.

              What it does *not* get is a preview: mocking up a "Signed · 12 Jul"
              row for a feature that cannot collect a signature is the one thing
              an honest roadmap card must not do. Payments carried that same
              restriction until card/SEPA shipped on 2026-08-18 — a card earns
              its preview by shipping, so that is the moment to add one, and the
              moment the badge has to come off. */}
          {[
            {
              key: 'bookings',
              title: t('landing.features.bookingsTitle'),
              soon: false,
              text: t('landing.features.bookingsText'),
              visual: (
                <div style={s.mini}>
                  <div style={s.miniRowActive}>
                    <span style={s.miniLabel}>{t('landing.features.slotBooked')}</span>
                    <span style={s.miniPillSuccess}>
                      <Icon name="check" size={11} strokeWidth={2.5} />{' '}
                      {t('landing.features.booked')}
                    </span>
                  </div>
                  <div style={s.miniRow}>
                    <span style={s.miniLabel}>{t('landing.features.slotOpen')}</span>
                    <span style={s.miniPillNeutral}>{t('landing.features.open')}</span>
                  </div>
                  <div style={s.miniRow}>
                    <span style={s.miniLabel}>{t('landing.features.slotOpenLate')}</span>
                    <span style={s.miniPillNeutral}>{t('landing.features.open')}</span>
                  </div>
                </div>
              ),
            },
            {
              key: 'leads',
              title: t('landing.features.leadTitle'),
              soon: false,
              text: t('landing.features.leadText'),
              visual: (
                <div style={s.mini}>
                  <div style={s.miniRowActive}>
                    <span style={s.miniLabel}>{t('landing.features.leadHotName')}</span>
                    <span style={s.miniPillPrimary}>{t('landing.features.leadHot')}</span>
                  </div>
                  <div style={s.miniRow}>
                    <span style={s.miniLabel}>{t('landing.features.leadWarmName')}</span>
                    <span style={s.miniPillNeutral}>{t('landing.features.leadWarm')}</span>
                  </div>
                  <div style={s.miniRow}>
                    <span style={s.miniLabel}>{t('landing.features.leadColdName')}</span>
                    <span style={s.miniPillNeutral}>{t('landing.features.leadCold')}</span>
                  </div>
                </div>
              ),
            },
            {
              key: 'contracts',
              title: t('landing.features.contractsTitle'),
              soon: true,
              text: t('landing.features.contractsText'),
              visual: null,
            },
            {
              key: 'stripe',
              title: t('landing.features.stripeTitle'),
              soon: false,
              text: t('landing.features.stripeText'),
              visual: (
                <div style={s.mini}>
                  <div style={s.miniRowActive}>
                    <span style={s.miniLabel}>
                      {t('landing.features.payDeposit', { amount: format.eur(48_000) })}
                    </span>
                    <span style={s.miniPillSuccess}>
                      <Icon name="check" size={11} strokeWidth={2.5} /> {t('landing.features.paid')}
                    </span>
                  </div>
                  <div style={s.miniRow}>
                    <span style={s.miniLabel}>
                      {t('landing.features.payBalance', { amount: format.eur(72_000) })}
                    </span>
                    <span style={s.miniPillNeutral}>{t('landing.features.open')}</span>
                  </div>
                  <div style={s.miniRow}>
                    <span style={s.miniLabel}>{t('landing.features.payMethods')}</span>
                    <span style={s.miniPillNeutral}>{t('landing.features.payEnabled')}</span>
                  </div>
                </div>
              ),
            },
            {
              key: 'german',
              title: t('landing.features.germanTitle'),
              soon: false,
              text: t('landing.features.germanText'),
              visual: (
                <div style={{ ...s.mini, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <span style={s.miniPillSuccess}>
                    <Icon name="check" size={11} strokeWidth={2.5} /> DSGVO
                  </span>
                  <span style={s.miniPillSuccess}>
                    <Icon name="check" size={11} strokeWidth={2.5} /> GoBD
                  </span>
                  <span style={s.miniPillNeutral}>Kleinunternehmer §19</span>
                </div>
              ),
            },
          ].map((f) => (
            <div key={f.key} className="landing-card-hover" style={s.tile}>
              <div style={s.tileHead}>
                <h3 style={s.tileTitle}>
                  {f.title}
                  {f.soon && <ComingSoon size="md" style={{ marginLeft: 8 }} />}
                </h3>
                <p style={s.tileText}>{f.text}</p>
              </div>
              {f.visual}
            </div>
          ))}
        </div>
      </section>

      {/* ── Workflow band ───────────────────────────────────────── */}
      <section id="workflow" style={s.band}>
        <span style={s.bandGlow} aria-hidden="true" />
        <div style={s.section}>
          <div className="landing-reveal" style={s.headCenter}>
            <span style={s.eyebrow}>
              <span style={s.eyebrowLine} />
              {t('landing.workflow.eyebrow')}
              <span style={s.eyebrowLine} />
            </span>
            <h2 style={s.sectionTitle}>{t('landing.workflow.title')}</h2>
            <p style={s.sectionSub}>{t('landing.workflow.sub')}</p>
          </div>

          <div className="landing-flow landing-reveal-stagger">
            {PIPELINE.map((step, i) => (
              <div key={step.titleKey} className="landing-card-hover" style={s.step}>
                <div style={s.stepNo}>
                  {String(i + 1).padStart(2, '0')}
                  <span style={s.stepNoLine} />
                </div>
                <div style={s.stepIcon}>
                  <Icon name={step.icon} size={19} />
                </div>
                <h4 style={s.stepH}>
                  {t(step.titleKey)}
                  {step.soon && <ComingSoon size="sm" style={{ marginLeft: 8 }} />}
                </h4>
                <p style={s.stepP}>{t(step.textKey)}</p>
                {i < PIPELINE.length - 1 && (
                  <span className="landing-warr" style={s.warr} aria-hidden="true">
                    <Icon name="arrow-right" size={22} strokeWidth={2.4} />
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Audience split ──────────────────────────────────────── */}
      <section id="audience" style={s.section}>
        <div className="landing-reveal" style={s.headCenter}>
          <span style={s.eyebrow}>
            <span style={s.eyebrowLine} />
            {t('landing.audience.eyebrow')}
            <span style={s.eyebrowLine} />
          </span>
          <h2 style={s.sectionTitle}>{t('landing.audience.title')}</h2>
          <p style={s.sectionSub}>{t('landing.audience.sub')}</p>
        </div>

        {/* Primary card: the photographer's own outcome. It hands off to the
            pricing table below rather than carrying a fourth copy of the
            page's primary CTA. */}
        <div className="landing-reveal" style={s.studioCard}>
          <div className="landing-studio-grid">
            {STUDIO_OUTCOMES.map((o) => (
              <div key={o.titleKey} style={s.outcome}>
                <span style={s.outcomeIcon} aria-hidden="true">
                  <Icon name={o.icon} size={17} />
                </span>
                <span>
                  <span style={s.outcomeTitle}>{t(o.titleKey)}</span>
                  <span style={s.outcomeText}>{t(o.textKey)}</span>
                </span>
              </div>
            ))}
          </div>
          <div style={s.studioCta}>
            <a href="#pricing" className="landing-textlink" style={s.studioLink}>
              {t('landing.audience.seePricing')}
              <Icon name="arrow-right" size={16} strokeWidth={2} />
            </a>
          </div>
        </div>

        {/* Secondary, deliberately quieter: the client experience is the
            photographer's reason to buy, not a second thing being sold. */}
        <div className="landing-reveal" style={s.clientCard}>
          <h3 style={s.clientTitle}>{t('landing.audience.clientTitle')}</h3>
          <div className="landing-client-grid">
            {CLIENT_EXPERIENCE.map((ce) => (
              <div key={ce.labelKey} style={s.clientItem}>
                <span style={s.clientIcon} aria-hidden="true">
                  <Icon name={ce.icon} size={17} />
                </span>
                {t(ce.labelKey)}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────── */}
      {/* Trimmed bottom padding (vs the shared 100px) so the cards + footnote
          sit closer to the closing CTA instead of leaving a large void. */}
      <section id="pricing" style={{ ...s.section, paddingBottom: 44 }}>
        <div className="landing-reveal" style={s.headCenter}>
          <span style={s.eyebrow}>
            <span style={s.eyebrowLine} />
            {t('landing.pricing.eyebrow')}
            <span style={s.eyebrowLine} />
          </span>
          <h2 style={s.sectionTitle}>{t('landing.pricing.title')}</h2>
          <p style={s.sectionSub}>{t('landing.pricing.sub')}</p>

          {/* `radiogroup`, not `tablist`: these are two values of one setting,
              not two panels. As tabs they promised a `tabpanel` that does not
              exist, so a screen reader announced "tab 1 of 2" and then found
              nothing the tab controlled. */}
          <div style={s.priceSwitch} role="radiogroup" aria-label={t('landing.aria.billingPeriod')}>
            <button
              type="button"
              role="radio"
              aria-checked={!yearly}
              onClick={() => setYearly(false)}
              style={{ ...s.priceSwitchBtn, ...(!yearly ? s.priceSwitchBtnOn : {}) }}
            >
              {t('landing.pricing.monthly')}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={yearly}
              onClick={() => setYearly(true)}
              style={{ ...s.priceSwitchBtn, ...(yearly ? s.priceSwitchBtnOn : {}) }}
            >
              {t('landing.pricing.yearly')}
              <span style={s.priceSave}>{t('landing.pricing.save')}</span>
            </button>
          </div>

          {/* Sits with the prices rather than in the footnote: PAngV wants the
              VAT statement next to the figure it qualifies, and a page that
              says nothing implicitly claims €19 is what leaves your account. */}
          <p style={s.priceVatNote}>{t('landing.pricing.vatNote')}</p>
        </div>

        <div className="landing-prices landing-reveal-stagger" style={s.pricesWrap}>
          {PRICING.map((plan) => (
            <div
              key={plan.tier}
              className="landing-card-hover"
              style={{ ...s.priceCard, ...(plan.highlighted ? s.priceCardHot : {}) }}
            >
              {plan.highlighted && (
                <div style={s.priceBadge}>{t('landing.pricing.mostPopular')}</div>
              )}

              <div style={{ ...s.tier, ...(plan.highlighted ? s.tierPro : {}) }}>{plan.tier}</div>
              {priceAmount(yearly ? plan.yearly : plan.monthly)}
              <div style={s.billed}>
                {yearly ? t('landing.pricing.billedYearly') : t('landing.pricing.billedMonthly')}
              </div>

              {/* Carry the picked plan to registration. Without this the CTA is
                  decorative: all three cards land on the same page and every
                  signup silently becomes STARTER, so a visitor who clicked
                  Studio has no idea they didn't get it. */}
              {plan.highlighted ? (
                <Link
                  href={`/register?plan=${plan.id}`}
                  className="landing-btn landing-btn-primary"
                  style={{ width: '100%' }}
                >
                  {t('landing.pricing.getStarted')}
                </Link>
              ) : (
                <Link
                  href={`/register?plan=${plan.id}`}
                  style={{ ...s.btnOutline, width: '100%' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = c.surfaceHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {t('landing.pricing.getStarted')}
                </Link>
              )}

              {/* A shipped row gets the filled tick; a roadmap row gets a hollow
                  dot and the badge. They used to share one tick, so a Studio
                  card read "✓ Up to 3 photographers · SOON" — the tick saying
                  included, the badge saying unbuilt, on one line. The audience
                  section above dropped exactly this pairing; the pricing table
                  is where it is most expensive, because here the reader is
                  deciding what they are paying for. */}
              <ul style={s.priceFeatures}>
                {plan.features.map((feat) => (
                  <li key={feat.labelKey} style={s.priceItem}>
                    <span style={feat.soon ? s.priceChkSoon : s.priceChk} aria-hidden="true">
                      {!feat.soon && <Icon name="check" size={12} strokeWidth={2.8} />}
                    </span>
                    <span style={feat.soon ? s.priceLabelSoon : undefined}>
                      {t(feat.labelKey)}
                      {feat.footnote && <span style={s.priceFootMark}>*</span>}
                    </span>
                    {feat.soon && <ComingSoon size="sm" style={{ marginLeft: 8 }} />}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p style={s.priceFootnote}>{t('landing.pricing.feeNote')}</p>
      </section>

      {/* ── Closing CTA ─────────────────────────────────────────── */}
      {/* No eyebrow: the mono-and-hairlines label is the device that opens
          every section above, and here it restated the headline under it —
          two labels for one message, on the page's last block. */}
      <section style={s.ctaSection}>
        <span className="landing-cta-aurora" style={s.ctaAurora} aria-hidden="true" />
        <span style={s.ctaGrid} aria-hidden="true" />
        <div className="landing-reveal" style={s.ctaInner}>
          <h2 style={s.ctaTitle}>
            {t('landing.cta.titlePre')}
            <span className="landing-accent-shimmer" style={s.heroAccent}>
              {t('landing.cta.titleAccent')}
            </span>
            .
          </h2>
          <p style={s.ctaText}>{t('landing.cta.text')}</p>
          <div style={s.ctaActions}>
            <Link href="/register" className="landing-btn landing-btn-primary">
              {t('landing.cta.button')}
              <Icon name="arrow-right" size={18} strokeWidth={2} />
            </Link>
          </div>
          <div style={s.ctaMicro}>{t('landing.cta.micro')}</div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer style={s.footer}>
        <span style={s.footTopAccent} aria-hidden="true" />
        <div style={s.footerInner}>
          <div style={s.footGrid}>
            <div style={s.footBrand}>
              <Link href="/" style={s.navLogo} aria-label={t('landing.aria.home')}>
                <FotolioLogo variant="brand" theme={theme} showText={true} />
              </Link>
              <p style={s.footBrandP}>{t('landing.footer.brandText')}</p>
            </div>

            <div style={s.footCol}>
              <h5 style={s.footColH}>{t('landing.footer.product')}</h5>
              {SECTIONS.map((sec) => (
                <a key={sec.href} href={sec.href} style={s.footLink}>
                  {t(sec.labelKey)}
                </a>
              ))}
            </div>
            <div style={s.footCol}>
              <h5 style={s.footColH}>{t('landing.footer.account')}</h5>
              <Link href="/login" style={s.footLink}>
                {t('landing.nav.signIn')}
              </Link>
              <Link href="/register" style={s.footLink}>
                {t('landing.nav.getStarted')}
              </Link>
              <Link href="/customer/auth/login" style={s.footLink}>
                {t('landing.nav.clientSignIn')}
              </Link>
            </div>
            <div style={s.footCol}>
              <h5 style={s.footColH}>{t('landing.footer.legal')}</h5>
              <Link href="/impressum" style={s.footLink}>
                Impressum
              </Link>
              <Link href="/datenschutz" style={s.footLink}>
                Datenschutz
              </Link>
              <Link href="/agb" style={s.footLink}>
                AGB
              </Link>
            </div>
          </div>

          <div style={s.footBottom}>
            <span>{t('landing.footer.rights', { year: String(year) })}</span>
            <span>{t('landing.footer.made')}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
