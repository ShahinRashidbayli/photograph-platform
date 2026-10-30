'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useQueryClient } from '@tanstack/react-query';
import { useThemeStore } from '@/store/themeStore';
import { getColors } from '@/lib/design-tokens';
import { asyncError, asyncErrorText, type AsyncError } from '@/lib/async-error';
import { useTranslation } from '@/lib/i18n';
import { createPaymentIntent, paymentSummaryKey } from '@/hooks/useInvoices';
import type { Invoice } from '@/types/api';

type Colors = ReturnType<typeof getColors>;
type Method = 'CARD' | 'SEPA';

/**
 * Stripe.js instances are keyed by publishable key AND connected account:
 * charges here are DIRECT charges on the photographer's own account, so an
 * instance loaded for one photographer cannot resolve another's client
 * secret. Cached because `loadStripe` injects a script tag — calling it per
 * render would reload Stripe.js on every keystroke in the card field.
 */
const stripeCache = new Map<string, Promise<Stripe | null>>();

function getStripe(publishableKey: string, stripeAccount: string): Promise<Stripe | null> {
  const cacheKey = `${publishableKey}::${stripeAccount}`;
  let instance = stripeCache.get(cacheKey);
  if (!instance) {
    instance = loadStripe(publishableKey, { stripeAccount });
    stripeCache.set(cacheKey, instance);
  }
  return instance;
}

interface Props {
  invoice: Invoice;
  outstandingCents: number;
  onClose: () => void;
  /** Fired after Stripe reports the payment as succeeded or processing. */
  onPaid?: () => void;
}

interface IntentState {
  clientSecret: string;
  publishableKey: string;
  stripeAccountId: string;
  /** What the intent actually bills — authoritative over the caller's figure. */
  amountCents: number;
}

export function StripePaymentModal({ invoice, outstandingCents, onClose, onPaid }: Props) {
  const { t, format } = useTranslation();
  const { theme } = useThemeStore();
  const c = useMemo(() => getColors(theme), [theme]);

  const [method, setMethod] = useState<Method>('CARD');
  const [intent, setIntent] = useState<IntentState | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<AsyncError | null>(null);

  // Switching method mints a new intent and cancels the previous one server-
  // side. Without sequencing, a slow first response can land after a fast
  // second and mount Elements on the intent that was just cancelled — the
  // client then gets "this PaymentIntent has a status of canceled" on submit,
  // with nothing on screen explaining why.
  const requestSeq = useRef(0);

  const start = useCallback(
    async (chosen: Method) => {
      const seq = ++requestSeq.current;
      setStarting(true);
      setError(null);
      setIntent(null);
      try {
        const payment = await createPaymentIntent(invoice.id, chosen);
        if (seq !== requestSeq.current) return;
        // The three arrive together or not at all — a client secret without
        // the account it belongs to is unusable, so treat a partial response
        // as a failure rather than mounting an element that can never confirm.
        if (!payment.clientSecret || !payment.publishableKey || !payment.stripeAccountId) {
          setError({ key: 'invoices.payDialog.unavailable' });
          return;
        }
        setIntent({
          clientSecret: payment.clientSecret,
          publishableKey: payment.publishableKey,
          stripeAccountId: payment.stripeAccountId,
          amountCents: payment.amountCents,
        });
      } catch (err) {
        if (seq !== requestSeq.current) return;
        setError(asyncError(err, 'invoices.payDialog.startFailed'));
      } finally {
        if (seq === requestSeq.current) setStarting(false);
      }
    },
    [invoice.id]
  );

  useEffect(() => {
    void start(method);
  }, [start, method]);

  // Escape closes, and focus is trapped by the browser's own dialog semantics
  // via role="dialog" + aria-modal; a full focus trap would fight Stripe's
  // cross-origin iframe, which manages its own focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    globalThis.addEventListener('keydown', onKey);
    return () => globalThis.removeEventListener('keydown', onKey);
  }, [onClose]);

  const stripePromise = intent ? getStripe(intent.publishableKey, intent.stripeAccountId) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('invoices.number', { number: invoice.invoiceNumber })}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(6, 6, 10, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: c.surface,
          border: `1px solid ${c.border}`,
          borderRadius: '16px',
          width: '100%',
          maxWidth: 460,
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px',
          boxShadow: c.overlayShadow,
          color: c.text,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>
              {t('invoices.payDialog.title', {
                amount: format.eurExact(intent?.amountCents ?? outstandingCents),
              })}
            </h2>
            <p style={{ fontSize: '0.83rem', color: c.textMuted, margin: '4px 0 0' }}>
              {t('invoices.number', { number: invoice.invoiceNumber })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('invoices.payDialog.close')}
            style={{
              background: 'transparent',
              border: 'none',
              color: c.textMuted,
              fontSize: '1.3rem',
              lineHeight: 1,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{ display: 'flex', gap: 8, margin: '18px 0' }}
          role="group"
          aria-label={t('invoices.payDialog.methodGroup')}
        >
          <MethodTab
            label={t('invoices.payDialog.methodCard')}
            active={method === 'CARD'}
            onClick={() => setMethod('CARD')}
            colors={c}
          />
          <MethodTab
            label={t('invoices.payDialog.methodSepa')}
            active={method === 'SEPA'}
            onClick={() => setMethod('SEPA')}
            colors={c}
          />
        </div>

        {error && (
          <div
            role="alert"
            style={{
              background: c.dangerBg,
              border: `1px solid ${c.dangerBorder}`,
              color: c.dangerText,
              borderRadius: '10px',
              padding: '10px 12px',
              fontSize: '0.84rem',
              marginBottom: '14px',
            }}
          >
            {asyncErrorText(error, t)}
          </div>
        )}

        {starting && (
          <div style={{ fontSize: '0.88rem', color: c.textMuted, padding: '18px 0' }}>
            {t('invoices.payDialog.preparing')}
          </div>
        )}

        {intent && stripePromise && (
          <Elements
            // Remounts the whole element tree when the intent changes (a
            // different method, or a replaced intent after the balance moved).
            // Stripe's Elements cannot be re-pointed at a new client secret.
            key={intent.clientSecret}
            stripe={stripePromise}
            options={{
              clientSecret: intent.clientSecret,
              appearance: {
                theme: c.isDark ? 'night' : 'stripe',
                variables: { colorPrimary: c.primary },
              },
            }}
          >
            <PaymentForm
              colors={c}
              amountCents={intent.amountCents}
              invoiceId={invoice.id}
              onPaid={onPaid}
              onClose={onClose}
            />
          </Elements>
        )}

        <p style={{ fontSize: '0.76rem', color: c.textMuted, lineHeight: 1.5, margin: '16px 0 0' }}>
          {t('invoices.payDialog.security')}
        </p>
      </div>
    </div>
  );
}

