'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import RequestForm from '../../r/[subdomain]/RequestForm';
import type { PublicPortfolioPayload } from './page';

type Theme = 'dark' | 'light';

interface Palette {
  bg: string;
  bgElevated: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  hairline: string;
  accent: string;
  accentInverse: string;
  navBlur: string;
  imageSkeleton: string;
}

const PALETTES: Record<Theme, Palette> = {
  dark: {
    bg: '#0A0A0A',
    bgElevated: '#171717',
    text: '#FAFAFA',
    textMuted: '#A1A1AA',
    textSubtle: '#71717A',
    hairline: '#262626',
    accent: '#FAFAFA',
    accentInverse: '#0A0A0A',
    navBlur: 'rgba(10, 10, 10, 0.7)',
    imageSkeleton: '#171717',
  },
  light: {
    bg: '#FFFFFF',
    bgElevated: '#FAFAFA',
    text: '#0A0A0A',
    textMuted: '#525252',
    textSubtle: '#737373',
    hairline: '#E5E5E5',
    accent: '#0A0A0A',
    accentInverse: '#FFFFFF',
    navBlur: 'rgba(255, 255, 255, 0.7)',
    imageSkeleton: '#F5F5F5',
  },
};

const DISPLAY_FONT =
  'var(--font-cormorant), "Cormorant Garamond", "Playfair Display", Georgia, serif';
const BODY_FONT =
  'var(--font-inter), "Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';

export default function PublicPortfolioView({ data }: { data: PublicPortfolioPayload }) {
  const { photographer, photos } = data;
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);

  // Resolve theme on mount: explicit user pref wins; otherwise prefer dark
  // for photographer portfolios (images pop, matches industry default).
  useEffect(() => {
    const stored = window.localStorage.getItem('p-theme') as Theme | null;
    if (stored === 'dark' || stored === 'light') {
      setTheme(stored);
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      setTheme('light');
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Keyboard shortcuts for lightbox.
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
      if (e.key === 'ArrowLeft') setLightbox((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
      if (e.key === 'ArrowRight') setLightbox((i) => (i === null ? null : (i + 1) % photos.length));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, photos.length]);

  // Lock body scroll while lightbox is open.
  useEffect(() => {
    document.body.style.overflow = lightbox !== null ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [lightbox]);

  const palette = PALETTES[theme];
  const heroPhoto = photos[0];
  const showPoweredBy = photographer.plan === 'STARTER';
  const formVariant: 'light' | 'dark' = theme;

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    window.localStorage.setItem('p-theme', next);
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: palette.bg,
        color: palette.text,
        fontFamily: BODY_FONT,
        transition: 'background 0.3s ease, color 0.3s ease',
        // Avoid flash before mount; mounted gate hides initial paint.
        visibility: mounted ? 'visible' : 'hidden',
      }}
    >
      <GlobalStyles palette={palette} />

      <Nav
        photographer={photographer}
        palette={palette}
        scrolled={scrolled}
        theme={theme}
        onToggleTheme={toggleTheme}
        hasHero={!!heroPhoto}
      />

      {heroPhoto ? (
        <CinematicHero photo={heroPhoto} photographer={photographer} palette={palette} photoCount={photos.length} />
      ) : (
        <MinimalHero photographer={photographer} palette={palette} />
      )}

      <main>
        <section style={{ maxWidth: 1440, margin: '0 auto', padding: '64px 24px 32px' }}>
          {photos.length === 0 ? (
            <EmptyGallery palette={palette} />
          ) : (
            <>
              <SectionLabel palette={palette}>Selected work</SectionLabel>
              <PhotoGrid photos={photos} onOpen={setLightbox} palette={palette} />
            </>
          )}
        </section>

        <ContactSection
          photographer={photographer}
          palette={palette}
          variant={formVariant}
        />
      </main>

      <Footer palette={palette} poweredBy={showPoweredBy} photographer={photographer} />

      {lightbox !== null && photos[lightbox] && (
        <Lightbox
          photo={photos[lightbox]}
          index={lightbox}
          total={photos.length}
          onClose={() => setLightbox(null)}
          onPrev={() => setLightbox((i) => (i === null ? null : (i - 1 + photos.length) % photos.length))}
          onNext={() => setLightbox((i) => (i === null ? null : (i + 1) % photos.length))}
        />
      )}
    </div>
  );
}

