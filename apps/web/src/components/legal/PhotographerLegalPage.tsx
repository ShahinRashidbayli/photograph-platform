import Link from 'next/link';
import type { PhotographerLegal } from '@/lib/photographer-legal';
import { formatAddress } from '@/lib/photographer-legal';
import { PhotographerLegalFooter } from './PhotographerLegalFooter';

const C = {
  bg: '#F9FAFB',
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  muted: '#475569',
  warnBg: '#FEF3C7',
  warnBorder: '#FCD34D',
  warnText: '#78350F',
} as const;

type Row = { k: string; v: string | null | undefined };

function Definitions({ rows }: Readonly<{ rows: Row[] }>) {
  const filled = rows.filter((r) => r.v && r.v.trim().length > 0);
  if (filled.length === 0) return null;
  return (
    <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, auto) 1fr', gap: '8px 20px', margin: 0 }}>
      {filled.map((r) => (
        <div key={r.k} style={{ display: 'contents' }}>
          <dt style={{ fontWeight: 600, color: C.muted, fontSize: '0.9rem' }}>{r.k}</dt>
          <dd style={{ margin: 0, color: C.text, fontSize: '0.95rem' }}>{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Section({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 12px', color: C.text }}>{title}</h2>
      {children}
    </section>
  );
}

/**
 * Renders a photographer's own Impressum or Datenschutz.
 *
 * <p>When the mandatory fields are missing the page says so plainly instead of
 * rendering an Impressum with holes in it. That is deliberate: a page that
 * *looks* like a compliant Impressum but omits required particulars is worse
 * than an obvious gap, because it invites the visitor — and the photographer —
 * to believe the duty has been discharged.
 */
export function PhotographerLegalPage({
  legal,
  variant,
}: Readonly<{ legal: PhotographerLegal; variant: 'impressum' | 'datenschutz' }>) {
  const name = legal.legalName ?? legal.subdomain;
  const title = variant === 'impressum' ? 'Impressum' : 'Datenschutzerklärung';

  return (
    <main
      style={{
        minHeight: '100vh',
        background: C.bg,
        padding: '32px 16px 64px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <Link
          href={`/p/${encodeURIComponent(legal.subdomain)}`}
          style={{ fontSize: '0.85rem', color: C.muted, textDecoration: 'none' }}
        >
          ← Zurück zum Portfolio
        </Link>

        <h1 style={{ fontSize: 30, fontWeight: 700, margin: '16px 0 4px', color: C.text }}>{title}</h1>
        <p style={{ color: C.muted, margin: '0 0 24px', fontSize: '0.95rem' }}>{name}</p>

        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: 24,
          }}
        >
          {!legal.complete && (
            <div
              role="status"
              style={{
                background: C.warnBg,
                border: `1px solid ${C.warnBorder}`,
                color: C.warnText,
                borderRadius: 8,
                padding: '12px 14px',
                marginBottom: 20,
                fontSize: '0.9rem',
                lineHeight: 1.5,
              }}
            >
              <strong>Diese Angaben sind noch nicht vollständig.</strong> Der
              Anbieter hat die gesetzlich erforderlichen Pflichtangaben nach §5
              DDG noch nicht hinterlegt.
            </div>
          )}

          {variant === 'impressum' ? (
            <>
              <Section title="Angaben gemäß §5 DDG">
                <Definitions
                  rows={[
                    { k: 'Anbieter', v: legal.legalName },
                    { k: 'Anschrift', v: formatAddress(legal) || null },
                  ]}
                />
              </Section>

              <Section title="Kontakt">
                <Definitions
                  rows={[
                    { k: 'E-Mail', v: legal.legalEmail },
                    { k: 'Telefon', v: legal.legalPhone },
                  ]}
                />
              </Section>

              {(legal.legalVatId || legal.legalRegister) && (
                <Section title="Registrierung & Steuer">
                  <Definitions
                    rows={[
                      { k: 'USt-IdNr.', v: legal.legalVatId },
                      { k: 'Register', v: legal.legalRegister },
                    ]}
                  />
                </Section>
              )}

              <Section title="Verantwortlich gemäß §18 Abs. 2 MStV">
                <Definitions rows={[{ k: 'Verantwortlich', v: legal.legalResponsible }]} />
              </Section>

              <Section title="EU-Streitschlichtung">
                <p style={{ margin: 0, color: C.muted, fontSize: '0.92rem', lineHeight: 1.6 }}>
                  Die Europäische Kommission stellt eine Plattform zur
                  Online-Streitbeilegung bereit:{' '}
                  <a
                    href="https://ec.europa.eu/consumers/odr/"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: C.text }}
                  >
                    ec.europa.eu/consumers/odr
                  </a>
                  . Wir sind nicht verpflichtet und nicht bereit, an einem
                  Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
                  teilzunehmen.
                </p>
              </Section>
            </>
          ) : (
            <>
              <Section title="Verantwortlicher im Sinne der DSGVO">
                <Definitions
                  rows={[
                    { k: 'Verantwortlich', v: legal.legalName },
                    { k: 'Anschrift', v: formatAddress(legal) || null },
                    { k: 'E-Mail', v: legal.privacyContactEmail ?? legal.legalEmail },
                  ]}
                />
              </Section>

              <Section title="Welche Daten wir erheben">
                <p style={{ margin: 0, color: C.muted, fontSize: '0.92rem', lineHeight: 1.6 }}>
                  Wenn Sie das Anfrageformular ausfüllen, verarbeiten wir Ihren
                  Namen, Ihre E-Mail-Adresse, optional Ihre Telefonnummer sowie
                  die Angaben zu Ihrem gewünschten Termin (Datum, Art des
                  Termins, Budgetrahmen, Nachricht). Diese Angaben benötigen wir,
                  um Ihre Anfrage zu beantworten.
                </p>
              </Section>

              <Section title="Rechtsgrundlage">
                <p style={{ margin: 0, color: C.muted, fontSize: '0.92rem', lineHeight: 1.6 }}>
                  Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b
                  DSGVO — zur Durchführung vorvertraglicher Maßnahmen, die auf
                  Ihre Anfrage hin erfolgen.
                </p>
              </Section>

              <Section title="Speicherdauer">
                <p style={{ margin: 0, color: C.muted, fontSize: '0.92rem', lineHeight: 1.6 }}>
                  Anfragen werden gelöscht, sobald sie für die Bearbeitung nicht
                  mehr erforderlich sind, spätestens jedoch nach Ablauf etwaiger
                  handels- und steuerrechtlicher Aufbewahrungsfristen.
                </p>
              </Section>

              <Section title="Auftragsverarbeitung">
                <p style={{ margin: 0, color: C.muted, fontSize: '0.92rem', lineHeight: 1.6 }}>
                  Für den Betrieb dieser Seite nutzen wir Fotolio als
                  Auftragsverarbeiter gemäß Art. 28 DSGVO.
                </p>
              </Section>

              <Section title="Ihre Rechte">
                <p style={{ margin: 0, color: C.muted, fontSize: '0.92rem', lineHeight: 1.6 }}>
                  Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art.
                  16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art.
                  18) und Datenübertragbarkeit (Art. 20) sowie ein
                  Widerspruchsrecht (Art. 21). Zudem können Sie sich bei einer
                  Datenschutz-Aufsichtsbehörde beschweren (Art. 77).
                </p>
              </Section>
            </>
          )}
        </div>

        <PhotographerLegalFooter
          subdomain={legal.subdomain}
          displayName={name}
          muted={C.muted}
          border={C.border}
        />
      </div>
    </main>
  );
}
