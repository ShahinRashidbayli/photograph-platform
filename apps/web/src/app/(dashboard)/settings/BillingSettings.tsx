'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { billingProfileKey } from '@/hooks/useInvoices';
import { asyncError, asyncErrorText, type AsyncError } from '@/lib/async-error';
import { useTranslation } from '@/lib/i18n';
import { Alert, Button, Card, Field, Input, Select, useColors } from '@/components/ui';
import type { BillingProfile, StripeConnectStatus, TaxMode } from '@/types/api';

const EMPTY_FORM = {
  businessName: '',
  addressLine1: '',
  addressLine2: '',
  postalCode: '',
  city: '',
  country: 'DE',
  taxId: '',
  vatId: '',
  taxMode: 'KLEINUNTERNEHMER' as TaxMode,
};

function SectionHeading({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  const c = useColors();
  return (
    <>
      <h2 id={id} style={{ fontSize: '1rem', fontWeight: 700, color: c.text, margin: '0 0 4px' }}>
        {title}
      </h2>
      <p style={{ fontSize: '0.88rem', color: c.textMuted, margin: '0 0 18px', lineHeight: 1.5 }}>
        {children}
      </p>
    </>
  );
}

/**
 * The legal identity printed on every invoice this photographer issues.
 *
 * <p>Not cosmetic settings: §14 UStG makes each of these fields mandatory on a
 * German invoice, and an invoice is GoBD-immutable the moment it exists — a
 * wrong Steuernummer here cannot be corrected on a document later, only
 * cancelled with a Storno and re-issued. That is why the backend refuses to
 * issue anything until this is complete, and why the banner below says so
 * rather than letting the photographer discover it when they try to bill a
 * client.
 */
export function BillingProfileSection() {
  const { t } = useTranslation();
  const c = useColors();
  const [form, setForm] = useState(EMPTY_FORM);
  const [complete, setComplete] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<AsyncError | null>(null);
  // Distinct from `error`, which also carries save failures. A load that never
  // succeeded must hide the form entirely: its defaults are not the tenant's
  // values, and submitting them would rewrite taxMode to KLEINUNTERNEHMER and
  // blank the VAT id — silently changing whether every future invoice charges
  // VAT.
  const [loadFailed, setLoadFailed] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    api
      .get<BillingProfile>('/api/settings/billing-profile')
      .then(({ data }) => {
        if (cancelled) return;
        setForm({
          businessName: data.businessName ?? '',
          addressLine1: data.addressLine1 ?? '',
          addressLine2: data.addressLine2 ?? '',
          postalCode: data.postalCode ?? '',
          city: data.city ?? '',
          country: data.country ?? 'DE',
          taxId: data.taxId ?? '',
          vatId: data.vatId ?? '',
          taxMode: data.taxMode,
        });
        setComplete(data.complete);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadFailed(true);
        setError(asyncError(err, 'settings.billing.loadError'));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // No `t`: the failure is stored as a key and translated at render, so a
    // language change must not re-run this and overwrite what the photographer
    // has typed into the form since it loaded.
  }, []);

  const set = (patch: Partial<typeof EMPTY_FORM>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.put<BillingProfile>('/api/settings/billing-profile', {
        ...form,
        addressLine2: form.addressLine2 || null,
        taxId: form.taxId || null,
        vatId: form.vatId || null,
      });
      setComplete(data.complete);
      setSaved(true);
      // The invoice form reads this same profile through React Query. The PUT
      // already returned the saved version, so hand it straight to the cache
      // rather than making the next reader refetch — otherwise a photographer
      // who switches to Regelbesteuerung here and immediately issues an
      // invoice gets one billed under the old tax mode, on a document that is
      // immutable the moment it exists.
      queryClient.setQueryData(billingProfileKey(), data);
    } catch (err) {
      setError(asyncError(err, 'settings.billing.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ marginBottom: 20 }}>
      <form onSubmit={save} aria-labelledby="settings-invoicing">
        <SectionHeading id="settings-invoicing" title={t('settings.billing.title')}>
          {t('settings.billing.subtitle')}
        </SectionHeading>

        {complete === false && !loading && !loadFailed && (
          <Alert tone="warning" style={{ marginBottom: 16 }}>
            {t('settings.billing.incomplete')}
          </Alert>
        )}

        {loading ? (
          <p style={{ fontSize: '0.88rem', color: c.textMuted }}>{t('settings.billing.loading')}</p>
        ) : loadFailed ? (
          <p style={{ fontSize: '0.88rem', color: c.textMuted, lineHeight: 1.5 }}>
            {t('settings.billing.loadFailed')}
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            <Field label={t('settings.billing.businessName')}>
              {(props) => (
                <Input
                  {...props}
                  value={form.businessName}
                  onChange={(e) => set({ businessName: e.target.value })}
                  placeholder="Anna Müller Fotografie"
                  required
                />
              )}
            </Field>

            <Field label={t('settings.billing.street')}>
              {(props) => (
                <Input
                  {...props}
                  value={form.addressLine1}
                  onChange={(e) => set({ addressLine1: e.target.value })}
                  placeholder="Musterstraße 1"
                  required
                />
              )}
            </Field>

            <Field label={t('settings.billing.addressLine2')}>
              {(props) => (
                <Input
                  {...props}
                  value={form.addressLine2}
                  onChange={(e) => set({ addressLine2: e.target.value })}
                  placeholder="Hinterhaus, 2. OG"
                />
              )}
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 10 }}>
              <Field label={t('settings.billing.postalCode')}>
                {(props) => (
                  <Input
                    {...props}
                    value={form.postalCode}
                    onChange={(e) => set({ postalCode: e.target.value })}
                    placeholder="10115"
                    required
                  />
                )}
              </Field>
              <Field label={t('settings.billing.city')}>
                {(props) => (
                  <Input
                    {...props}
                    value={form.city}
                    onChange={(e) => set({ city: e.target.value })}
                    placeholder="Berlin"
                    required
                  />
                )}
              </Field>
              <Field label={t('settings.billing.country')}>
                {(props) => (
                  <Input
                    {...props}
                    value={form.country}
                    onChange={(e) => set({ country: e.target.value.toUpperCase().slice(0, 2) })}
                    maxLength={2}
                    placeholder="DE"
                    required
                  />
                )}
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label={t('settings.billing.taxId')} hint={t('settings.billing.taxIdHint')}>
                {(props) => (
                  <Input
                    {...props}
                    value={form.taxId}
                    onChange={(e) => set({ taxId: e.target.value })}
                    placeholder="21/815/08150"
                  />
                )}
              </Field>
              <Field label={t('settings.billing.vatId')}>
                {(props) => (
                  <Input
                    {...props}
                    value={form.vatId}
                    onChange={(e) => set({ vatId: e.target.value })}
                    placeholder="DE123456789"
                  />
                )}
              </Field>
            </div>

            <Field label={t('settings.billing.taxMode')} hint={t('settings.billing.taxModeHint')}>
              {(props) => (
                <Select
                  {...props}
                  value={form.taxMode}
                  onChange={(e) => set({ taxMode: e.target.value as TaxMode })}
                >
                  <option value="KLEINUNTERNEHMER">
                    {t('settings.billing.taxModeKleinunternehmer')}
                  </option>
                  <option value="REGELBESTEUERUNG">
                    {t('settings.billing.taxModeRegelbesteuerung')}
                  </option>
                </Select>
              )}
            </Field>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginTop: 20,
            flexWrap: 'wrap',
          }}
        >
          <Button
            type="submit"
            variant="primary"
            busy={saving}
            busyLabel={t('settings.billing.saving')}
            disabled={loading || loadFailed}
          >
            {saved ? t('settings.billing.saved') : t('settings.billing.save')}
          </Button>
          {error && <Alert tone="danger">{asyncErrorText(error, t)}</Alert>}
        </div>
      </form>
    </Card>
  );
}

/**
 * The photographer's own Stripe account, connected through Stripe's hosted
 * Express onboarding.
 *
 * <p>Money from a client's card goes straight into this account — the platform
 * never holds it — and takes its commission off the same charge. So this is not
 * an integration toggle: until it says "ready", the client's Pay button has
 * nowhere to send money and falls back to bank transfer.
 */
export function StripeConnectSection() {
  const { t } = useTranslation();
  const c = useColors();
  const router = useRouter();
  const searchParams = useSearchParams();
  const stripeParam = searchParams.get('stripe');

  const [status, setStatus] = useState<StripeConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AsyncError | null>(null);

  const load = useCallback(async (refresh: boolean) => {
    setError(null);
    try {
      // Coming back from hosted onboarding, ask Stripe rather than trusting our
      // mirror: the account.updated webhook is authoritative but can land after
      // the redirect, and a screen still saying "not connected" one second
      // after a successful onboarding reads as a failure.
      const { data } = refresh
        ? await api.post<StripeConnectStatus>('/api/settings/stripe/refresh')
        : await api.get<StripeConnectStatus>('/api/settings/stripe');
      setStatus(data);
    } catch (err) {
      setError(asyncError(err, 'settings.stripe.statusError'));
    } finally {
      setLoading(false);
    }
  }, []);

  const startOnboarding = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post<{ url: string }>('/api/settings/stripe/onboarding-link');
      globalThis.location.href = data.url;
    } catch (err) {
      setError(asyncError(err, 'settings.stripe.onboardingError'));
      setBusy(false);
    }
  }, []);

  // Stripe's redirect back is handled exactly once. Stripping the query
  // parameter re-runs this effect with `stripeParam === null`, and the naive
  // version then fired a plain GET alongside the refresh POST still in flight —
  // last writer wins, so the stale pre-onboarding status could overwrite the
  // fresh one the refresh existed to fetch.
  const handledRedirect = useRef(false);

  useEffect(() => {
    if (handledRedirect.current) return;

    if (stripeParam === 'refresh') {
      // Stripe expired the link before it was used; the only useful answer is
      // another one, immediately.
      handledRedirect.current = true;
      router.replace('/settings');
      void startOnboarding();
      return;
    }

    if (stripeParam === 'return') {
      handledRedirect.current = true;
      router.replace('/settings');
      void load(true);
      return;
    }

    void load(false);
  }, [stripeParam, load, router, startOnboarding]);

  const percent = (bps: number) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;

  const state = (() => {
    if (!status) return { tone: c.neutral, label: t('settings.stripe.loading'), detail: '' };
    if (!status.platformConfigured) {
      return {
        tone: c.neutral,
        label: t('settings.stripe.unavailable'),
        detail: t('settings.stripe.unavailableDetail'),
      };
    }
    if (status.chargesEnabled) {
      return {
        tone: c.success,
        label: t('settings.stripe.ready'),
        detail: status.payoutsEnabled
          ? t('settings.stripe.readyDetail')
          : t('settings.stripe.readyNoPayouts'),
      };
    }
    if (status.accountId) {
      return {
        tone: c.warning,
        label: status.detailsSubmitted
          ? t('settings.stripe.inReview')
          : t('settings.stripe.incomplete'),
        detail: status.detailsSubmitted
          ? t('settings.stripe.inReviewDetail')
          : t('settings.stripe.incompleteDetail'),
      };
    }
    return {
      tone: c.neutral,
      label: t('settings.stripe.notConnected'),
      detail: t('settings.stripe.notConnectedDetail'),
    };
  })();

  return (
    <Card style={{ marginBottom: 20 }}>
      <section aria-labelledby="settings-payouts">
        <SectionHeading id="settings-payouts" title={t('settings.stripe.title')}>
          {t('settings.stripe.subtitle')}
        </SectionHeading>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span
            aria-hidden
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: state.tone,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: '0.92rem', fontWeight: 700, color: c.text }}>{state.label}</span>
        </div>
        <p style={{ fontSize: '0.86rem', color: c.textMuted, margin: '0 0 16px', lineHeight: 1.5 }}>
          {state.detail}
        </p>

        {status?.platformConfigured && (
          <p
            style={{ fontSize: '0.84rem', color: c.textMuted, margin: '0 0 18px', lineHeight: 1.5 }}
          >
            {status.commissionBps > 0
              ? t('settings.stripe.commission', {
                  plan: status.plan,
                  percent: percent(status.commissionBps),
                })
              : t('settings.stripe.noCommission', { plan: status.plan })}
          </p>
        )}

        {error && (
          <Alert tone="danger" style={{ marginBottom: 14 }}>
            {asyncErrorText(error, t)}
          </Alert>
        )}

        {status?.platformConfigured && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Button
              variant={status.chargesEnabled ? 'secondary' : 'primary'}
              onClick={startOnboarding}
              busy={busy}
              busyLabel={t('settings.stripe.opening')}
              disabled={loading}
            >
              {status.chargesEnabled
                ? t('settings.stripe.manage')
                : status.accountId
                  ? t('settings.stripe.finishSetup')
                  : t('settings.stripe.connect')}
            </Button>
            {status.accountId && (
              <Button variant="ghost" onClick={() => load(true)} disabled={busy}>
                {t('settings.stripe.refresh')}
              </Button>
            )}
          </div>
        )}
      </section>
    </Card>
  );
}

