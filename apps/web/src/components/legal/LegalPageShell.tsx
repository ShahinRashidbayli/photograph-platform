'use client';

import { FotolioLogo } from '@/components/FotolioLogo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { getColors } from '@/lib/design-tokens';
import { LEGAL_UPDATED, type LegalBlock, type LegalDoc } from '@/lib/legal-content';
import { useThemeStore } from '@/store/themeStore';
import Link from 'next/link';
import { Fragment, type CSSProperties, type ReactNode } from 'react';

/**
 * LegalPageShell — one layout for every legal page (Impressum, Datenschutz,
 * AGB). Renders the marketing chrome (logo + theme toggle), a prominent
 * "draft, not yet binding" notice, the structured document, and a slim footer
 * whose links satisfy the "≤ 2 clicks to Impressum" requirement from issue #7.
 *
 * Placeholders written as [text] in the content are highlighted so unfinished
 * fields are impossible to miss on the rendered page.
 */
export function LegalPageShell({ doc }: { doc: LegalDoc }) {
  const { theme } = useThemeStore();
  const c = getColors(theme);
  const year = new Date().getFullYear();

  const legalLinks = [
    { href: '/impressum', label: 'Impressum' },
    { href: '/datenschutz', label: 'Datenschutz' },
    { href: '/agb', label: 'AGB' },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: c.bg,
        color: c.text,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav
        style={{
          borderBottom: `1px solid ${c.border}`,
          background: c.surface,
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: '0 auto',
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Link href="/" aria-label="Fotolio Startseite" style={{ textDecoration: 'none' }}>
            <FotolioLogo theme={theme} variant="brand" showText={true} />
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <LanguageToggle variant="pill" />
            <ThemeToggle variant="pill" />
            <Link
              href="/"
              style={{
                fontSize: '0.88rem',
                fontWeight: 600,
                color: c.textMuted,
                textDecoration: 'none',
              }}
            >
              ← Zur Startseite
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Content ─────────────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          maxWidth: 820,
          width: '100%',
          margin: '0 auto',
          padding: '40px 24px 72px',
        }}
      >
        <p
          style={{
            fontSize: '0.78rem',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: c.textSubtle,
            fontWeight: 600,
            margin: 0,
          }}
        >
          Rechtliches
        </p>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '10px 0 6px', lineHeight: 1.15 }}>
          {doc.title}
        </h1>
        <p style={{ fontSize: '1rem', color: c.textMuted, margin: 0 }}>{doc.subtitle}</p>
        <p style={{ fontSize: '0.82rem', color: c.textSubtle, margin: '10px 0 0' }}>
          Stand: {LEGAL_UPDATED}
        </p>

        {/* Draft notice — the content is a scaffold pending legal finalisation. */}
        <div
          role="note"
          style={{
            marginTop: 24,
            padding: '14px 16px',
            borderRadius: 12,
            background: c.warningBg,
            border: `1px solid ${c.warningBorder}`,
            color: c.warningText,
            fontSize: '0.86rem',
            lineHeight: 1.55,
          }}
        >
          <strong>Entwurf – noch nicht rechtsverbindlich.</strong> Dieser Text ist eine strukturelle
          Vorlage. Vor dem Launch müssen die mit <code style={{ fontSize: '0.8em' }}>[…]</code>{' '}
          markierten Angaben ergänzt und die Formulierungen mit einem Generator (eRecht24) oder
          einer Rechtsberatung finalisiert werden.
        </div>

        <div style={{ marginTop: 12 }}>
          {doc.sections.map((section, i) => (
            <section key={i} style={{ marginTop: 28 }}>
              {section.heading && (
                <h2
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    margin: '0 0 12px',
                    color: c.text,
                  }}
                >
                  {section.heading}
                </h2>
              )}
              {section.blocks.map((block, j) => (
                <Block key={j} block={block} c={c} />
              ))}
            </section>
          ))}
        </div>
      </main>

      {/* ── Slim footer ─────────────────────────────────────── */}
      <footer style={{ borderTop: `1px solid ${c.border}`, background: c.surfaceAlt }}>
        <div
          style={{
            maxWidth: 1180,
            margin: '0 auto',
            padding: '22px 24px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.82rem',
            color: c.textSubtle,
          }}
        >
          <span>© {year} Fotolio · Made in Germany</span>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {legalLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                style={{ color: c.textMuted, textDecoration: 'none', fontWeight: 500 }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── Block renderer ─────────────────────────────────────────────────────────
type Colors = ReturnType<typeof getColors>;

function Block({ block, c }: { block: LegalBlock; c: Colors }) {
  const pStyle: CSSProperties = {
    fontSize: '0.94rem',
    lineHeight: 1.7,
    color: c.textMuted,
    margin: '0 0 12px',
  };

  if (block.type === 'p') {
    return <p style={pStyle}>{renderText(block.text, c)}</p>;
  }

  if (block.type === 'list') {
    return (
      <ul
        style={{
          margin: '0 0 12px',
          paddingLeft: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {block.items.map((item, i) => (
          <li key={i} style={{ ...pStyle, margin: 0 }}>
            {renderText(item, c)}
          </li>
        ))}
      </ul>
    );
  }

  // defs — label/value rows.
  return (
    <dl
      style={{
        margin: '0 0 12px',
        display: 'grid',
        gridTemplateColumns: 'minmax(120px, 200px) 1fr',
        gap: '8px 20px',
      }}
    >
      {block.rows.map((row, i) => (
        <Fragment key={i}>
          <dt style={{ fontSize: '0.9rem', fontWeight: 600, color: c.text }}>
            {renderText(row.k, c)}
          </dt>
          <dd style={{ fontSize: '0.94rem', lineHeight: 1.6, color: c.textMuted, margin: 0 }}>
            {renderText(row.v, c)}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}

/**
 * Turn a plain string into React nodes: [placeholders] are highlighted, bare
 * URLs and e-mail addresses become links. Kept dependency-free.
 */
function renderText(text: string, c: Colors): ReactNode {
  // Split on placeholders, URLs and emails while keeping the delimiters.
  const pattern = /(\[[^\]]+\]|https?:\/\/[^\s)]+|[\w.+-]+@[\w.-]+\.\w+)/g;
  const parts = text.split(pattern);
  return parts.map((part, i) => {
    if (!part) return null;
    if (part.startsWith('[') && part.endsWith(']')) {
      return (
        <mark
          key={i}
          title="Platzhalter – bitte ausfüllen"
          style={{
            background: c.warningBg,
            color: c.warningText,
            border: `1px dashed ${c.warningBorder}`,
            borderRadius: 5,
            padding: '0 5px',
            fontWeight: 600,
            fontSize: '0.88em',
          }}
        >
          {part}
        </mark>
      );
    }
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: c.primaryText, textDecoration: 'underline' }}
        >
          {part}
        </a>
      );
    }
    if (/^[\w.+-]+@[\w.-]+\.\w+$/.test(part)) {
      return (
        <a
          key={i}
          href={`mailto:${part}`}
          style={{ color: c.primaryText, textDecoration: 'underline' }}
        >
          {part}
        </a>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}
