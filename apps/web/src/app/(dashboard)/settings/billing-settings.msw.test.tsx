import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, setupUser } from '@/test-utils/render';
import { http, HttpResponse, server } from '@/test-utils/msw';
import { billingProfileKey } from '@/hooks/useInvoices';
import type { BillingProfile, StripeConnectStatus } from '@/types/api';
import {
  BillingProfileSection,
  StripeConnectSection,
  SubscriptionSection,
} from './BillingSettings';

/**
 * Settings → Business, Payments and Plan against a faked API.
 *
 * <p>Written before these sections moved onto hooks, to pin what they already
 * did — above all the Stripe redirects, where a stale read racing the refresh
 * once painted "not connected" over a finished onboarding. One case is new: a
 * successful checkout was meant to re-read until the webhook landed, but the
 * redirect parameter it keyed on was stripped before the first answer came
 * back, so it never did.
 */
let params = new URLSearchParams('');
const replace = jest.fn(() => {
  params = new URLSearchParams('');
});
jest.mock('next/navigation', () => ({
  usePathname: () => '/settings',
  useRouter: () => ({ push: jest.fn(), replace, refresh: jest.fn(), back: jest.fn() }),
  useSearchParams: () => params,
  useParams: () => ({}),
}));

const PROFILE: BillingProfile = {
  businessName: 'Anna Fischer Fotografie',
  addressLine1: 'Hauptstr. 1',
  addressLine2: null,
  postalCode: '10115',
  city: 'Berlin',
  country: 'DE',
  taxId: '12/345/67890',
  vatId: null,
  taxMode: 'KLEINUNTERNEHMER',
  complete: true,
};

const STRIPE: StripeConnectStatus = {
  platformConfigured: true,
  accountId: 'acct_1',
  chargesEnabled: true,
  payoutsEnabled: true,
  detailsSubmitted: true,
  onboardedAt: '2026-09-01T00:00:00Z',
  plan: 'PRO',
  commissionBps: 200,
};

function billing(subscriptionStatus: string) {
  return {
    plan: 'PRO',
    subscriptionStatus,
    trialEndsAt: null,
    currentPeriodEnd: null,
    subscriptionConfigured: true,
    manageable: true,
    writable: true,
    devPlanSwitch: false,
    lockReason: null,
  };
}

beforeEach(() => {
  params = new URLSearchParams('');
  replace.mockClear();
});

describe('BillingProfileSection', () => {
  it('fills the form and hands the saved profile to the invoice form’s cache', async () => {
    server.use(
      http.get('/api/settings/billing-profile', () => HttpResponse.json(PROFILE)),
      http.put('/api/settings/billing-profile', async ({ request }) =>
        HttpResponse.json({ ...PROFILE, ...((await request.json()) as object) })
      )
    );
    const user = setupUser();
    const { queryClient } = renderWithProviders(<BillingProfileSection />, { lang: 'en' });
    queryClient.setQueryDefaults(billingProfileKey(), { gcTime: Infinity });

    const name = await screen.findByLabelText(/Business name/);
    await waitFor(() => expect(name).toHaveValue('Anna Fischer Fotografie'));
    await user.clear(name);
    await user.type(name, 'Studio Fischer');
    await user.click(screen.getByRole('button', { name: 'Save business details' }));

    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(queryClient.getQueryData<BillingProfile>(billingProfileKey())?.businessName).toBe(
      'Studio Fischer'
    );
  });

  /** Its defaults are not the tenant's values; saving them would rewrite the tax mode. */
  it('will not save when the profile could not be loaded', async () => {
    server.use(
      http.get('/api/settings/billing-profile', () => HttpResponse.json({}, { status: 500 }))
    );
    renderWithProviders(<BillingProfileSection />, { lang: 'en' });

    expect(await screen.findByText('Could not load your business details.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save business details' })).toBeDisabled();
  });
});

describe('StripeConnectSection', () => {
  it('shows the status on a plain visit', async () => {
    server.use(http.get('/api/settings/stripe', () => HttpResponse.json(STRIPE)));
    renderWithProviders(<StripeConnectSection />, { lang: 'en' });

    expect(await screen.findByText('Ready')).toBeInTheDocument();
  });

  it('asks Stripe, and only Stripe, when coming back from onboarding', async () => {
    params = new URLSearchParams('stripe=return');
    let plainReads = 0;
    server.use(
      http.get('/api/settings/stripe', () => {
        plainReads += 1;
        return HttpResponse.json({ ...STRIPE, chargesEnabled: false, accountId: null });
      }),
      http.post('/api/settings/stripe/refresh', () => HttpResponse.json(STRIPE))
    );
    renderWithProviders(<StripeConnectSection />, { lang: 'en' });

    expect(await screen.findByText('Ready')).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith('/settings/payments');
    expect(plainReads).toBe(0);
  });
  it('falls back to our own record when Stripe cannot be asked', async () => {
    params = new URLSearchParams('stripe=return');
    server.use(
      http.get('/api/settings/stripe', () => HttpResponse.json(STRIPE)),
      http.post('/api/settings/stripe/refresh', () => HttpResponse.json({}, { status: 502 }))
    );
    renderWithProviders(<StripeConnectSection />, { lang: 'en' });

    expect(await screen.findByText('Could not load your payout status.')).toBeInTheDocument();
    expect(await screen.findByText('Ready')).toBeInTheDocument();
  });
});

describe('SubscriptionSection', () => {
  it('re-reads after a successful checkout until the plan is active', async () => {
    params = new URLSearchParams('billing=success');
    let reads = 0;
    server.use(
      http.get('/api/billing', () => {
        reads += 1;
        return HttpResponse.json(billing(reads === 1 ? 'TRIALING' : 'ACTIVE'));
      })
    );
    renderWithProviders(<SubscriptionSection />, { lang: 'en' });

    expect(await screen.findByText('Free trial')).toBeInTheDocument();
    expect(await screen.findByText('Active', {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('says so when the checkout cannot be opened', async () => {
    server.use(
      http.get('/api/billing', () => HttpResponse.json(billing('TRIALING'))),
      http.post('/api/billing/checkout', () => HttpResponse.json({}, { status: 500 }))
    );
    const user = setupUser();
    renderWithProviders(<SubscriptionSection />, { lang: 'en' });

    await screen.findByText('Free trial');
    const choose = screen
      .getAllByRole('button')
      .find(
        (b) => !b.hasAttribute('disabled') && /Studio|Choose|Upgrade/i.test(b.textContent ?? '')
      );
    expect(choose).toBeDefined();
    await user.click(choose!);

    expect(
      await screen.findByText('Could not open the checkout. Please try again.')
    ).toBeInTheDocument();
  });
});
