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

// `soon` flags the surfaces that aren't live yet, so the marquee stays honest
// about what ships today vs. what's on the roadmap.
const CAPABILITIES: { labelKey: TranslationKey; soon?: boolean }[] = [
  { labelKey: 'landing.cap.leadScoring' },
  { labelKey: 'landing.cap.onlineBooking' },
  { labelKey: 'landing.cap.esign', soon: true },
  { labelKey: 'landing.cap.stripe', soon: true },
  { labelKey: 'landing.cap.galleries' },
  { labelKey: 'landing.cap.invoices', soon: true },
  { labelKey: 'landing.cap.bilingual' },
];

// A slice of the real product — this week's bookings with their live states.
const BOOKINGS: {
  initials: string;
  gradient: string;
  name: string;
  meta: string;
  labelKey: TranslationKey;
  tone: 'conf' | 'paid' | 'pend';
}[] = [
  {
    initials: 'LK',
    gradient: 'linear-gradient(135deg, #7A66F5, #B06BE0)',
    name: 'Lena & Kaan — Wedding',
    meta: 'Sat 12 Jul · Grugapark, Essen',
    labelKey: 'landing.booking.confirmed',
    tone: 'conf',
  },
  {
    initials: 'MB',
    gradient: 'linear-gradient(135deg, #4C8DE0, #6E56F0)',
    name: 'Meyer Family — Portrait',
    meta: 'Sun 13 Jul · Studio',
    labelKey: 'landing.booking.depositPaid',
    tone: 'paid',
  },
  {
    initials: 'JT',
    gradient: 'linear-gradient(135deg, #0EA5E9, #6366F1)',
    name: 'Julia T. — Newborn',
    meta: 'Tue 15 Jul · On location',
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
    soon: true,
  },
  {
    icon: 'gallery',
    titleKey: 'landing.pipeline.galleryTitle',
    textKey: 'landing.pipeline.galleryText',
  },
];

const PHOTOGRAPHER_FEATURES: { labelKey: TranslationKey; soon?: boolean }[] = [
  { labelKey: 'landing.phFeat.portfolio' },
  { labelKey: 'landing.phFeat.leads' },
  { labelKey: 'landing.phFeat.contracts', soon: true },
  { labelKey: 'landing.phFeat.data' },
];

const CLIENT_FEATURES: { labelKey: TranslationKey; soon?: boolean }[] = [
  { labelKey: 'landing.clFeat.browse' },
  { labelKey: 'landing.clFeat.sign', soon: true },
  { labelKey: 'landing.clFeat.pay', soon: true },
  { labelKey: 'landing.clFeat.gallery' },
];

// Frame number + orientation, so the mock reads as a real gallery that mixes
// portrait and landscape shots rather than a uniform grid of squares.
const GALLERY_FRAMES: { no: string; ar: string; fav?: boolean; selected?: boolean }[] = [
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
// shipped on Stripe Connect Express — they are the only two promises on this
// page above Starter's baseline that the product now actually keeps.
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
      { labelKey: 'landing.price.f.retention60', soon: true },
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
      { labelKey: 'landing.price.f.retention1y', soon: true },
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
      { labelKey: 'landing.price.f.upTo3', soon: true },
      { labelKey: 'landing.price.f.analytics', soon: true },
      { labelKey: 'landing.price.f.whiteLabel', soon: true },
      { labelKey: 'landing.price.f.retention2y', soon: true },
    ],
  },
];

