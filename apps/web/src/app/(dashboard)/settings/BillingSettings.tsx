'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useBillingProfile, useSaveBillingProfile } from '@/hooks/useInvoices';
import {
  useBillingStatus,
  useDevSetPlan,
  useOpenBillingPortal,
  useRefreshStripeConnect,
  useStartCheckout,
  useStripeConnectStatus,
  useStripeOnboardingLink,
  type BillingStatus,
} from '@/hooks/useBilling';
import { asyncError, asyncErrorText, type AsyncError } from '@/lib/async-error';
import { useTranslation } from '@/lib/i18n';
import { PlanActionButton, PlanComparison } from './PlanComparison';
import { Alert, Button, Card, Field, Input, Select, useColors } from '@/components/ui';
import type { BillingProfile, TaxMode } from '@/types/api';

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

function toForm(data: BillingProfile): typeof EMPTY_FORM {
  return {
    businessName: data.businessName ?? '',
    addressLine1: data.addressLine1 ?? '',
    addressLine2: data.addressLine2 ?? '',
    postalCode: data.postalCode ?? '',
    city: data.city ?? '',
    country: data.country ?? 'DE',
    taxId: data.taxId ?? '',
    vatId: data.vatId ?? '',
    taxMode: data.taxMode,
  };
}

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
  // The same cache the invoice form reads — see useSaveBillingProfile.
  const profileQuery = useBillingProfile();
  const saveProfile = useSaveBillingProfile();
  const loading = profileQuery.isLoading;
  const saving = saveProfile.isPending;
  // A load that never succeeded keeps Save disabled: the form's defaults are
  // not the tenant's values, and submitting them would rewrite taxMode to
  // KLEINUNTERNEHMER and blank the VAT id — silently changing whether every
  // future invoice charges VAT.
  const loadFailed = profileQuery.isError && !profileQuery.data;
  const complete = profileQuery.data?.complete ?? null;
  // What the photographer has typed, over the saved profile, so nothing —
  // a refetch, a language change — can overwrite an edit in progress.
  const [draft, setDraft] = useState<typeof EMPTY_FORM | null>(null);
  const form = draft ?? (profileQuery.data ? toForm(profileQuery.data) : EMPTY_FORM);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<AsyncError | null>(null);
  const error =
    saveError ?? (loadFailed ? asyncError(profileQuery.error, 'settings.billing.loadError') : null);

  const set = (patch: Partial<typeof EMPTY_FORM>) => {
    setDraft({ ...form, ...patch });
    setSaved(false);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    saveProfile.mutate(
      {
        ...form,
        addressLine2: form.addressLine2 || null,
        taxId: form.taxId || null,
        vatId: form.vatId || null,
      },
      {
        onSuccess: () => {
          setDraft(null);
          setSaved(true);
        },
        onError: (err) => setSaveError(asyncError(err, 'settings.billing.saveError')),
      }
    );
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

  // Coming back from onboarding, the status comes from Stripe and never from
  // our mirror, which may not have heard the webhook yet. A plain read in the
  // same visit — alongside the refresh, or after it — is the race this section
  // once lost: the stale pre-onboarding mirror overwrote the fresh status. The
  // mirror is read only if asking Stripe failed.
  const [returnFlow, setReturnFlow] = useState(stripeParam === 'return');
  const statusQuery = useStripeConnectStatus(!returnFlow);
  const refresh = useRefreshStripeConnect();
  const onboarding = useStripeOnboardingLink();
  const { mutate: mutateRefresh } = refresh;
  const { mutate: mutateOnboarding } = onboarding;
  const status = statusQuery.data ?? null;
  const loading = returnFlow ? refresh.isIdle || refresh.isPending : statusQuery.isLoading;
  // Held through success: the browser is on its way to Stripe.
  const busy = onboarding.isPending || onboarding.isSuccess;
  const [actionError, setActionError] = useState<AsyncError | null>(null);
  const error =
    actionError ??
    (statusQuery.isError ? asyncError(statusQuery.error, 'settings.stripe.statusError') : null);

  function load(fromStripe: boolean) {
    setActionError(null);
    if (!fromStripe) {
      void statusQuery.refetch();
      return;
    }
    mutateRefresh(undefined, {
      onError: (err) => {
        setActionError(asyncError(err, 'settings.stripe.statusError'));
        setReturnFlow(false);
      },
    });
  }

  function startOnboarding() {
    setActionError(null);
    mutateOnboarding(undefined, {
      onSuccess: (url) => {
        globalThis.location.href = url;
      },
      onError: (err) => setActionError(asyncError(err, 'settings.stripe.onboardingError')),
    });
  }

  // Stripe's redirect back is handled exactly once; stripping the parameter
  // re-renders with `stripeParam === null`.
  const handledRedirect = useRef(false);

  useEffect(() => {
    if (handledRedirect.current || !stripeParam) return;
    handledRedirect.current = true;
    router.replace('/settings/payments');

    if (stripeParam === 'refresh') {
      // Stripe expired the link before it was used; the only useful answer is
      // another one, immediately.
      setActionError(null);
      mutateOnboarding(undefined, {
        onSuccess: (url) => {
          globalThis.location.href = url;
        },
        onError: (err) => setActionError(asyncError(err, 'settings.stripe.onboardingError')),
      });
    } else if (stripeParam === 'return') {
      mutateRefresh(undefined, {
        onError: (err) => {
          setActionError(asyncError(err, 'settings.stripe.statusError'));
          setReturnFlow(false);
        },
      });
    }
  }, [stripeParam, router, mutateRefresh, mutateOnboarding]);

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

// ── Subscription (what the photographer pays US) ────────────────────────────

/**
 * The subscription the photographer holds with Fotolio.
 *
 * <p>Distinct from {@link StripeConnectSection} above, which is about the
 * photographer being paid by *their* clients. These two are the easiest pair
 * in the product to confuse, which is why they carry different headings and
 * never share a status line: "payouts ready" and "subscription active" answer
 * completely different questions, and reading one as the other means either
 * believing you can take money when you cannot, or believing you are paying
 * when you are not.
 *
 * <p>Everything here has to work while the account is read-only — that is the
 * state this screen exists to get someone out of.
 */
export function SubscriptionSection() {
  const { t, format } = useTranslation();
  const c = useColors();
  const router = useRouter();
  const searchParams = useSearchParams();
  const billingParam = searchParams.get('billing');

  // Captured at mount, before the redirect parameter is stripped below. The
  // re-read after a successful checkout used to key on the live parameter,
  // which was already gone by the time the first answer came back — so it
  // never re-read, and "your plan is still Starter" read as a failed payment.
  const [returnedFromCheckout] = useState(billingParam === 'success');
  const statusQuery = useBillingStatus({ pollAfterCheckout: returnedFromCheckout });
  const checkout = useStartCheckout();
  const portal = useOpenBillingPortal();
  const devPlan = useDevSetPlan();
  const status = statusQuery.data ?? null;
  const loading = statusQuery.isLoading;
  // Monthly is the low-commitment default for the screen that takes money; a
  // period carried from the landing page's plan card (`?period=yearly`) wins,
  // so the visitor does not meet a different choice from the one they made.
  const [yearly, setYearly] = useState(searchParams.get('period') === 'yearly');
  // Held through success: each of these ends in a page navigation.
  const busy = [checkout, portal, devPlan].some((m) => m.isPending || m.isSuccess);
  const [actionError, setActionError] = useState<AsyncError | null>(null);
  const error =
    actionError ??
    (statusQuery.isError ? asyncError(statusQuery.error, 'settings.subscription.loadError') : null);

  const handledRedirect = useRef(false);

  useEffect(() => {
    if (handledRedirect.current || !billingParam) return;
    // Returning from Stripe. Strip the parameter so a refresh does not
    // re-trigger this; the query above has already started reading.
    handledRedirect.current = true;
    router.replace('/settings/plan');
  }, [billingParam, router]);

  function subscribe(plan: BillingStatus['plan']) {
    setActionError(null);
    checkout.mutate(
      { plan, interval: yearly ? 'YEARLY' : 'MONTHLY' },
      {
        onSuccess: (url) => {
          globalThis.location.href = url;
        },
        onError: (err) => setActionError(asyncError(err, 'settings.subscription.checkoutError')),
      }
    );
  }

  /** The development-only switch — see useDevSetPlan for why it reloads. */
  function devSetPlan(plan: BillingStatus['plan']) {
    setActionError(null);
    devPlan.mutate(plan, {
      onSuccess: () => globalThis.location.reload(),
      onError: (err) => setActionError(asyncError(err, 'settings.subscription.checkoutError')),
    });
  }

  function manage() {
    setActionError(null);
    portal.mutate(undefined, {
      onSuccess: (url) => {
        globalThis.location.href = url;
      },
      onError: (err) => setActionError(asyncError(err, 'settings.subscription.portalError')),
    });
  }

  const state = (() => {
    if (!status) return { tone: c.neutral, label: t('settings.subscription.loading'), detail: '' };
    if (!status.writable) {
      return {
        tone: c.danger,
        label: t('settings.subscription.locked'),
        // The server's own sentence, so the banner cannot drift from what the
        // API is actually enforcing.
        detail: status.lockReason ?? t('settings.subscription.lockedDetail'),
      };
    }
    switch (status.subscriptionStatus) {
      case 'ACTIVE':
        return {
          tone: c.success,
          label: t('settings.subscription.active'),
          detail: status.currentPeriodEnd
            ? t('settings.subscription.renewsOn', {
                date: format.dayMonthYearLong(status.currentPeriodEnd),
              })
            : '',
        };
      case 'PAST_DUE':
        return {
          tone: c.warning,
          label: t('settings.subscription.pastDue'),
          detail: t('settings.subscription.pastDueDetail'),
        };
      case 'TRIALING':
      default:
        return {
          tone: c.warning,
          label: t('settings.subscription.trial'),
          detail: status.trialEndsAt
            ? t('settings.subscription.trialEndsOn', {
                date: format.dayMonthYearLong(status.trialEndsAt),
              })
            : '',
        };
    }
  })();

  return (
    <Card style={{ marginBottom: 20 }}>
      <section aria-labelledby="settings-subscription">
        <SectionHeading id="settings-subscription" title={t('settings.subscription.title')}>
          {t('settings.subscription.subtitle')}
        </SectionHeading>

        {error && (
          <Alert tone="danger" style={{ marginBottom: 16 }}>
            {asyncErrorText(error, t)}
          </Alert>
        )}

        {!loading && status && (
          <>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '12px',
                justifyContent: 'space-between',
                marginBottom: 18,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      padding: '4px 12px',
                      borderRadius: '999px',
                      background: c.primaryBg,
                      color: c.primaryText,
                      border: `1px solid ${c.primaryBorder}`,
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {status.plan}
                  </span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: state.tone }}>
                    {state.label}
                  </span>
                </div>
                {state.detail && (
                  <div style={{ fontSize: '0.85rem', color: c.textMuted, lineHeight: 1.5 }}>
                    {state.detail}
                  </div>
                )}
              </div>

              {status.manageable && (
                <Button variant="secondary" onClick={manage} disabled={busy}>
                  {t('settings.subscription.manage')}
                </Button>
              )}
            </div>

            {/* The yearly toggle drives both the prices shown below and what
                checkout is asked for, so it sits above the comparison and is
                offered whenever there is something to buy. */}
            {status.subscriptionConfigured && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <label style={{ fontSize: '0.85rem', color: c.textMuted }}>
                  <input
                    type="checkbox"
                    checked={yearly}
                    onChange={(e) => setYearly(e.target.checked)}
                    style={{ marginRight: 8 }}
                  />
                  {t('settings.subscription.yearly')}
                </label>
              </div>
            )}

            {status.devPlanSwitch && !status.subscriptionConfigured && (
              // Labelled loudly rather than dressed up as checkout: nothing is
              // being bought here, and a screen that implied otherwise would be
              // the more dangerous bug.
              <Alert tone="warning" style={{ marginBottom: 12 }}>
                {t('settings.subscription.devSwitchWarning')}
              </Alert>
            )}

            {/* Rendered in every state. What changes is the action under each
                tier, not whether the photographer gets to see what the tiers
                are — see PlanComparison for why that was the actual bug. */}
            <PlanComparison
              currentPlan={status.plan}
              yearly={yearly && status.subscriptionConfigured}
              actionFor={(plan) => {
                if (status.subscriptionConfigured) {
                  return (
                    <PlanActionButton
                      plan={plan}
                      currentPlan={status.plan}
                      busy={busy}
                      onSelect={subscribe}
                      label={t('settings.subscription.choose', { plan })}
                      currentLabel={t('settings.subscription.currentPlan', { plan })}
                    />
                  );
                }
                if (status.devPlanSwitch) {
                  return (
                    <PlanActionButton
                      plan={plan}
                      currentPlan={status.plan}
                      busy={busy}
                      onSelect={devSetPlan}
                      label={t('settings.subscription.switchTo', { plan })}
                      currentLabel={t('settings.subscription.currentPlan', { plan })}
                    />
                  );
                }
                return null;
              }}
            />

            {!status.subscriptionConfigured && !status.devPlanSwitch && (
              // No Stripe prices on this deployment. Say so rather than showing
              // buttons that would 409 — a dead button reads as a bug. The
              // comparison above still stands, so this is now a "how to buy"
              // answer rather than the whole answer.
              <div style={{ fontSize: '0.88rem', color: c.textMuted, lineHeight: 1.55 }}>
                {t('settings.subscription.unavailable')}
              </div>
            )}
          </>
        )}
      </section>
    </Card>
  );
}
