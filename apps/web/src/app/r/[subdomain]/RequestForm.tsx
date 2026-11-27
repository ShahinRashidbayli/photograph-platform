'use client';

import { useState, FormEvent } from 'react';
import { useTranslation, type TranslationKey } from '@/lib/i18n';

interface Props {
  subdomain: string;
  /** Visual variant. 'light' (default) is a white card; 'dark' is transparent
      and inherits the surrounding page colors via CSS variables. */
  variant?: 'light' | 'dark';
}

/** The lead vocabulary's labels, so the photographer's inbox and this form say the same thing. */
const EVENT_TYPES: { value: string; labelKey: TranslationKey }[] = [
  { value: 'WEDDING', labelKey: 'leadEvent.WEDDING' },
  { value: 'ENGAGEMENT', labelKey: 'leadEvent.ENGAGEMENT' },
  { value: 'PORTRAIT', labelKey: 'leadEvent.PORTRAIT' },
  { value: 'FAMILY', labelKey: 'leadEvent.FAMILY' },
  { value: 'CORPORATE', labelKey: 'leadEvent.CORPORATE' },
  { value: 'OTHER', labelKey: 'leadEvent.OTHER' },
];

/** Bounds in cents; amounts go through the locale formatter ("€200" / "200 €"). */
const BUDGET_RANGES: { value: string; from?: number; to?: number }[] = [
  { value: 'UNDER_200', to: 20_000 },
  { value: '200_500', from: 20_000, to: 50_000 },
  { value: '500_1000', from: 50_000, to: 100_000 },
  { value: 'OVER_1000', from: 100_000 },
];

type SubmitState =
  { kind: 'idle' } | { kind: 'submitting' } | { kind: 'ok' } | { kind: 'error'; message: string };