/**
 * DATEV Buchungsstapel export — the "your Steuerberater gets the export in one
 * click" promise the product is sold on.
 *
 * <p>The exporter has been complete on the backend for a while
 * ({@code GET /api/invoices/export.datev.csv}: EXTF format 21, version 700,
 * windows-1252, CRLF) with nothing in the UI reaching it — and the storno
 * confirmation dialog already told photographers their cancelled invoices
 * "stay in the DATEV export", describing a file they had no way to obtain.
 *
 * <p>A plain link, not a fetch: the endpoint streams the file and sets its own
 * Content-Disposition filename, and the session cookie rides along on a
 * same-origin navigation. Buffering it through JS would only lose the filename.
 */
export function DatevExportSection() {
  const c = useColors();
  const { t } = useTranslation();

  // Bookkeeping is done per fiscal year, and the year you export is almost
  // always the current one or the one just closed.
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];
  const [year, setYear] = useState(String(currentYear));

  return (
    <Card style={{ marginBottom: 20 }}>
      <section aria-labelledby="settings-datev">
        <SectionHeading id="settings-datev" title={t('settings.datev.title')}>
          {t('settings.datev.description')}
        </SectionHeading>

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 140 }}>
            <Field label={t('settings.datev.year')}>
              {(props) => (
                <Select {...props} value={year} onChange={(e) => setYear(e.target.value)}>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <a
            href={`/api/invoices/export.datev.csv?year=${year}`}
            download
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 16px',
              borderRadius: 8,
              border: `1px solid ${c.border}`,
              background: c.surfaceAlt,
              color: c.text,
              fontSize: '0.88rem',
              fontWeight: 600,
              textDecoration: 'none',
              marginBottom: 2,
            }}
          >
            {t('settings.datev.download')}
          </a>
        </div>

        {/*
          Not a disclaimer for its own sake. DatevInvoiceExporter posts against
          SKR03 placeholder accounts (debtor 10000, revenue 8400 / 8337) and
          says in its own javadoc that a real deployment needs its Steuerberater
          to confirm or replace them. Shipping a one-click export without
          saying so would hand someone a file they'd file as correct.
        */}
        <Alert tone="warning" style={{ marginTop: 16 }}>
          {t('settings.datev.accountsNotice')}
        </Alert>
      </section>
    </Card>
  );
}
