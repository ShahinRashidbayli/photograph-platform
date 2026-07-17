/**
 * Structured content for the German legal pages (Impressum, Datenschutz, AGB).
 *
 * ⚠️  DRAFT / TEMPLATE — NOT YET LEGALLY BINDING.
 * This is a *scaffold* built from the actual tech stack so the pages exist,
 * are reachable, and carry the correct statutory structure (§5 DDG, GDPR
 * Art. 13/14). The company identity and the legally-sensitive wording must be
 * finalised with a generator (eRecht24 / Dr. Schwenke) or a lawyer before
 * launch — see issue #7. Do NOT copy legal text from another site.
 *
 * Everything wrapped in [square brackets] is a PLACEHOLDER that must be filled
 * in. The page renderer highlights these so they can't be missed.
 */

// Bump when the finalised text is published.
export const LEGAL_UPDATED = '9. Juli 2026 (Entwurf)';

/**
 * Operator identity. Known values (domain, support email) are filled; anything
 * requiring the operator's real legal data is a bracketed placeholder.
 */
export const COMPANY = {
  name: '[Vollständiger Name des Betreibers]',
  legalForm: '[Rechtsform – z. B. Einzelunternehmen, UG (haftungsbeschränkt), GmbH]',
  street: '[Straße & Hausnummer]',
  city: '[PLZ und Ort]',
  country: 'Deutschland',
  represented: '[Vertretungsberechtigte Person – nur bei Gesellschaften]',
  email: 'support@fotolio.de',
  phone: '[Telefonnummer]',
  vatId: '[USt-IdNr. gemäß §27a UStG – falls vorhanden]',
  register: '[Registergericht & Registernummer – falls im Handelsregister eingetragen]',
  responsibleMStV: '[Name & Anschrift – verantwortlich i. S. d. §18 Abs. 2 MStV]',
  supervisoryAuthority: '[Zuständige Landesdatenschutzbehörde – nach Bundesland des Betreibers]',
  hostingProvider: '[Hosting-Anbieter & Serverstandort]',
  domain: 'fotolio.de',
} as const;

// ── Types ────────────────────────────────────────────────────────────────
export type LegalBlock =
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'defs'; rows: { k: string; v: string }[] };

export type LegalSection = { heading?: string; blocks: LegalBlock[] };

export type LegalDoc = {
  slug: 'impressum' | 'datenschutz' | 'agb';
  title: string;
  subtitle: string;
  sections: LegalSection[];
};

// ── Impressum (§5 DDG) ─────────────────────────────────────────────────────
export const IMPRESSUM: LegalDoc = {
  slug: 'impressum',
  title: 'Impressum',
  subtitle: 'Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz)',
  sections: [
    {
      heading: 'Diensteanbieter',
      blocks: [
        {
          type: 'defs',
          rows: [
            { k: 'Betreiber', v: COMPANY.name },
            { k: 'Rechtsform', v: COMPANY.legalForm },
            { k: 'Anschrift', v: `${COMPANY.street}, ${COMPANY.city}, ${COMPANY.country}` },
            { k: 'Vertreten durch', v: COMPANY.represented },
          ],
        },
      ],
    },
    {
      heading: 'Kontakt',
      blocks: [
        {
          type: 'defs',
          rows: [
            { k: 'E-Mail', v: COMPANY.email },
            { k: 'Telefon', v: COMPANY.phone },
            { k: 'Website', v: `https://${COMPANY.domain}` },
          ],
        },
      ],
    },
    {
      heading: 'Umsatzsteuer',
      blocks: [
        {
          type: 'defs',
          rows: [{ k: 'USt-IdNr.', v: COMPANY.vatId }],
        },
        {
          type: 'p',
          text: 'Kleinunternehmer nach §19 UStG: falls zutreffend, wird keine Umsatzsteuer ausgewiesen. [Zutreffendes bitte prüfen/anpassen.]',
        },
      ],
    },
    {
      heading: 'Registereintrag',
      blocks: [{ type: 'defs', rows: [{ k: 'Handelsregister', v: COMPANY.register }] }],
    },
    {
      heading: 'Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV',
      blocks: [{ type: 'p', text: COMPANY.responsibleMStV }],
    },
    {
      heading: 'EU-Streitschlichtung',
      blocks: [
        {
          type: 'p',
          text: 'Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: https://ec.europa.eu/consumers/odr/. Unsere E-Mail-Adresse finden Sie oben im Impressum.',
        },
        {
          type: 'p',
          text: 'Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen. [Bitte final prüfen.]',
        },
      ],
    },
    {
      heading: 'Haftung für Inhalte und Links',
      blocks: [
        {
          type: 'p',
          text: 'Als Diensteanbieter sind wir für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Für Inhalte externer Links sind ausschließlich deren Betreiber verantwortlich; zum Zeitpunkt der Verlinkung waren keine Rechtsverstöße erkennbar. Bei Bekanntwerden von Rechtsverletzungen entfernen wir derartige Links umgehend.',
        },
        {
          type: 'p',
          text: 'Die durch den Betreiber erstellten Inhalte und Werke unterliegen dem deutschen Urheberrecht. Beiträge Dritter sind als solche gekennzeichnet.',
        },
      ],
    },
  ],
};

