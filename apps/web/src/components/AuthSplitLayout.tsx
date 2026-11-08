'use client';

import { FotolioLogo } from '@/components/FotolioLogo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { lpDisplay, lpSans } from '@/app/_landing/fonts';
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
  /** A word wrapped in `*asterisks*` is set as the panel's one accent word. */
  visualTitle: string;
  visualSubtitle: string;
  /**
   * Photo shown on the brand panel. Defaults to the photographer-facing camera
   * shot; the client sign-in passes the photobook, because its audience cares
   * about their photos, not the gear — and the two sign-ins should not look
   * like the same page.
   */
  visualImage?: string;
  /** Max width of the centred form content. Register needs a touch more. */
  contentMaxWidth?: number;
}

// Photography visuals for the brand panel, shipped in /public so they load with
// no external request.
// Credited, with the landing page's photographs, in `app/_landing/stock.ts`.
const VISUAL_IMAGE = '/brand/auth-photographer.webp';

/**
 * "Your *studio*, …" → the starred word in the display face, the way the
 * landing hero sets "craft". Plain text passes through untouched, so a title
 * without stars renders exactly as before.
 */
function withAccent(title: string): ReactNode[] {
  return title.split(/(\*[^*]+\*)/).map((part, i) =>
    part.length > 2 && part.startsWith('*') && part.endsWith('*') ? (
      <em key={i} className="auth-visual-accent">
        {part.slice(1, -1)}
      </em>
    ) : (
      part
    )
  );
}

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
      {/* The brand panel speaks the landing page's language — its faces, its
          charcoal room, its one gold word — because it is the step between
          that page and the app. The form column on the right stays the app's
          (Geist, ink on paper): it is what the dashboard looks like next. */}
      <aside
        className={`auth-visual ${lpSans.variable} ${lpDisplay.variable}`}
        style={{
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '44px 48px',
          color: '#F6F1E9',
          fontFamily: 'var(--font-lp), ' + fonts.sans,
          // A neutral darkroom scrim over the photo (multi-background: the
          // gradients paint on top, the image underneath). It used to be a
          // violet wash, which tinted a photography product's one photograph
          // purple. Weighted darker on the left — where the logo, headline and
          // footer sit — and toward the bottom so the footer stays legible; the
          // right side is left almost clear so the photograph reads as itself.
          // If the image is ever missing, the scrim alone still reads as a
          // finished panel. The landing hero's charcoal (#1C1A17), so the two
          // pages are one room.
          background:
            'linear-gradient(100deg, rgba(28,26,23,0.82) 0%, rgba(28,26,23,0.55) 40%, rgba(28,26,23,0.15) 75%, rgba(28,26,23,0.05) 100%),' +
            'linear-gradient(0deg, rgba(28,26,23,0.78) 0%, transparent 40%),' +
            '#1C1A17 ' +
            `url('${visualImage}')`,
          backgroundSize: 'cover',
          // Left of centre, so the subject of the photograph lands on the panel's
          // clear right side and the headline on the left sits on the scrim.
          backgroundPosition: '6% center',
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
          <h1
            style={{
              fontSize: '2.5rem',
              fontWeight: 500,
              lineHeight: 1.06,
              letterSpacing: '-0.035em',
              margin: '0 0 14px 0',
              // A title may carry its own line break ("Your photos,\nyour moments").
              whiteSpace: 'pre-line',
            }}
          >
            {withAccent(visualTitle)}
          </h1>
          <p
            style={{
              fontSize: '1rem',
              lineHeight: 1.6,
              margin: 0,
              color: '#BDB5A8',
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
            color: '#A69E91',
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
            <Link key={l.href} href={l.href} style={{ color: '#BDB5A8', textDecoration: 'none' }}>
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