function GlobalStyles({ palette }: { palette: Palette }) {
  return (
    <style>{`
      html, body { background: ${palette.bg}; }
      * { box-sizing: border-box; }
      a:focus-visible, button:focus-visible {
        outline: 2px solid ${palette.accent};
        outline-offset: 3px;
        border-radius: 4px;
      }
      .grid-photo:hover .grid-photo-img { transform: scale(1.02); }
      .grid-photo:hover .grid-photo-overlay { opacity: 1; }
      .nav-cta:hover { opacity: 0.85; }
      .nav-link:hover { color: ${palette.text} !important; }
      @media (max-width: 900px) { .grid-photo-cols { column-count: 2 !important; } }
      @media (max-width: 560px) {
        .grid-photo-cols { column-count: 1 !important; }
        .contact-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
        .nav-links-desktop { display: none !important; }
        .hero-display { font-size: clamp(48px, 14vw, 96px) !important; }
      }
    `}</style>
  );
}

function Nav({
  photographer,
  palette,
  scrolled,
  theme,
  onToggleTheme,
  hasHero,
}: {
  photographer: PublicPortfolioPayload['photographer'];
  palette: Palette;
  scrolled: boolean;
  theme: Theme;
  onToggleTheme: () => void;
  hasHero: boolean;
}) {
  // Over the hero the nav stays transparent; once the user scrolls past the
  // fold we add a blurred glass background so text stays legible over photos.
  const transparent = hasHero && !scrolled;
  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        background: transparent ? 'transparent' : palette.navBlur,
        backdropFilter: transparent ? 'none' : 'saturate(180%) blur(16px)',
        WebkitBackdropFilter: transparent ? 'none' : 'saturate(180%) blur(16px)',
        borderBottom: transparent ? 'none' : `1px solid ${palette.hairline}`,
        transition: 'background 0.25s ease, border-color 0.25s ease',
      }}
    >
      <div
        style={{
          maxWidth: 1440,
          margin: '0 auto',
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
        }}
      >
        <a
          href="#top"
          style={{
            fontFamily: DISPLAY_FONT,
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: '0.02em',
            color: hasHero && !scrolled ? '#FAFAFA' : palette.text,
            textDecoration: 'none',
            textShadow: hasHero && !scrolled ? '0 1px 12px rgba(0,0,0,0.4)' : 'none',
          }}
        >
          {photographer.displayName}
        </a>

        <nav className="nav-links-desktop" style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          <a
            href="#work"
            className="nav-link"
            style={{
              fontSize: 13,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: hasHero && !scrolled ? 'rgba(250, 250, 250, 0.85)' : palette.textMuted,
              textDecoration: 'none',
              fontWeight: 500,
              transition: 'color 0.2s ease',
              textShadow: hasHero && !scrolled ? '0 1px 8px rgba(0,0,0,0.4)' : 'none',
            }}
          >
            Work
          </a>
          <a
            href="#contact"
            className="nav-link"
            style={{
              fontSize: 13,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: hasHero && !scrolled ? 'rgba(250, 250, 250, 0.85)' : palette.textMuted,
              textDecoration: 'none',
              fontWeight: 500,
              transition: 'color 0.2s ease',
              textShadow: hasHero && !scrolled ? '0 1px 8px rgba(0,0,0,0.4)' : 'none',
            }}
          >
            Contact
          </a>
        </nav>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} hasHero={hasHero && !scrolled} palette={palette} />
          <a
            href="#contact"
            className="nav-cta"
            style={{
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.02em',
              color: palette.accentInverse,
              background: palette.accent,
              padding: '10px 18px',
              borderRadius: 999,
              textDecoration: 'none',
              transition: 'opacity 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            Book a session
          </a>
        </div>
      </div>
    </header>
  );
}

