'use client';

import { FotolioLogo } from '@/components/FotolioLogo';
import { Icon, type IconName } from '@/components/Icon';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getColors } from '@/lib/design-tokens';
import { useThemeStore } from '@/store/themeStore';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getLandingStyles, PHOTO_GRADIENTS } from './landing.styles';

// ── Content ─────────────────────────────────────────────────────────────
// Honest copy only: real product surfaces, no invented stats or client logos.

const CAPABILITIES = [
  'Lead scoring',
  'Online booking',
  'E-sign contracts',
  'Stripe payments',
  'Private galleries',
  'GoBD invoices',
  'Bilingual DE / EN',
];

// A slice of the real product — this week's bookings with their live states.
const BOOKINGS: {
  initials: string;
  gradient: string;
  name: string;
  meta: string;
  label: string;
  tone: 'conf' | 'paid' | 'pend';
}[] = [
  {
    initials: 'LK',
    gradient: 'linear-gradient(135deg, #7A66F5, #B06BE0)',
    name: 'Lena & Kaan — Wedding',
    meta: 'Sat 12 Jul · Grugapark, Essen',
    label: 'Confirmed',
    tone: 'conf',
  },
  {
    initials: 'MB',
    gradient: 'linear-gradient(135deg, #4C8DE0, #6E56F0)',
    name: 'Meyer Family — Portrait',
    meta: 'Sun 13 Jul · Studio',
    label: 'Deposit paid',
    tone: 'paid',
  },
  {
    initials: 'JT',
    gradient: 'linear-gradient(135deg, #0EA5E9, #6366F1)',
    name: 'Julia T. — Newborn',
    meta: 'Tue 15 Jul · On location',
    label: 'Contract sent',
    tone: 'pend',
  },
];

// Ordered lifecycle — every booking moves through these five stages in order,
// so the numbering encodes a real sequence rather than decoration.
const PIPELINE: { icon: IconName; title: string; text: string }[] = [
  { icon: 'target', title: 'Enquiry', text: 'A lead lands from your portfolio and gets scored automatically.' },
  { icon: 'calendar', title: 'Booking', text: 'The client picks a slot; it syncs straight to your calendar.' },
  { icon: 'contract', title: 'Contract', text: 'The shoot agreement is sent and e-signed in minutes — legally binding.' },
  { icon: 'card', title: 'Payment', text: 'Deposit and balance are collected via Stripe, reconciled for you.' },
  { icon: 'gallery', title: 'Gallery', text: 'Final images land in a private, branded gallery to view and download.' },
];

const PHOTOGRAPHER_FEATURES = [
  'Portfolio & public booking page',
  'Lead management & scoring',
  'Contracts, payments & galleries',
  'DSGVO-konforme client data',
];