export default function RequestForm({ subdomain, variant = 'light' }: Props) {
  const { t, format, lang } = useTranslation();
  const [state, setState] = useState<SubmitState>({ kind: 'idle' });

  const budgetLabel = (b: (typeof BUDGET_RANGES)[number]) =>
    b.from === undefined
      ? t('request.budget.under', { amount: format.eur(b.to) })
      : b.to === undefined
        ? t('request.budget.over', { amount: format.eur(b.from) })
        : t('request.budget.range', { from: format.eur(b.from), to: format.eur(b.to) });
  const isDark = variant === 'dark';

  const palette = isDark
    ? {
        cardBg: 'transparent',
        cardBorder: 'transparent',
        cardPad: 0,
        inputBg: 'transparent',
        inputBorder: '#3F3F46',
        inputBorderFocus: '#FAFAFA',
        inputText: '#FAFAFA',
        inputPlaceholder: '#71717A',
        labelText: '#A1A1AA',
        btnBg: '#FAFAFA',
        btnText: '#0A0A0A',
        btnDisabled: '#3F3F46',
        successBg: 'rgba(34, 197, 94, 0.1)',
        successBorder: 'rgba(34, 197, 94, 0.3)',
        successText: '#86EFAC',
        errorBg: 'rgba(239, 68, 68, 0.1)',
        errorBorder: 'rgba(239, 68, 68, 0.3)',
        errorText: '#FCA5A5',
      }
    : {
        cardBg: '#FFFFFF',
        cardBorder: '#E2E8F0',
        cardPad: 24,
        inputBg: '#FFFFFF',
        inputBorder: '#CBD5E1',
        inputBorderFocus: '#0F172A',
        inputText: '#0F172A',
        inputPlaceholder: '#94A3B8',
        labelText: '#334155',
        btnBg: '#0F172A',
        btnText: '#FFFFFF',
        btnDisabled: '#94A3B8',
        successBg: '#ECFDF5',
        successBorder: '#A7F3D0',
        successText: '#065F46',
        errorBg: '#FEF2F2',
        errorBorder: '#FECACA',
        errorText: '#991B1B',
      };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 8,
    border: `1px solid ${palette.inputBorder}`,
    fontSize: 14,
    background: palette.inputBg,
    color: palette.inputText,
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border-color 0.15s ease',
    fontFamily: 'inherit',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: palette.labelText,
    marginBottom: 8,
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    // Read off the form's own controls rather than `new FormData(form)`: the
    // same values, and it runs under the jsdom tests, whose FormData is Node's
    // (for MSW) and cannot read a form element.
    const field = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? '';

    const honeypot = field('website');

    const payload = {
      name: field('name').trim(),
      email: field('email').trim(),
      phone: field('phone').trim() || null,
      eventDate: field('eventDate'),
      eventType: field('eventType'),
      budgetRange: field('budgetRange'),
      message: field('message').trim() || null,
      website: honeypot,
      // The Customer messages that follow are written in the language they read the form in.
      language: lang,
    };

    setState({ kind: 'submitting' });
    try {
      const res = await fetch(`/api/public/leads/${encodeURIComponent(subdomain)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 429) {
        setState({
          kind: 'error',
          message: t('request.error.rateLimited'),
        });
        return;
      }
      if (res.status === 404) {
        setState({ kind: 'error', message: t('request.error.notFound') });
        return;
      }
      if (!res.ok && res.status !== 202) {
        // The API's own message is English and written for developers.
        setState({ kind: 'error', message: t('request.error.failed') });
        return;
      }

      setState({ kind: 'ok' });
      form.reset();
    } catch {
      setState({ kind: 'error', message: t('request.error.network') });
    }
  }

  if (state.kind === 'ok') {
    return (
      <div
        style={{
          background: palette.successBg,
          border: `1px solid ${palette.successBorder}`,
          borderRadius: 12,
          padding: 32,
          color: palette.successText,
        }}
      >
        <div style={{ fontSize: 22, marginBottom: 8 }}>✓</div>
        <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}>{t('request.okTitle')}</h3>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{t('request.okText')}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        background: palette.cardBg,
        border: isDark ? 'none' : `1px solid ${palette.cardBorder}`,
        borderRadius: 12,
        padding: palette.cardPad,
        display: 'grid',
        gap: 16,
      }}
    >
      <style>{`
        .lead-form-input:focus { border-color: ${palette.inputBorderFocus} !important; }
        .lead-form-input::placeholder { color: ${palette.inputPlaceholder}; }
        .lead-form-input option { background: ${isDark ? '#0A0A0A' : '#FFFFFF'}; color: ${palette.inputText}; }
      `}</style>

      {/* Honeypot — visually hidden, ignored by humans, filled by bots. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '-10000px',
          top: 'auto',
          width: 1,
          height: 1,
          overflow: 'hidden',
        }}
      >
        <label>
          {t('request.honeypot')}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
        }}
      >
        <div>
          <label style={labelStyle} htmlFor="name">
            {t('request.name')} *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="lead-form-input"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle} htmlFor="email">
            {t('request.email')} *
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="lead-form-input"
            style={inputStyle}
          />
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
        }}
      >
        <div>
          <label style={labelStyle} htmlFor="phone">
            {t('request.phone')}
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            className="lead-form-input"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle} htmlFor="eventDate">
            {t('request.date')} *
          </label>
          <input
            id="eventDate"
            name="eventDate"
            type="date"
            required
            className="lead-form-input"
            style={inputStyle}
          />
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
        }}
      >
        <div>
          <label style={labelStyle} htmlFor="eventType">
            {t('request.type')} *
          </label>
          <select
            id="eventType"
            name="eventType"
            required
            defaultValue=""
            className="lead-form-input"
            style={inputStyle}
          >
            <option value="" disabled>
              {t('request.select')}
            </option>
            {EVENT_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle} htmlFor="budgetRange">
            {t('request.budget')} *
          </label>
          <select
            id="budgetRange"
            name="budgetRange"
            required
            defaultValue=""
            className="lead-form-input"
            style={inputStyle}
          >
            <option value="" disabled>
              {t('request.select')}
            </option>
            {BUDGET_RANGES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {budgetLabel(opt)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label style={labelStyle} htmlFor="message">
          {t('request.message')}
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          className="lead-form-input"
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      {state.kind === 'error' && (
        <div
          role="alert"
          style={{
            background: palette.errorBg,
            border: `1px solid ${palette.errorBorder}`,
            color: palette.errorText,
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          {state.message}
        </div>
      )}

      <button
        type="submit"
        disabled={state.kind === 'submitting'}
        style={{
          padding: '14px 20px',
          borderRadius: 8,
          background: state.kind === 'submitting' ? palette.btnDisabled : palette.btnBg,
          color: palette.btnText,
          border: 'none',
          fontWeight: 600,
          letterSpacing: '0.01em',
          cursor: state.kind === 'submitting' ? 'wait' : 'pointer',
          fontSize: 14,
          transition: 'opacity 0.15s ease',
          fontFamily: 'inherit',
        }}
        onMouseEnter={(e) => {
          if (state.kind !== 'submitting') e.currentTarget.style.opacity = '0.85';
        }}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
      >
        {state.kind === 'submitting' ? t('request.sending') : `${t('request.send')} →`}
      </button>
    </form>
  );
}
