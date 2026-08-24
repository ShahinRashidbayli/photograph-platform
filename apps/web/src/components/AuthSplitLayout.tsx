'use client';

import { FotolioLogo } from '@/components/FotolioLogo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { fonts, getColors } from '@/lib/design-tokens';
import { useThemeStore } from '@/store/themeStore';
import Link from 'next/link';
import { useEffect, type ReactNode } from 'react';

interface AuthSplitLayoutProps {
  children: ReactNode;
  /** Optional cross-link shown in the top-right of the form column. */
  crossLink?: { href: string; label: string };
  /**
   * Headline + supporting line rendered over the branded visual panel.
   *
   * Required, and deliberately so. These used to be optional with English
   * defaults, and exactly one screen — the photographer sign-in — never passed
   * them. So the one page whose visitor *is* a photographer greeted them with
   * "Discover great photographers", copy written for a client browsing for one,
   * and it stayed in English on a German-default product because a default is
   * not a translation. An optional prop with a plausible-looking fallback hides
   * the omission; a required one cannot.
   */
  visualTitle: string;
  visualSubtitle: string;
  /**
   * Photo shown on the brand panel. Defaults to the photographer-facing craft
   * shot; the client sign-in passes a warmer, memory-focused image because its
   * audience cares about their photos, not the gear.
   */
  visualImage?: string;
  /** Max width of the centred form content. Register needs a touch more. */
  contentMaxWidth?: number;
}

// Photography visuals for the brand panel, shipped in /public so they load with
// no external request. The violet overlay below keeps white text legible on top
// and ties the photo to the brand regardless of its own colours.
const VISUAL_IMAGE = '/brand/auth-visual.jpg';

export function AuthSplitLayout({
  children,
  crossLink,
  visualTitle,
  visualSubtitle,
  visualImage = VISUAL_IMAGE,
  contentMaxWidth = 400,
}: Readonly<AuthSplitLayoutProps>) {
  const { theme } = useThemeStore();
  const c = getColors(theme);

  // Keep the page (html) background in sync with the theme. The form column is
  // transparent and sits on this background, so together with the pre-paint
  // script in the root layout the panel never flashes the light default before
  // the persisted dark theme rehydrates.
  useEffect(() => {
    document.documentElement.style.backgroundColor = c.bg;
  }, [c.bg]);

  const themeToggle = (
    <>
      <LanguageToggle variant="pill" />
      <ThemeToggle variant="pill" />
    </>
  );

  return (
    <div
      className="auth-split"
      // The token, not a copy of it — this hard-coded stack was one of the
      // places the auth screens diverged from the rest of the app.
      style={{ fontFamily: fonts.sans }}
    >
      {/* ── Left: branded photography visual ─────────────────────────── */}
      <aside
        className="auth-visual"
        style={{
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '44px 48px',
          color: '#FFFFFF',
          // Violet brand overlay layered over the photo (multi-background: the
          // gradients paint on top, the image underneath). Weighted darker on
          // the left — where the logo, headline and footer sit — and lighter on
          // the right so the photographer stays visible. A bottom fade keeps the
          // footer legible. If the image is ever missing, the gradient alone
          // still reads as a finished brand panel.
          background:
            'linear-gradient(100deg, rgba(49,46,129,0.92) 0%, rgba(67,56,202,0.70) 38%, rgba(79,70,229,0.42) 68%, rgba(99,102,241,0.30) 100%),' +
            'linear-gradient(0deg, rgba(24,22,60,0.60) 0%, transparent 32%),' +
            `url('${visualImage}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Brand */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <FotolioLogo theme="dark" variant="brand" showText={true} />
          </Link>
        </div>

        {/* Headline */}
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 420 }}>
          <div
            aria-hidden="true"
            style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}
          >
            {[0.9, 0.55, 0.32, 0.32].map((o, i) => (
              <span
                key={i}
                style={{
                  width: i === 0 ? 28 : 10,
                  height: 10,
                  borderRadius: 999,
                  background: `rgba(255,255,255,${o})`,
                }}
              />
            ))}
          </div>
          <h1
            style={{
              fontFamily: fonts.serif,
              fontSize: '2.4rem',
              fontWeight: 500,
              lineHeight: 1.12,
              letterSpacing: '-0.02em',
              margin: '0 0 14px 0',
            }}
          >
            {visualTitle}
          </h1>
          <p
            style={{
              fontSize: '1rem',
              lineHeight: 1.6,
              margin: 0,
              color: 'rgba(255,255,255,0.82)',
            }}
          >
            {visualSubtitle}
          </p>
        </div>

        {/* Footer — legal links keep Impressum/Datenschutz within two clicks of
            every page, as required for a German commercial site. */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            fontSize: '0.82rem',
            color: 'rgba(255,255,255,0.62)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '6px 14px',
          }}
        >
          <span>© {new Date().getFullYear()} Fotolio</span>
          {[
            { href: '/impressum', label: 'Impressum' },
            { href: '/datenschutz', label: 'Datenschutz' },
            { href: '/agb', label: 'AGB' },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              style={{ color: 'rgba(255,255,255,0.72)', textDecoration: 'none' }}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </aside>

      {/* ── Right: form column ───────────────────────────────────────── */}
      <main
        // Height and scrolling live in globals.css: they need `dvh` with a
        // `vh` fallback and a breakpoint, and inline styles can express
        // neither. See `.auth-form-column`.
        className="auth-form-column"
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          // Transparent so it sits on the theme-synced html background — see the
          // effect above. Avoids a light flash before the dark theme rehydrates.
          background: 'transparent',
          color: c.text,
        }}
      >
        {/* Top bar: brand (mobile only) + theme toggle + cross-link */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 28px',
            gap: 12,
          }}
        >
          <Link href="/" className="auth-form-brand" style={{ textDecoration: 'none' }}>
            <FotolioLogo theme={theme} variant="brand" showText={true} />
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
            {themeToggle}
            {crossLink && (
              <Link
                href={crossLink.href}
                style={{
                  padding: '10px 18px',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  border: `1px solid ${c.border}`,
                  background: 'transparent',
                  borderRadius: 10,
                  color: c.text,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {crossLink.label}
              </Link>
            )}
          </div>
        </div>

        {/* Centred form content */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 28px 56px',
          }}
        >
          <div style={{ width: '100%', maxWidth: contentMaxWidth }}>{children}</div>
        </div>
      </main>
    </div>
  );
}