const CLIENT_FEATURES = [
  'Browse portfolios & book online',
  'Sign contracts from your phone',
  'Pay securely with Stripe',
  'View & download your gallery',
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

const PRICING = [
  {
    tier: 'Starter',
    monthly: '19',
    yearly: '16',
    highlighted: false,
    features: ['Portfolio & website', 'Lead management', 'Online bookings', '10 GB gallery storage'],
  },
  {
    tier: 'Pro',
    monthly: '39',
    yearly: '32',
    highlighted: true,
    features: [
      'Everything in Starter',
      'Stripe payments & deposits',
      'Contracts & e-sign',
      'CRM & client management',
      'Bilingual DE / EN support',
    ],
  },
  {
    tier: 'Studio',
    monthly: '79',
    yearly: '65',
    highlighted: false,
    features: ['Everything in Pro', 'Up to 3 photographers', 'Analytics & reports', 'White-label options'],
  },
];

export default function LandingPage() {
  const { theme } = useThemeStore();
  const c = getColors(theme);
  const s = getLandingStyles(theme);
  const year = new Date().getFullYear();

  const [yearly, setYearly] = useState(false);

  // Scroll-reveal — reveal below-the-fold blocks as they enter the viewport.
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.landing-reveal'));
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
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const statusStyle = (tone: 'conf' | 'paid' | 'pend') =>
    tone === 'conf' ? s.statusConf : tone === 'paid' ? s.statusPaid : s.statusPend;

  return (
    <div style={s.page}>
      <div className="landing-grain" style={{ opacity: c.isDark ? 0.06 : 0.035 }} aria-hidden="true" />

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav style={s.navbar}>
        <div style={s.navInner}>
          <Link href="/" style={s.navLogo} aria-label="Fotolio home">
            <FotolioLogo theme={theme} variant="brand" showText={true} />
          </Link>

          <div style={s.navLinks}>
            <a href="#features" style={s.navLink}>Features</a>
            <a href="#workflow" style={s.navLink}>How it works</a>
            <a href="#pricing" style={s.navLink}>Pricing</a>
            <a href="#audience" style={s.navLink}>For clients</a>
          </div>

          <div style={s.navRight}>
            <ThemeToggle variant="pill" />
            <Link href="/login" style={s.navSignIn}>
              Sign in
            </Link>
            <Link href="/register" className="landing-btn landing-btn-primary" style={{ padding: '10px 18px', fontSize: '0.88rem' }}>
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <header style={s.hero} id="top">
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
              Run the business.<br />
              Keep the <span style={s.heroAccent}>craft</span>.
            </h1>

            <p style={s.lede}>
              Leads, bookings, contracts, Stripe payments and client galleries — Fotolio handles the
              business side, so you stay behind the camera.
            </p>

            <div style={s.heroCta}>
              <Link href="/register" className="landing-btn landing-btn-primary">
                Start 14-day free trial
                <Icon name="arrow-right" size={16} strokeWidth={2} />
              </Link>
              <a
                href="#workflow"
                style={s.btnOutline}
                onMouseEnter={(e) => (e.currentTarget.style.background = c.surfaceHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                See how it works
              </a>
            </div>

            <div style={s.heroMicro}>
              {['No credit card', 'DSGVO-konform', 'Cancel anytime'].map((t) => (
                <span key={t} style={s.heroMicroItem}>
                  <span style={{ color: c.success, display: 'flex' }}>
                    <Icon name="check" size={15} strokeWidth={2.6} />
                  </span>
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Product mockup */}
          <div className="landing-hero-visual">
            <div style={s.mock} role="img" aria-label="Fotolio bookings dashboard preview">
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
                <h4 style={s.mockTitleH}>This week</h4>
                <span style={s.mockChip}>€1.240 expected</span>
              </div>

              {BOOKINGS.map((b, i) => (
                <div key={b.name} style={{ ...s.row, ...(i === BOOKINGS.length - 1 ? { marginBottom: 0 } : {}) }}>
                  <span style={{ ...s.avatar, background: b.gradient }}>{b.initials}</span>
                  <span style={s.rowInfo}>
                    <span style={s.rowName}>{b.name}</span>
                    <span style={s.rowMeta}>{b.meta}</span>
                  </span>
                  <span style={{ ...s.status, ...statusStyle(b.tone) }}>{b.label}</span>
                </div>
              ))}

              <div className="landing-float" style={s.toast}>
                <span style={s.toastTick} aria-hidden="true">
                  <Icon name="check" size={18} strokeWidth={2.4} />
                </span>
                <div>
                  <span style={s.toastB}>New booking confirmed</span>
                  <span style={s.toastSpan}>Wedding · €480 deposit paid</span>
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
            <span key={`${cap}-${i}`} style={s.stripItem}>
              <span style={s.stripDiamond}>◆</span>
              {cap}
            </span>
          ))}
        </div>
      </div>

      {/* ── Features (bento) ────────────────────────────────────── */}
      <section id="features" style={s.section}>
        <div className="landing-reveal" style={s.head}>
          <span style={s.eyebrow}>
            <span style={s.eyebrowLine} />
            Everything in one place
          </span>
          <h2 style={s.sectionTitle}>Run your studio without the busywork.</h2>
          <p style={s.sectionSub}>
            From the first enquiry to the final gallery delivery, every step of the shoot lives in one
            connected workspace.
          </p>
        </div>

        <div className="landing-bento landing-reveal">
          {/* Hero tile — galleries */}
          <div className="tile-big landing-card-hover" style={s.tileBig}>
            <div style={s.bigBody}>
              <div style={s.tileIcon}>
                <Icon name="gallery" size={21} />
              </div>
              <h3 style={s.bigTitle}>Client galleries that sell</h3>
              <p style={s.bigText}>
                Deliver private, branded galleries your clients can view, favourite and download — no
                WeTransfer links, no expiry stress.
              </p>
            </div>
            <div style={s.galleryPrevWrap}>
              <div style={s.galleryBar}>
                <div>
                  <p style={s.galleryBarName}>Lena &amp; Kaan — Wedding</p>
                  <span style={s.galleryBarMeta}>
                    248 photos · 12 favourited
                  </span>
                </div>
                <span style={s.galleryBarAction}>
                  <Icon name="check" size={14} strokeWidth={2.25} />
                  Download all
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
              title: 'Online bookings',
              text: 'Clients book sessions straight from your portfolio page — synced to your calendar.',
              visual: (
                <div style={s.mini}>
                  <div style={s.miniRowActive}>
                    <span style={s.miniLabel}>Sat 12 Jul · 14:00</span>
                    <span style={s.miniPillSuccess}>
                      <Icon name="check" size={11} strokeWidth={2.5} /> Booked
                    </span>
                  </div>
                  <div style={s.miniRow}>
                    <span style={s.miniLabel}>Sun 13 Jul · 10:00</span>
                    <span style={s.miniPillNeutral}>Open</span>
                  </div>
                </div>
              ),
            },
            {
              icon: 'contract' as IconName,
              title: 'Contracts & e-sign',
              text: 'Send shoot agreements and collect legally binding signatures — no email back-and-forth.',
              visual: (
                <div style={s.mini}>
                  <div style={s.miniRow}>
                    <span style={s.miniLabel}>Shooting-Vertrag.pdf</span>
                    <span style={s.miniPillSuccess}>
                      <Icon name="check" size={11} strokeWidth={2.5} /> Signed
                    </span>
                  </div>
                  <div style={s.miniSign}>
                    <span style={s.miniSignName}>Anna Fischer</span>
                    <span style={s.miniPillNeutral}>e-signed</span>
                  </div>
                </div>
              ),
            },
            {
              icon: 'card' as IconName,
              title: 'Stripe payments',
              text: 'Take deposits and final payments online with automatic reconciliation.',
              visual: (
                <div style={s.mini}>
                  <div style={s.miniRow}>
                    <span style={s.miniLabel}>Deposit</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={s.miniValue}>€480</span>
                      <span style={s.miniPillSuccess}>
                        <Icon name="check" size={11} strokeWidth={2.5} /> Paid
                      </span>
                    </span>
                  </div>
                  <div style={s.miniRow}>
                    <span style={s.miniLabel}>Balance</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={s.miniValue}>€720</span>
                      <span style={s.miniPillNeutral}>Due 12 Jul</span>
                    </span>
                  </div>
                </div>
              ),
            },
            {
              icon: 'target' as IconName,
              title: 'Lead management',
              text: 'Capture, score and route enquiries so no booking request slips through.',
              visual: (
                <div style={s.mini}>
                  <div style={s.miniRow}>
                    <span style={s.miniLabel}>Sarah M. · Wedding</span>
                    <span style={s.miniPillPrimary}>92 · Hot</span>
                  </div>
                  <div style={s.miniRow}>
                    <span style={s.miniLabel}>Tom K. · Portrait</span>
                    <span style={s.miniPillNeutral}>61 · Warm</span>
                  </div>
                </div>
              ),
            },
          ].map((f) => (
            <div key={f.title} className="landing-card-hover" style={s.tile}>
              <div style={s.tileHead}>
                <div style={s.tileIcon}>
                  <Icon name={f.icon} size={21} />
                </div>
                <h3 style={s.tileTitle}>{f.title}</h3>
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
              <h3 style={s.tileTitle}>Built for the German market</h3>
              <p style={s.tileText}>
                Bilingual DE / EN, DSGVO-aware by default, GoBD-konforme Rechnungen and
                Kleinunternehmer support.
              </p>
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
              One connected pipeline
              <span style={s.eyebrowLine} />
            </span>
            <h2 style={s.sectionTitle}>Every shoot, from enquiry to paid.</h2>
            <p style={s.sectionSub}>
              Fotolio moves each booking through the same clean flow — so you always know exactly
              what&apos;s next.
            </p>
          </div>

          <div className="landing-flow landing-reveal">
            {PIPELINE.map((step, i) => (
              <div key={step.title} className="landing-card-hover" style={s.step}>
                <div style={s.stepNo}>
                  {String(i + 1).padStart(2, '0')}
                  <span style={s.stepNoLine} />
                </div>
                <div style={s.stepIcon}>
                  <Icon name={step.icon} size={19} />
                </div>
                <h4 style={s.stepH}>{step.title}</h4>
                <p style={s.stepP}>{step.text}</p>
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
            Both sides of the lens
            <span style={s.eyebrowLine} />
          </span>
          <h2 style={s.sectionTitle}>Built for everyone in the frame.</h2>
        </div>

        <div className="landing-split landing-reveal">
          <div style={s.panelFeature}>
            <div style={s.ptop}>
              <span style={{ ...s.pic, ...s.picFeature }}>
                <Icon name="camera" size={23} />
              </span>
              <div>
                <h3 style={s.ptopH}>For photographers</h3>
                <div style={s.ptag}>One studio to run the whole business</div>
              </div>
            </div>
            <ul style={s.flist}>
              {PHOTOGRAPHER_FEATURES.map((label) => (
                <li key={label} style={s.flistItem}>
                  <span style={s.chk}>
                    <Icon name="check" size={13} strokeWidth={2.8} />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
            <Link href="/register" style={s.lnk}>
              Start free trial
              <Icon name="arrow-right" size={16} strokeWidth={2} />
            </Link>
          </div>

          <div style={s.panel}>
            <div style={s.ptop}>
              <span style={{ ...s.pic, ...s.picClient }}>
                <Icon name="heart" size={23} />
              </span>
              <div>
                <h3 style={s.ptopH}>For clients</h3>
                <div style={s.ptag}>Book, sign and view — all in one link</div>
              </div>
            </div>
            <ul style={s.flist}>
              {CLIENT_FEATURES.map((label) => (
                <li key={label} style={s.flistItem}>
                  <span style={s.chk}>
                    <Icon name="check" size={13} strokeWidth={2.8} />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
            <Link href="/register" style={s.lnkClient}>
              Find a photographer
              <Icon name="arrow-right" size={16} strokeWidth={2} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────── */}
      <section id="pricing" style={s.section}>
        <div className="landing-reveal" style={s.headCenter}>
          <span style={s.eyebrow}>
            <span style={s.eyebrowLine} />
            Pricing
            <span style={s.eyebrowLine} />
          </span>
          <h2 style={s.sectionTitle}>Simple, transparent pricing.</h2>
          <p style={s.sectionSub}>Start free for 14 days. No credit card, cancel anytime.</p>

          <div style={s.priceSwitch} role="tablist" aria-label="Billing period">
            <button
              type="button"
              role="tab"
              aria-selected={!yearly}
              onClick={() => setYearly(false)}
              style={{ ...s.priceSwitchBtn, ...(!yearly ? s.priceSwitchBtnOn : {}) }}
            >
              Monthly
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={yearly}
              onClick={() => setYearly(true)}
              style={{ ...s.priceSwitchBtn, ...(yearly ? s.priceSwitchBtnOn : {}) }}
            >
              Yearly
              <span style={s.priceSave}>−2 months</span>
            </button>
          </div>
        </div>

        <div className="landing-prices landing-reveal" style={s.pricesWrap}>
          {PRICING.map((plan) => (
            <div
              key={plan.tier}
              className={plan.highlighted ? 'landing-price-pro' : undefined}
              style={{ ...s.priceCard, ...(plan.highlighted ? s.priceCardHot : {}) }}
            >
              {plan.highlighted && <div style={s.priceBadge}>Most popular</div>}

              <div style={{ ...s.tier, ...(plan.highlighted ? s.tierPro : {}) }}>{plan.tier}</div>
              <div style={s.amount}>
                <span style={s.amountCur}>€</span>
                <span style={s.amountVal}>{yearly ? plan.yearly : plan.monthly}</span>
                <span style={s.amountPer}>/mo</span>
              </div>
              <div style={s.billed}>{yearly ? 'Billed yearly' : 'Billed monthly'}</div>

              {plan.highlighted ? (
                <Link href="/register" className="landing-btn landing-btn-primary" style={{ width: '100%' }}>
                  Get started
                </Link>
              ) : (
                <Link
                  href="/register"
                  style={{ ...s.btnOutline, width: '100%' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = c.surfaceHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  Get started
                </Link>
              )}

              <ul style={s.priceFeatures}>
                {plan.features.map((label) => (
                  <li key={label} style={s.priceItem}>
                    <span style={s.priceChk}>
                      <Icon name="check" size={12} strokeWidth={2.8} />
                    </span>
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── Closing CTA ─────────────────────────────────────────── */}
      <section style={s.ctaWrap}>
        <div className="landing-reveal" style={s.ctaBox}>
          <span style={s.ctaGlow} aria-hidden="true" />
          <span style={s.ctaEyebrow}>
            <span style={s.ctaEyebrowLine} />
            Ready when you are
            <span style={s.ctaEyebrowLine} />
          </span>
          <h2 style={s.ctaTitle}>Spend your day behind the camera.</h2>
          <p style={s.ctaText}>
            Let Fotolio handle the leads, contracts and payments while you do the part only you can.
          </p>
          <Link href="/register" style={s.btnLight}>
            Start 14-day free trial
            <Icon name="arrow-right" size={18} strokeWidth={2} />
          </Link>
          <div style={s.ctaMicro}>No credit card required · DSGVO-konform</div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer style={s.footer}>
        <div style={s.footerInner}>
          <div style={s.footGrid}>
            <div style={s.footBrand}>
              <Link href="/" style={s.navLogo} aria-label="Fotolio home">
                <FotolioLogo variant="brand" theme={theme} showText={true} />
              </Link>
              <p style={s.footBrandP}>
                The all-in-one platform for photographers in Germany. Bookings, clients and galleries
                in one connected studio.
              </p>
            </div>

            <div style={s.footCol}>
              <h5 style={s.footColH}>Product</h5>
              <a href="#features" style={s.footLink}>Features</a>
              <a href="#pricing" style={s.footLink}>Pricing</a>
              <a href="#workflow" style={s.footLink}>How it works</a>
              <a href="#audience" style={s.footLink}>For clients</a>
            </div>
            <div style={s.footCol}>
              <h5 style={s.footColH}>Company</h5>
              <a href="#" style={s.footLink}>About</a>
              <a href="#" style={s.footLink}>Blog</a>
              <a href="#" style={s.footLink}>Contact</a>
              <a href="#" style={s.footLink}>Careers</a>
            </div>
            <div style={s.footCol}>
              <h5 style={s.footColH}>Legal</h5>
              <a href="#" style={s.footLink}>Impressum</a>
              <a href="#" style={s.footLink}>Datenschutz</a>
              <a href="#" style={s.footLink}>AGB</a>
              <a href="#" style={s.footLink}>DSGVO</a>
            </div>
          </div>

          <div style={s.footBottom}>
            <span>© {year} Fotolio · Made in Germany</span>
            <span>Impressum · Datenschutz · AGB</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