export default function LandingPage() {
  const { theme } = useThemeStore();
  const c = getColors(theme);
  const s = getLandingStyles(theme);
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  const [yearly, setYearly] = useState(false);

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
            <a href="#features" style={s.navLink}>
              {t('landing.nav.features')}
            </a>
            <a href="#workflow" style={s.navLink}>
              {t('landing.nav.howItWorks')}
            </a>
            <a href="#pricing" style={s.navLink}>
              {t('landing.nav.pricing')}
            </a>
            <a href="#audience" style={s.navLink}>
              {t('landing.nav.forClients')}
            </a>
          </div>

          <div style={s.navRight}>
            <LanguageToggle variant="pill" />
            <ThemeToggle variant="pill" />
            <Link href="/login" style={s.navSignIn}>
              {t('landing.nav.signIn')}
            </Link>
            <Link
              href="/register"
              className="landing-btn landing-btn-primary"
              style={{ padding: '10px 18px', fontSize: '0.88rem' }}
            >
              {t('landing.nav.getStarted')}
            </Link>
          </div>
        </div>
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
                <span style={s.mockChip}>{t('landing.hero.mockExpected')}</span>
              </div>

              {BOOKINGS.map((b, i) => (
                <div
                  key={b.name}
                  style={{ ...s.row, ...(i === BOOKINGS.length - 1 ? { marginBottom: 0 } : {}) }}
                >
                  <span style={{ ...s.avatar, background: b.gradient }}>{b.initials}</span>
                  <span style={s.rowInfo}>
                    <span style={s.rowName}>{b.name}</span>
                    <span style={s.rowMeta}>{b.meta}</span>
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
                  <span style={s.toastSpan}>{t('landing.hero.toastMeta')}</span>
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
              <div style={s.tileIcon}>
                <Icon name="gallery" size={21} />
              </div>
              <h3 style={s.bigTitle}>{t('landing.features.galleriesTitle')}</h3>
              <p style={s.bigText}>{t('landing.features.galleriesText')}</p>
            </div>
            <div style={s.galleryPrevWrap}>
              <div style={s.galleryBar}>
                <div>
                  <p style={s.galleryBarName}>Lena &amp; Kaan — Wedding</p>
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
                      background: PHOTO_GRADIENTS[i % PHOTO_GRADIENTS.length],
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

          {[
            {
              icon: 'calendar' as IconName,
              title: t('landing.features.bookingsTitle'),
              soon: false,
              text: t('landing.features.bookingsText'),
              visual: (
                <div style={s.mini}>
                  <div style={s.miniRowActive}>
                    <span style={s.miniLabel}>Sat 12 Jul · 14:00</span>
                    <span style={s.miniPillSuccess}>
                      <Icon name="check" size={11} strokeWidth={2.5} />{' '}
                      {t('landing.features.booked')}
                    </span>
                  </div>
                  <div style={s.miniRow}>
                    <span style={s.miniLabel}>Sun 13 Jul · 10:00</span>
                    <span style={s.miniPillNeutral}>{t('landing.features.open')}</span>
                  </div>
                </div>
              ),
            },
            {
              icon: 'contract' as IconName,
              title: t('landing.features.contractsTitle'),
              soon: true,
              text: t('landing.features.contractsText'),
              visual: (
                <div style={s.mini}>
                  <div style={s.miniRow}>
                    <span style={s.miniLabel}>Shooting-Vertrag.pdf</span>
                    <span style={s.miniPillSuccess}>
                      <Icon name="check" size={11} strokeWidth={2.5} />{' '}
                      {t('landing.features.signed')}
                    </span>
                  </div>
                  <div style={s.miniSign}>
                    <span style={s.miniSignName}>Anna Fischer</span>
                    <span style={s.miniPillNeutral}>{t('landing.features.esigned')}</span>
                  </div>
                </div>
              ),
            },
            {
              icon: 'card' as IconName,
              title: t('landing.features.stripeTitle'),
              soon: true,
              text: t('landing.features.stripeText'),
              visual: (
                <div style={s.mini}>
                  <div style={s.miniRow}>
                    <span style={s.miniLabel}>{t('landing.features.deposit')}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={s.miniValue}>€480</span>
                      <span style={s.miniPillSuccess}>
                        <Icon name="check" size={11} strokeWidth={2.5} />{' '}
                        {t('landing.features.paid')}
                      </span>
                    </span>
                  </div>
                  <div style={s.miniRow}>
                    <span style={s.miniLabel}>{t('landing.features.balance')}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={s.miniValue}>€720</span>
                      <span style={s.miniPillNeutral}>{t('landing.features.due')}</span>
                    </span>
                  </div>
                </div>
              ),
            },
            {
              icon: 'target' as IconName,
              title: t('landing.features.leadTitle'),
              soon: false,
              text: t('landing.features.leadText'),
              visual: (
                <div style={s.mini}>
                  <div style={s.miniRow}>
                    <span style={s.miniLabel}>Sarah M. · Wedding</span>
                    <span style={s.miniPillPrimary}>{t('landing.features.leadHot')}</span>
                  </div>
                  <div style={s.miniRow}>
                    <span style={s.miniLabel}>Tom K. · Portrait</span>
                    <span style={s.miniPillNeutral}>{t('landing.features.leadWarm')}</span>
                  </div>
                </div>
              ),
            },
          ].map((f) => (
            <div key={f.icon} className="landing-card-hover" style={s.tile}>
              <div style={s.tileHead}>
                <div style={s.tileIcon}>
                  <Icon name={f.icon} size={21} />
                </div>
                <h3 style={s.tileTitle}>
                  {f.title}
                  {f.soon && <ComingSoon size="md" style={{ marginLeft: 8 }} />}
                </h3>
                <p style={s.tileText}>{f.text}</p>
              </div>
              {f.visual}
            </div>
          ))}

          {/* German market — a full feature tile so the 3×3 bento has no orphan cell. */}
          <div className="landing-card-hover" style={s.tile}>
            <div style={s.tileHead}>
              <div style={s.tileIconInfo}>
                <Icon name="globe" size={21} />
              </div>
              <h3 style={s.tileTitle}>{t('landing.features.germanTitle')}</h3>
              <p style={s.tileText}>{t('landing.features.germanText')}</p>
            </div>
            <div style={{ ...s.mini, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <span style={s.miniPillSuccess}>
                <Icon name="check" size={11} strokeWidth={2.5} /> DSGVO
              </span>
              <span style={s.miniPillSuccess}>
                <Icon name="check" size={11} strokeWidth={2.5} /> GoBD
              </span>
              <span style={s.miniPillNeutral}>Kleinunternehmer §19</span>
            </div>
          </div>
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
        </div>

        <div className="landing-split landing-reveal-stagger">
          <div className="landing-panel" style={s.panelFeature}>
            <span style={{ ...s.panelGlow, ...s.panelGlowPrimary }} aria-hidden="true" />
            <div style={s.ptop}>
              <span style={{ ...s.pic, ...s.picFeature }}>
                <Icon name="camera" size={23} />
              </span>
              <div>
                <h3 style={s.ptopH}>{t('landing.audience.photographersTitle')}</h3>
                <div style={s.ptag}>{t('landing.audience.photographersTag')}</div>
              </div>
            </div>
            <ul style={s.flist}>
              {PHOTOGRAPHER_FEATURES.map((feat) => (
                <li key={feat.labelKey} style={s.flistItem}>
                  <span style={s.chkPrimary}>
                    <Icon name="check" size={13} strokeWidth={2.8} />
                  </span>
                  {t(feat.labelKey)}
                  {feat.soon && <ComingSoon size="sm" style={{ marginLeft: 8 }} />}
                </li>
              ))}
            </ul>
            <Link href="/register" style={s.lnk}>
              {t('landing.audience.startTrial')}
              <Icon name="arrow-right" size={16} strokeWidth={2} />
            </Link>
          </div>

          <div className="landing-panel" style={s.panel}>
            <span style={{ ...s.panelGlow, ...s.panelGlowClient }} aria-hidden="true" />
            <div style={s.ptop}>
              <span style={{ ...s.pic, ...s.picClient }}>
                <Icon name="user" size={23} />
              </span>
              <div>
                <h3 style={s.ptopH}>{t('landing.audience.clientsTitle')}</h3>
                <div style={s.ptag}>{t('landing.audience.clientsTag')}</div>
              </div>
            </div>
            <ul style={s.flist}>
              {CLIENT_FEATURES.map((feat) => (
                <li key={feat.labelKey} style={s.flistItem}>
                  <span style={s.chkPrimary}>
                    <Icon name="check" size={13} strokeWidth={2.8} />
                  </span>
                  {t(feat.labelKey)}
                  {feat.soon && <ComingSoon size="sm" style={{ marginLeft: 8 }} />}
                </li>
              ))}
            </ul>
            {/* Clients sign in through their photographer's link — /register is
                the *photographer* studio signup (subdomain, plan, PHOTOGRAPHER
                role), so pointing the "For clients" CTA there asked a client to
                open a studio account. There is no photographer directory yet;
                the client sign-in page is the real entry point. */}
            <Link href="/customer/auth/login" style={s.lnkClient}>
              {t('landing.audience.findPhotographer')}
              <Icon name="arrow-right" size={16} strokeWidth={2} />
            </Link>
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

          <div style={s.priceSwitch} role="tablist" aria-label={t('landing.aria.billingPeriod')}>
            <button
              type="button"
              role="tab"
              aria-selected={!yearly}
              onClick={() => setYearly(false)}
              style={{ ...s.priceSwitchBtn, ...(!yearly ? s.priceSwitchBtnOn : {}) }}
            >
              {t('landing.pricing.monthly')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={yearly}
              onClick={() => setYearly(true)}
              style={{ ...s.priceSwitchBtn, ...(yearly ? s.priceSwitchBtnOn : {}) }}
            >
              {t('landing.pricing.yearly')}
              <span style={s.priceSave}>{t('landing.pricing.save')}</span>
            </button>
          </div>
        </div>

        <div className="landing-prices landing-reveal-stagger" style={s.pricesWrap}>
          {PRICING.map((plan) => (
            <div
              key={plan.tier}
              className={
                plan.highlighted ? 'landing-price-pro landing-card-hover' : 'landing-card-hover'
              }
              style={{ ...s.priceCard, ...(plan.highlighted ? s.priceCardHot : {}) }}
            >
              {plan.highlighted && (
                <div style={s.priceBadge}>{t('landing.pricing.mostPopular')}</div>
              )}

              <div style={{ ...s.tier, ...(plan.highlighted ? s.tierPro : {}) }}>{plan.tier}</div>
              <div style={s.amount}>
                <span style={s.amountCur}>€</span>
                <span style={s.amountVal}>{yearly ? plan.yearly : plan.monthly}</span>
                <span style={s.amountPer}>{t('landing.pricing.perMonth')}</span>
              </div>
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

              <ul style={s.priceFeatures}>
                {plan.features.map((feat) => (
                  <li key={feat.labelKey} style={s.priceItem}>
                    <span style={s.priceChk}>
                      <Icon name="check" size={12} strokeWidth={2.8} />
                    </span>
                    {t(feat.labelKey)}
                    {feat.footnote && <span style={s.priceFootMark}>*</span>}
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
      <section style={s.ctaWrap}>
        <div className="landing-reveal" style={s.ctaBox}>
          <span style={s.ctaGlow} aria-hidden="true" />
          <span style={s.ctaEyebrow}>
            <span style={s.ctaEyebrowLine} />
            {t('landing.cta.eyebrow')}
            <span style={s.ctaEyebrowLine} />
          </span>
          <h2 style={s.ctaTitle}>{t('landing.cta.title')}</h2>
          <p style={s.ctaText}>{t('landing.cta.text')}</p>
          <Link href="/register" style={s.btnLight}>
            {t('landing.cta.button')}
            <Icon name="arrow-right" size={18} strokeWidth={2} />
          </Link>
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
              <a href="#features" style={s.footLink}>
                {t('landing.nav.features')}
              </a>
              <a href="#pricing" style={s.footLink}>
                {t('landing.nav.pricing')}
              </a>
              <a href="#workflow" style={s.footLink}>
                {t('landing.nav.howItWorks')}
              </a>
              <a href="#audience" style={s.footLink}>
                {t('landing.nav.forClients')}
              </a>
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
                {t('landing.audience.findPhotographer')}
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