function ThemeToggle({
  theme,
  onToggle,
  hasHero,
  palette,
}: {
  theme: Theme;
  onToggle: () => void;
  hasHero: boolean;
  palette: Palette;
}) {
  const iconColor = hasHero ? '#FAFAFA' : palette.text;
  return (
    <button
      onClick={onToggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      style={{
        width: 36,
        height: 36,
        borderRadius: 999,
        border: 'none',
        background: hasHero ? 'rgba(255,255,255,0.1)' : 'transparent',
        color: iconColor,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hasHero ? 'rgba(255,255,255,0.18)' : palette.bgElevated;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = hasHero ? 'rgba(255,255,255,0.1)' : 'transparent';
      }}
    >
      {theme === 'dark' ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

function CinematicHero({
  photo,
  photographer,
  palette,
  photoCount,
}: {
  photo: PublicPortfolioPayload['photos'][number];
  photographer: PublicPortfolioPayload['photographer'];
  palette: Palette;
  photoCount: number;
}) {
  return (
    <section
      id="top"
      style={{
        position: 'relative',
        height: '100vh',
        minHeight: 600,
        overflow: 'hidden',
        background: palette.bgElevated,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.viewUrl ?? photo.thumbnailUrl ?? ''}
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.15) 35%, rgba(0,0,0,0.55) 100%)',
        }}
      />

      <div
        style={{
          position: 'relative',
          height: '100%',
          maxWidth: 1440,
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          paddingBottom: 96,
          color: '#FAFAFA',
        }}
      >
        <div
          style={{
            fontSize: 12,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            fontWeight: 500,
            marginBottom: 24,
            opacity: 0.85,
          }}
        >
          Photography portfolio
        </div>
        <h1
          className="hero-display"
          style={{
            fontFamily: DISPLAY_FONT,
            fontSize: 'clamp(56px, 9vw, 128px)',
            fontWeight: 400,
            letterSpacing: '-0.02em',
            margin: 0,
            lineHeight: 0.95,
            textShadow: '0 2px 20px rgba(0,0,0,0.3)',
          }}
        >
          {photographer.displayName}
        </h1>
        <div
          style={{
            marginTop: 32,
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            fontSize: 14,
            opacity: 0.85,
            flexWrap: 'wrap',
          }}
        >
          <span>{photoCount} {photoCount === 1 ? 'photograph' : 'photographs'}</span>
          <span style={{ width: 4, height: 4, borderRadius: 999, background: 'currentColor', opacity: 0.5 }} />
          <a
            href="#work"
            style={{
              color: '#FAFAFA',
              textDecoration: 'none',
              borderBottom: '1px solid rgba(250,250,250,0.4)',
              paddingBottom: 2,
            }}
          >
            View work ↓
          </a>
        </div>
      </div>
    </section>
  );
}

function MinimalHero({
  photographer,
  palette,
}: {
  photographer: PublicPortfolioPayload['photographer'];
  palette: Palette;
}) {
  return (
    <section
      id="top"
      style={{
        minHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '160px 24px 80px',
        textAlign: 'center',
        borderBottom: `1px solid ${palette.hairline}`,
      }}
    >
      <div
        style={{
          fontSize: 12,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: palette.textSubtle,
          marginBottom: 24,
        }}
      >
        Photography portfolio
      </div>
      <h1
        className="hero-display"
        style={{
          fontFamily: DISPLAY_FONT,
          fontSize: 'clamp(48px, 8vw, 96px)',
          fontWeight: 400,
          letterSpacing: '-0.02em',
          margin: 0,
          lineHeight: 1,
        }}
      >
        {photographer.displayName}
      </h1>
      <p style={{ marginTop: 20, color: palette.textMuted, fontSize: 16, maxWidth: 460 }}>
        New portfolio coming soon. You can still send a booking request below.
      </p>
    </section>
  );
}

function SectionLabel({ palette, children }: { palette: Palette; children: React.ReactNode }) {
  return (
    <div
      id="work"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        marginBottom: 32,
        color: palette.textSubtle,
        fontSize: 12,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        fontWeight: 500,
      }}
    >
      <span>{children}</span>
      <span style={{ flex: 1, height: 1, background: palette.hairline }} />
    </div>
  );
}