// ── Datenschutzerklärung (GDPR Art. 13/14) ─────────────────────────────────
export const DATENSCHUTZ: LegalDoc = {
  slug: 'datenschutz',
  title: 'Datenschutzerklärung',
  subtitle: 'Informationen nach Art. 13 und 14 DSGVO',
  sections: [
    {
      heading: '1. Verantwortlicher',
      blocks: [
        {
          type: 'p',
          text: `Verantwortlich für die Datenverarbeitung auf ${COMPANY.domain} ist ${COMPANY.name}, ${COMPANY.street}, ${COMPANY.city}. Kontakt: ${COMPANY.email}. Weitere Angaben finden Sie im Impressum.`,
        },
      ],
    },
    {
      heading: '2. Welche Daten wir verarbeiten',
      blocks: [
        {
          type: 'list',
          items: [
            'Registrierungsdaten von Fotograf:innen: Name, E-Mail-Adresse, Passwort (nur als kryptografischer Hash gespeichert), gewählte Subdomain.',
            'Kunden-Login: E-Mail-Adresse für die Anmeldung per Magic-Link.',
            'Buchungsdaten: Name und Kontaktdaten der Kund:innen, Termindetails, Paket-/Preisangaben, interne Notizen.',
            'Portfolio- und Galerie-Uploads: hochgeladene Bild- und Mediendateien.',
            'Nutzungs- und Server-Logdaten: IP-Adresse, Datum/Uhrzeit, aufgerufene Ressource, Browsertyp (technisch erforderlich für Betrieb und Sicherheit).',
            'Cookies und lokale Speicherung: siehe Abschnitt 8.',
          ],
        },
      ],
    },
    {
      heading: '3. Zwecke und Rechtsgrundlagen',
      blocks: [
        {
          type: 'defs',
          rows: [
            { k: 'Bereitstellung des Dienstes, Vertragserfüllung', v: 'Art. 6 Abs. 1 lit. b DSGVO' },
            { k: 'Sicherheit, E-Mail-Verifizierung, Missbrauchsvermeidung', v: 'Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse)' },
            { k: 'Einwilligungsbasierte Verarbeitung (z. B. optionale Kommunikation)', v: 'Art. 6 Abs. 1 lit. a DSGVO' },
            { k: 'Gesetzliche Aufbewahrungspflichten (z. B. GoBD/Rechnungen)', v: 'Art. 6 Abs. 1 lit. c DSGVO' },
          ],
        },
      ],
    },
    {
      heading: '4. Auftragsverarbeiter und Empfänger',
      blocks: [
        {
          type: 'p',
          text: 'Wir setzen sorgfältig ausgewählte Dienstleister ein, die Daten ausschließlich weisungsgebunden in unserem Auftrag verarbeiten. Mit jedem Auftragsverarbeiter ist ein Vertrag nach Art. 28 DSGVO abzuschließen [Abschluss bitte je Anbieter prüfen/dokumentieren]:',
        },
        {
          type: 'defs',
          rows: [
            { k: 'Resend', v: 'Versand transaktionaler E-Mails (Verifizierung, Magic-Link, Benachrichtigungen).' },
            { k: 'Cloudflare R2', v: 'Speicherung von Portfolio- und Galerie-Bilddateien.' },
            { k: COMPANY.hostingProvider, v: 'Betrieb von Web-/API-Servern und PostgreSQL-Datenbank (Speicherung der Stamm- und Buchungsdaten).' },
            { k: 'Redis', v: 'Temporäres Caching/Session-Handling.' },
            { k: 'Stripe', v: 'Zahlungsabwicklung – sobald die Zahlungsfunktion aktiviert ist (derzeit noch nicht live).' },
          ],
        },
      ],
    },
    {
      heading: '5. Übermittlung in Drittländer',
      blocks: [
        {
          type: 'p',
          text: 'Einzelne Dienstleister (z. B. Resend, Cloudflare, Stripe) können Daten außerhalb der EU/des EWR verarbeiten. In diesen Fällen erfolgt die Übermittlung auf Grundlage geeigneter Garantien (EU-Standardvertragsklauseln bzw. Angemessenheitsbeschluss). [Konkrete Grundlage je Anbieter bitte final prüfen und ergänzen.]',
        },
      ],
    },
    {
      heading: '6. Speicherdauer',
      blocks: [
        {
          type: 'p',
          text: 'Wir speichern personenbezogene Daten nur so lange, wie es für die genannten Zwecke erforderlich ist oder gesetzliche Aufbewahrungsfristen es verlangen (z. B. bis zu 10 Jahre für steuerlich relevante Unterlagen nach GoBD). Danach werden die Daten gelöscht oder anonymisiert.',
        },
      ],
    },
    {
      heading: '7. Ihre Rechte',
      blocks: [
        {
          type: 'p',
          text: 'Sie haben nach der DSGVO folgende Rechte gegenüber dem Verantwortlichen:',
        },
        {
          type: 'list',
          items: [
            'Auskunft über die verarbeiteten Daten (Art. 15).',
            'Berichtigung unrichtiger Daten (Art. 16).',
            'Löschung (Art. 17) und Einschränkung der Verarbeitung (Art. 18).',
            'Datenübertragbarkeit (Art. 20).',
            'Widerspruch gegen die Verarbeitung (Art. 21).',
            'Widerruf einer erteilten Einwilligung mit Wirkung für die Zukunft (Art. 7 Abs. 3).',
          ],
        },
      ],
    },
    {
      heading: '8. Cookies und lokale Speicherung',
      blocks: [
        {
          type: 'p',
          text: 'Wir verwenden ausschließlich technisch notwendige Cookies bzw. lokale Speicher: ein HTTP-only-Cookie zur Anmeldung/Sitzungsverwaltung sowie eine lokale Speicherung Ihrer Theme-Einstellung (hell/dunkel). Diese sind für den Betrieb erforderlich und nach §25 Abs. 2 TTDSG einwilligungsfrei.',
        },
        {
          type: 'p',
          text: 'Es werden derzeit keine Tracking-, Analyse- oder Marketing-Cookies gesetzt. Sobald solche eingesetzt werden, wird ein Cookie-Consent-Banner nach §25 Abs. 1 TTDSG ergänzt.',
        },
      ],
    },
    {
      heading: '9. Beschwerderecht',
      blocks: [
        {
          type: 'p',
          text: `Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren (Art. 77 DSGVO). Zuständig ist u. a. ${COMPANY.supervisoryAuthority}.`,
        },
      ],
    },
    {
      heading: '10. Kontakt in Datenschutzfragen',
      blocks: [
        { type: 'p', text: `Für Anfragen zum Datenschutz erreichen Sie uns unter ${COMPANY.email}.` },
      ],
    },
  ],
};