function MethodTab({
  label,
  active,
  onClick,
  colors: c,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  colors: Colors;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        flex: 1,
        padding: '8px 12px',
        borderRadius: '10px',
        border: `1px solid ${active ? c.primaryBorder : c.border}`,
        background: active ? c.primaryBg : 'transparent',
        color: active ? c.primaryText : c.textMuted,
        fontSize: '0.84rem',
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function PaymentForm({
  colors: c,
  amountCents,
  invoiceId,
  onPaid,
  onClose,
}: {
  colors: Colors;
  amountCents: number;
  invoiceId: string;
  onPaid?: () => void;
  onClose: () => void;
}) {
  const { t, format } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<'succeeded' | 'processing' | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || submitting) return;
    setSubmitting(true);
    setFormError(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      // Most card payments settle inline. SCA/3DS ones genuinely leave the
      // page, so send them back to the page they started on rather than a
      // fixed route — DashboardPaymentReturn there reads Stripe's
      // `redirect_status` and tells them how it went.
      confirmParams: { return_url: globalThis.location.href },
      redirect: 'if_required',
    });

    if (error) {
      setFormError(error.message ?? t('invoices.payDialog.confirmFailed'));
      setSubmitting(false);
      return;
    }

    // The webhook — not this response — is what marks the payment SUCCEEDED
    // server-side, so refetch rather than assuming. SEPA legitimately sits in
    // `processing` for days, which is a success from the payer's side.
    const status = paymentIntent?.status;
    setDone(status === 'succeeded' ? 'succeeded' : 'processing');
    queryClient.invalidateQueries({ queryKey: paymentSummaryKey(invoiceId) });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
    onPaid?.();
    setSubmitting(false);
  };

  if (done) {
    return (
      <div
        style={{
          background: c.successBg,
          border: `1px solid ${c.successBorder}`,
          color: c.successText,
          borderRadius: '12px',
          padding: '16px',
          fontSize: '0.88rem',
          lineHeight: 1.5,
        }}
      >
        <strong style={{ display: 'block', marginBottom: 4 }}>
          {done === 'succeeded'
            ? t('invoices.payDialog.succeededTitle')
            : t('invoices.payDialog.pendingTitle')}
        </strong>
        {done === 'succeeded'
          ? t('invoices.payDialog.succeededBody')
          : t('invoices.payDialog.pendingBody')}
        <button
          type="button"
          onClick={onClose}
          style={{
            display: 'block',
            marginTop: 14,
            padding: '9px 18px',
            borderRadius: '10px',
            border: 'none',
            background: c.primarySolid,
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.86rem',
            cursor: 'pointer',
          }}
        >
          {t('invoices.payDialog.done')}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {formError && (
        <div role="alert" style={{ color: c.dangerText, fontSize: '0.83rem', marginTop: '12px' }}>
          {formError}
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || submitting}
        style={{
          width: '100%',
          marginTop: '18px',
          padding: '11px 20px',
          borderRadius: '10px',
          border: 'none',
          background: c.primarySolid,
          color: '#fff',
          fontSize: '0.92rem',
          fontWeight: 700,
          cursor: submitting ? 'wait' : 'pointer',
          opacity: submitting ? 0.7 : 1,
        }}
      >
        {submitting
          ? t('invoices.payDialog.processing')
          : t('invoices.pay', { amount: format.eurExact(amountCents) })}
      </button>
    </form>
  );
}