function PhotoGrid({
  photos,
  onOpen,
  palette,
}: {
  photos: PublicPortfolioPayload['photos'];
  onOpen: (_index: number) => void;
  palette: Palette;
}) {
  return (
    <div
      className="grid-photo-cols"
      style={{
        columnCount: 3,
        columnGap: 14,
      }}
    >
      {photos.map((photo, idx) => {
        const aspect = photo.width && photo.height ? photo.width / photo.height : null;
        return (
          <button
            key={photo.id}
            onClick={() => onOpen(idx)}
            className="grid-photo"
            style={{
              display: 'block',
              width: '100%',
              marginBottom: 14,
              padding: 0,
              border: 'none',
              background: palette.imageSkeleton,
              borderRadius: 4,
              overflow: 'hidden',
              cursor: 'zoom-in',
              breakInside: 'avoid',
              position: 'relative',
              ...(aspect ? { aspectRatio: `${aspect}` } : {}),
            }}
            aria-label={`Open photograph ${idx + 1} of ${photos.length}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="grid-photo-img"
              src={photo.thumbnailUrl ?? photo.viewUrl ?? ''}
              alt=""
              loading="lazy"
              style={{
                width: '100%',
                height: aspect ? '100%' : 'auto',
                objectFit: aspect ? 'cover' : 'contain',
                display: 'block',
                transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
            <div
              className="grid-photo-overlay"
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.5) 100%)',
                opacity: 0,
                transition: 'opacity 0.3s ease',
                display: 'flex',
                alignItems: 'flex-end',
                padding: 16,
                pointerEvents: 'none',
              }}
            >
              <span style={{ color: '#FAFAFA', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                View ↗
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function EmptyGallery({ palette }: { palette: Palette }) {
  return (
    <div
      style={{
        padding: '96px 32px',
        textAlign: 'center',
        background: palette.bgElevated,
        border: `1px solid ${palette.hairline}`,
        borderRadius: 12,
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 16, opacity: 0.6 }}>◧</div>
      <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 500, color: palette.text }}>
        Portfolio in progress
      </h3>
      <p style={{ margin: 0, color: palette.textMuted, fontSize: 14 }}>
        Booking inquiries are still welcome below.
      </p>
    </div>
  );
}

function ContactSection({
  photographer,
  palette,
  variant,
}: {
  photographer: PublicPortfolioPayload['photographer'];
  palette: Palette;
  variant: 'light' | 'dark';
}) {
  return (
    <section
      id="contact"
      style={{
        marginTop: 80,
        padding: '96px 24px 120px',
        borderTop: `1px solid ${palette.hairline}`,
        background: palette.bg,
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div
          className="contact-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 7fr)',
            gap: 80,
            alignItems: 'start',
          }}
        >
          <div>
            <SectionLabel palette={palette}>Get in touch</SectionLabel>
            <h2
              style={{
                fontFamily: DISPLAY_FONT,
                fontSize: 'clamp(36px, 5vw, 56px)',
                fontWeight: 400,
                letterSpacing: '-0.02em',
                margin: '0 0 24px',
                lineHeight: 1.05,
                color: palette.text,
              }}
            >
              Let&apos;s plan
              <br />
              your session.
            </h2>
            <p
              style={{
                color: palette.textMuted,
                fontSize: 16,
                lineHeight: 1.7,
                margin: '0 0 32px',
                maxWidth: 420,
              }}
            >
              Tell {photographer.displayName} a few details about your event. You&apos;ll receive a personal
              reply with availability, packages, and next steps — usually within a few hours.
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 16 }}>
              <ContactDetail palette={palette} icon="◷" label="Response time" value="Within a few hours" />
              <ContactDetail palette={palette} icon="✦" label="Availability" value="Booking 2026 — 2027" />
              <ContactDetail palette={palette} icon="◉" label="Languages" value="Deutsch · English" />
            </ul>
          </div>

          <div>
            <RequestForm subdomain={photographer.subdomain} variant={variant} />
          </div>
        </div>
      </div>
    </section>
  );
}

function ContactDetail({
  palette,
  icon,
  label,
  value,
}: {
  palette: Palette;
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <li style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      <span
        style={{
          width: 36,
          height: 36,
          flexShrink: 0,
          borderRadius: 8,
          background: palette.bgElevated,
          border: `1px solid ${palette.hairline}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: palette.textMuted,
          fontSize: 14,
        }}
      >
        {icon}
      </span>
      <div>
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: palette.textSubtle,
            marginBottom: 2,
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 14, color: palette.text }}>{value}</div>
      </div>
    </li>
  );
}

function Footer({
  palette,
  poweredBy,
  photographer,
}: {
  palette: Palette;
  poweredBy: boolean;
  photographer: PublicPortfolioPayload['photographer'];
}) {
  return (
    <footer
      style={{
        padding: '40px 24px',
        borderTop: `1px solid ${palette.hairline}`,
        background: palette.bg,
        color: palette.textMuted,
        fontSize: 13,
      }}
    >
      <div
        style={{
          maxWidth: 1440,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>© {new Date().getFullYear()} {photographer.displayName}. All rights reserved.</div>
        {poweredBy && (
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <span style={{ color: palette.textSubtle }}>
              Powered by{' '}
              <Link href="/" style={{ color: palette.text, fontWeight: 500, textDecoration: 'none' }}>
                Fotolio
              </Link>
            </span>
            <Link
              href="/register"
              style={{
                color: palette.text,
                fontSize: 12,
                fontWeight: 500,
                textDecoration: 'none',
                padding: '6px 12px',
                border: `1px solid ${palette.hairline}`,
                borderRadius: 999,
                transition: 'border-color 0.2s ease',
              }}
            >
              Try it free →
            </Link>
          </div>
        )}
      </div>
    </footer>
  );
}

function Lightbox({
  photo,
  index,
  total,
  onClose,
  onPrev,
  onNext,
}: {
  photo: PublicPortfolioPayload['photos'][number];
  index: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const counter = useMemo(() => `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, [index, total]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0, 0, 0, 0.96)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      {/* Top bar: counter + close */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#FAFAFA',
        }}
      >
        <span
          style={{
            fontSize: 12,
            letterSpacing: '0.15em',
            fontVariantNumeric: 'tabular-nums',
            opacity: 0.85,
          }}
        >
          {counter}
        </span>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            border: 'none',
            background: 'rgba(255,255,255,0.1)',
            color: '#FAFAFA',
            fontSize: 18,
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onPrev();
        }}
        aria-label="Previous photograph"
        style={lightboxNavBtn('left')}
      >
        ‹
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.viewUrl ?? photo.thumbnailUrl ?? ''}
        alt=""
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '88vw',
          maxHeight: '82vh',
          borderRadius: 2,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      />

      <button
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
        aria-label="Next photograph"
        style={lightboxNavBtn('right')}
      >
        ›
      </button>

      {/* Bottom hint: keyboard shortcuts */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'rgba(250,250,250,0.5)',
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          display: 'flex',
          gap: 16,
        }}
      >
        <span>← → Navigate</span>
        <span>Esc Close</span>
      </div>
    </div>
  );
}

function lightboxNavBtn(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    [side]: 24,
    width: 52,
    height: 52,
    borderRadius: 999,
    border: 'none',
    background: 'rgba(255,255,255,0.08)',
    color: '#FAFAFA',
    fontSize: 28,
    lineHeight: 1,
    cursor: 'pointer',
    transition: 'background 0.2s ease',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  };
}
