'use client';

import { useState, FormEvent } from 'react';

interface Props {
  subdomain: string;
}

const EVENT_TYPES = [
  { value: 'WEDDING', label: 'Wedding' },
  { value: 'ENGAGEMENT', label: 'Engagement' },
  { value: 'PORTRAIT', label: 'Portrait' },
  { value: 'FAMILY', label: 'Family' },
  { value: 'CORPORATE', label: 'Corporate' },
  { value: 'OTHER', label: 'Other' },
];

const BUDGET_RANGES = [
  { value: 'UNDER_200', label: 'Under €200' },
  { value: '200_500', label: '€200 – €500' },
  { value: '500_1000', label: '€500 – €1000' },
  { value: 'OVER_1000', label: 'Over €1000' },
];

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'ok' }
  | { kind: 'error'; message: string };

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #CBD5E1',
  fontSize: 14,
  background: '#FFFFFF',
  color: '#0F172A',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: '#334155',
  marginBottom: 6,
};

export default function RequestForm({ subdomain }: Props) {
  const [state, setState] = useState<SubmitState>({ kind: 'idle' });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    // Honeypot — bots that auto-fill every input will populate this and the
    // backend will silently 202 the request without persisting anything.
    const honeypot = String(data.get('website') ?? '');

    const payload = {
      name: String(data.get('name') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      phone: String(data.get('phone') ?? '').trim() || null,
      eventDate: String(data.get('eventDate') ?? ''),
      eventType: String(data.get('eventType') ?? ''),
      budgetRange: String(data.get('budgetRange') ?? ''),
      message: String(data.get('message') ?? '').trim() || null,
      website: honeypot,
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
          message: 'Too many requests — please try again in a few minutes.',
        });
        return;
      }
      if (res.status === 404) {
        setState({ kind: 'error', message: 'This photographer was not found.' });
        return;
      }
      if (!res.ok && res.status !== 202) {
        const body = await res.json().catch(() => ({}) as Record<string, unknown>);
        const message = typeof body?.error === 'string' ? body.error : 'Failed to send request.';
        setState({ kind: 'error', message });
        return;
      }

      setState({ kind: 'ok' });
      form.reset();
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error.',
      });
    }
  }

  if (state.kind === 'ok') {
    return (
      <div
        style={{
          background: '#ECFDF5',
          border: '1px solid #A7F3D0',
          borderRadius: 12,
          padding: 24,
          color: '#065F46',
        }}
      >
        <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Thank you!</h2>
        <p style={{ margin: 0 }}>
          Your request was sent. You will receive a confirmation email shortly.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 12,
        padding: 24,
        display: 'grid',
        gap: 16,
      }}
    >
      {/* Honeypot field — visually hidden, ignored by humans, filled by bots. */}
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
          Leave this field empty
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div>
        <label style={labelStyle} htmlFor="name">
          Your name *
        </label>
        <input id="name" name="name" type="text" required style={inputStyle} />
      </div>

      <div>
        <label style={labelStyle} htmlFor="email">
          Email *
        </label>
        <input id="email" name="email" type="email" required style={inputStyle} />
      </div>

      <div>
        <label style={labelStyle} htmlFor="phone">
          Phone (optional)
        </label>
        <input id="phone" name="phone" type="tel" style={inputStyle} />
      </div>

      <div>
        <label style={labelStyle} htmlFor="eventDate">
          Event date *
        </label>
        <input id="eventDate" name="eventDate" type="date" required style={inputStyle} />
      </div>

      <div>
        <label style={labelStyle} htmlFor="eventType">
          Session type *
        </label>
        <select id="eventType" name="eventType" required defaultValue="" style={inputStyle}>
          <option value="" disabled>
            Select…
          </option>
          {EVENT_TYPES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle} htmlFor="budgetRange">
          Budget *
        </label>
        <select id="budgetRange" name="budgetRange" required defaultValue="" style={inputStyle}>
          <option value="" disabled>
            Select…
          </option>
          {BUDGET_RANGES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle} htmlFor="message">
          Tell us about your shoot
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      {state.kind === 'error' && (
        <div
          role="alert"
          style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#991B1B',
            padding: '10px 12px',
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
          padding: '12px 16px',
          borderRadius: 8,
          background: state.kind === 'submitting' ? '#94A3B8' : '#0F172A',
          color: '#FFFFFF',
          border: 'none',
          fontWeight: 600,
          cursor: state.kind === 'submitting' ? 'wait' : 'pointer',
          fontSize: 14,
        }}
      >
        {state.kind === 'submitting' ? 'Sending…' : 'Send request'}
      </button>
    </form>
  );
}
