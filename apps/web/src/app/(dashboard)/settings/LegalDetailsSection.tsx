"use client";

import { getColors, type Theme } from '@/lib/design-tokens';
import api from '@/lib/api';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Settings → Rechtliche Angaben. Where a photographer fills in the details that
 * their own public Impressum and Datenschutz pages render.
 *
 * <p>These belong to the photographer, not to Fotolio. §5 DDG makes every
 * commercial online presence individually liable for an Impressum, and under
 * GDPR the photographer is the controller for the enquiry data their form
 * collects. Until this form is complete their public pages say so openly rather
 * than rendering a half-empty Impressum that would look compliant.
 *
 * <p>Kept as its own component because the section is long and entirely
 * self-contained — it loads and saves one endpoint and shares no state with the
 * account form above it.
 */

interface TenantLegal {
  subdomain: string;
  legalName: string | null;
  legalStreet: string | null;
  legalPostalCode: string | null;
  legalCity: string | null;
  legalCountry: string | null;
  legalEmail: string | null;
  legalPhone: string | null;
  legalVatId: string | null;
  legalRegister: string | null;
  legalResponsible: string | null;
  privacyContactEmail: string | null;
  complete: boolean;
}

type FormState = Omit<TenantLegal, 'subdomain' | 'complete'>;

const EMPTY: FormState = {
  legalName: '',
  legalStreet: '',
  legalPostalCode: '',
  legalCity: '',
  legalCountry: 'Deutschland',
  legalEmail: '',
  legalPhone: '',
  legalVatId: '',
  legalRegister: '',
  legalResponsible: '',
  privacyContactEmail: '',
};

/** Mirrors TenantLegalService.isComplete — the mandatory §5 DDG set. */
const REQUIRED: Array<keyof FormState> = [
  'legalName',
  'legalStreet',
  'legalPostalCode',
  'legalCity',
  'legalEmail',
  'legalPhone',
];

function toForm(data: TenantLegal): FormState {
  return {
    legalName: data.legalName ?? '',
    legalStreet: data.legalStreet ?? '',
    legalPostalCode: data.legalPostalCode ?? '',
    legalCity: data.legalCity ?? '',
    legalCountry: data.legalCountry ?? 'Deutschland',
    legalEmail: data.legalEmail ?? '',
    legalPhone: data.legalPhone ?? '',
    legalVatId: data.legalVatId ?? '',
    legalRegister: data.legalRegister ?? '',
    legalResponsible: data.legalResponsible ?? '',
    privacyContactEmail: data.privacyContactEmail ?? '',
  };
}