// ── AGB (two-tier terms) ───────────────────────────────────────────────────
export const AGB: LegalDoc = {
  slug: 'agb',
  title: 'Allgemeine Geschäftsbedingungen',
  subtitle: 'Nutzungsbedingungen der Plattform und Muster-AGB für Fotograf:innen',
  sections: [
    {
      blocks: [
        {
          type: 'p',
          text: 'Diese AGB gliedern sich in zwei Ebenen: Teil A regelt das Verhältnis zwischen dem Plattformbetreiber und den Fotograf:innen als Nutzer:innen. Teil B ist eine anpassbare Vorlage für das Verhältnis zwischen Fotograf:innen und deren Endkund:innen.',
        },
      ],
    },
    {
      heading: 'Teil A — Nutzungsbedingungen Fotolio (Betreiber ↔ Fotograf:in)',
      blocks: [
        {
          type: 'list',
          items: [
            '§1 Geltungsbereich: Diese Bedingungen gelten für die Nutzung der Fotolio-Plattform durch registrierte Fotograf:innen.',
            '§2 Leistungsbeschreibung: Fotolio stellt Werkzeuge für Portfolio, Buchungen, Lead-Verwaltung und Galerien bereit. Der Funktionsumfang kann sich weiterentwickeln.',
            '§3 Vertragsschluss & Testphase: Mit der Registrierung kommt ein Nutzungsvertrag zustande. Die kostenlose Testphase beträgt 14 Tage. [Bedingungen final festlegen.]',
            '§4 Preise & Zahlung: Es gelten die zum Zeitpunkt der Buchung angegebenen Preise. [Abrechnung/Stripe ergänzen, sobald Zahlungen aktiv sind.]',
            '§5 Pflichten der Nutzer:innen: Rechtmäßige Nutzung, keine Rechtsverletzung durch hochgeladene Inhalte, Geheimhaltung der Zugangsdaten.',
            '§6 Verfügbarkeit: Wir bemühen uns um hohe Verfügbarkeit, schulden aber keine ununterbrochene Erreichbarkeit. [Ggf. SLA festlegen.]',
            '§7 Haftung: Haftung nach den gesetzlichen Vorschriften; Beschränkung auf Vorsatz und grobe Fahrlässigkeit, soweit gesetzlich zulässig. [Juristisch prüfen.]',
            '§8 Laufzeit & Kündigung: Der Vertrag ist jederzeit kündbar. [Fristen/Modalitäten festlegen.]',
            '§9 Datenschutz: Es gilt die Datenschutzerklärung.',
            '§10 Schlussbestimmungen: Es gilt deutsches Recht. Gerichtsstand ist – soweit zulässig – der Sitz des Betreibers. [Prüfen.]',
          ],
        },
      ],
    },
    {
      heading: 'Teil B — Muster-AGB Fotograf:in ↔ Endkund:in (Vorlage)',
      blocks: [
        {
          type: 'p',
          text: 'Diese Vorlage können Fotograf:innen an ihr Angebot anpassen. Sie ersetzt keine individuelle Rechtsberatung.',
        },
        {
          type: 'list',
          items: [
            'Leistungsumfang: Art und Umfang des Shootings, Anzahl der bearbeiteten Bilder, Liefertermin.',
            'Buchung & Termin: Zustandekommen der Buchung, Terminvereinbarung, Verschiebung.',
            'Preise & Anzahlung: Gesamtpreis, Anzahlung/Depot, Fälligkeit der Restzahlung.',
            'Stornierung & Ausfall: Stornofristen, Ausfallhonorar, höhere Gewalt, Krankheit.',
            'Nutzungsrechte an Bildern: Umfang der eingeräumten Rechte, Eigenwerbung des Fotografen, Model-Release.',
            'Datenschutz & Einwilligung: Verarbeitung der Kundendaten, Veröffentlichung von Aufnahmen.',
            'Gewährleistung & Haftung sowie anwendbares Recht.',
          ],
        },
      ],
    },
  ],
};

export const LEGAL_DOCS: Record<LegalDoc['slug'], LegalDoc> = {
  impressum: IMPRESSUM,
  datenschutz: DATENSCHUTZ,
  agb: AGB,
};