export function LegalDetailsSection({ theme }: { readonly theme: Theme }) {
  const c = useMemo(() => getColors(theme), [theme]);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [subdomain, setSubdomain] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const { data } = await api.get<TenantLegal>('/api/tenant/legal');
      setForm(toForm(data));
      setSubdomain(data.subdomain);
    } catch {
      setLoadError('Rechtliche Angaben konnten nicht geladen werden.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Computed from the live form rather than the server's `complete` flag so the
  // banner reacts as the photographer types, instead of only after a save.
  const missing = REQUIRED.filter((k) => !form[k] || form[k]!.trim().length === 0);
  const complete = missing.length === 0;

  function set(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const { data } = await api.put<TenantLegal>('/api/tenant/legal', form);
      setForm(toForm(data));
      setSubdomain(data.subdomain);
      setSaved(true);
    } catch {
      setSaveError('Speichern fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setSaving(false);
    }
  }

  const section: React.CSSProperties = {
    background: c.surface,
    border: `1px solid ${c.border}`,
    borderRadius: '14px',
    padding: '24px',
    marginBottom: '20px',
    boxShadow: c.overlayShadow,
  };

  const input: React.CSSProperties = {
    padding: '10px 14px',
    border: `1px solid ${c.border}`,
    borderRadius: '10px',
    fontSize: '0.92rem',
    color: c.text,
    background: c.surfaceAlt,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };

  const label: React.CSSProperties = {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: c.textMuted,
    letterSpacing: '0.02em',
  };

  const field = (
    key: keyof FormState,
    labelText: string,
    opts: { type?: string; hint?: string } = {}
  ) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={label} htmlFor={`legal-${key}`}>
        {labelText}
        {REQUIRED.includes(key) && <span style={{ color: c.danger }}> *</span>}
      </label>
      <input
        id={`legal-${key}`}
        type={opts.type ?? 'text'}
        value={form[key] ?? ''}
        onChange={(e) => set(key, e.target.value)}
        style={input}
      />
      {opts.hint && (
        <span style={{ fontSize: '0.76rem', color: c.textMuted }}>{opts.hint}</span>
      )}
    </div>
  );

  return (
    <section style={section} aria-labelledby="settings-legal">
      <h2
        id="settings-legal"
        style={{ fontSize: '1.05rem', fontWeight: 700, color: c.text, margin: '0 0 6px' }}
      >
        Rechtliche Angaben
      </h2>
      <p style={{ fontSize: '0.88rem', color: c.textMuted, margin: '0 0 18px', lineHeight: 1.6 }}>
        Diese Angaben erscheinen im Impressum und in der Datenschutzerklärung
        Ihrer öffentlichen Seite. Sie sind gesetzlich verpflichtet (§5 DDG,
        Art. 13 DSGVO), sie zu hinterlegen — Fotolios eigenes Impressum deckt
        Ihre Seite nicht ab.
      </p>

      {loadError && (
        <div role="alert" style={{ color: c.danger, fontSize: '0.88rem', marginBottom: 14 }}>
          {loadError}
        </div>
      )}

      <div
        role="status"
        style={{
          background: complete ? c.successBg : c.warningBg,
          border: `1px solid ${complete ? c.successBorder : c.warningBorder}`,
          color: complete ? c.successText : c.warningText,
          borderRadius: 10,
          padding: '12px 14px',
          fontSize: '0.86rem',
          lineHeight: 1.55,
          marginBottom: 18,
        }}
      >
        {complete ? (
          <>
            <strong>Pflichtangaben vollständig.</strong> Ihre öffentliche Seite
            zeigt ein gültiges Impressum.
            {subdomain && (
              <>
                {' '}
                <Link
                  href={`/p/${encodeURIComponent(subdomain)}/impressum`}
                  target="_blank"
                  style={{ color: 'inherit', textUnderlineOffset: 3 }}
                >
                  Ansehen →
                </Link>
              </>
            )}
          </>
        ) : (
          <>
            <strong>Noch {missing.length} Pflichtangabe(n) offen.</strong> Ihre
            öffentliche Seite weist bis dahin darauf hin, dass Impressum und
            Datenschutzerklärung nicht veröffentlicht sind — Ihr Anfrageformular
            nimmt aber weiterhin Anfragen entgegen. Es erhebt damit
            personenbezogene Daten, ohne dass die nach Art. 13 DSGVO
            geschuldeten Angaben abrufbar sind. Das Risiko einer Abmahnung
            liegt bei Ihnen, nicht bei Fotolio.
          </>
        )}
      </div>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {field('legalName', 'Anbieter / Name')}
          {field('legalStreet', 'Straße und Hausnummer')}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
          {field('legalPostalCode', 'PLZ')}
          {field('legalCity', 'Ort')}
          {field('legalCountry', 'Land')}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {field('legalEmail', 'E-Mail', { type: 'email' })}
          {field('legalPhone', 'Telefon', { type: 'tel' })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {field('legalVatId', 'USt-IdNr.', {
            hint: 'Nur falls umsatzsteuerpflichtig (§27a UStG). Kleinunternehmer nach §19 UStG lassen das Feld leer.',
          })}
          {field('legalRegister', 'Handelsregister', {
            hint: 'Nur bei Eintragung, z. B. „Amtsgericht Berlin, HRB 12345“.',
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {field('legalResponsible', 'Verantwortlich (§18 Abs. 2 MStV)', {
            hint: 'Leer lassen, wenn identisch mit dem Anbieter.',
          })}
          {field('privacyContactEmail', 'Datenschutz-Kontakt', {
            type: 'email',
            hint: 'Leer lassen, wenn identisch mit der E-Mail oben.',
          })}
        </div>

        {saveError && (
          <div role="alert" style={{ color: c.danger, fontSize: '0.88rem' }}>
            {saveError}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '10px 24px',
              background: c.primarySolid,
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
          {saved && (
            <span style={{ fontSize: '0.86rem', color: c.textMuted }}>Gespeichert ✓</span>
          )}
        </div>
      </form>
    </section>
  );
}
