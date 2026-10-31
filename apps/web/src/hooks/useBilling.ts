import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { StripeConnectStatus } from '@/types/api';

/**
 * Two kinds of money, kept apart on purpose: the subscription the
 * photographer pays Fotolio (`/api/billing`), and the Stripe account their own
 * clients pay into (`/api/settings/stripe`). Reading one as the other means
 * believing you can take money when you cannot, or that you are paying when
 * you are not.
 *
 * <p>The actions that leave for Stripe (checkout, portal, onboarding) resolve
 * to a URL and leave the navigation to the screen; none of them changes
 * anything cached, because the change arrives later, by webhook.
 */

/** Mirrors `BillingStatusResponse` on the API. */
export interface BillingStatus {
  plan: 'STARTER' | 'PRO' | 'STUDIO';
  subscriptionStatus:
    | 'NONE'
    | 'TRIALING'
    | 'ACTIVE'
    | 'PAST_DUE'
    | 'CANCELED'
    | 'INCOMPLETE'
    | 'UNPAID';
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  subscriptionConfigured: boolean;
  manageable: boolean;
  writable: boolean;
  /** Deployment has enabled unbilled plan changes — development only. */
  devPlanSwitch: boolean;
  lockReason: string | null;
}

export function billingStatusKey() {
  return ['billing'] as const;
}

export function stripeConnectKey() {
  return ['settings', 'stripe'] as const;
}

/**
 * @param pollUntilActive re-read every 2s until the subscription is ACTIVE —
 *        for the return from a successful checkout, where the webhook that
 *        flips it is authoritative but can land after the browser does
 */
export function useBillingStatus({ pollUntilActive = false } = {}) {
  return useQuery({
    queryKey: billingStatusKey(),
    queryFn: async () => (await api.get<BillingStatus>('/api/billing')).data,
    refetchInterval: (query) =>
      pollUntilActive && query.state.data?.subscriptionStatus !== 'ACTIVE' ? 2000 : false,
  });
}

export function useStartCheckout() {
  return useMutation({
    mutationFn: async (input: { plan: BillingStatus['plan']; interval: 'MONTHLY' | 'YEARLY' }) =>
      (await api.post<{ url: string }>('/api/billing/checkout', input)).data.url,
  });
}

export function useOpenBillingPortal() {
  return useMutation({
    mutationFn: async () => (await api.post<{ url: string }>('/api/billing/portal')).data.url,
  });
}

/**
 * The development-only plan switch. The screen reloads afterwards rather than
 * invalidating: the plan changes what the whole shell shows — the sidebar's
 * analytics group, the team section, gallery retention.
 */
export function useDevSetPlan() {
  return useMutation({
    mutationFn: (plan: BillingStatus['plan']) => api.post('/api/billing/dev-plan', { plan }),
  });
}

/** Our mirror of the photographer's Stripe account. */
export function useStripeConnectStatus(enabled = true) {
  return useQuery({
    queryKey: stripeConnectKey(),
    enabled,
    queryFn: async () => (await api.get<StripeConnectStatus>('/api/settings/stripe')).data,
  });
}

/**
 * Asks Stripe rather than our mirror. For the return from hosted onboarding:
 * the account.updated webhook is authoritative but can land after the
 * redirect, and a screen still saying "not connected" one second after a
 * successful onboarding reads as a failure.
 */
export function useRefreshStripeConnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      (await api.post<StripeConnectStatus>('/api/settings/stripe/refresh')).data,
    onSuccess: (status) => qc.setQueryData(stripeConnectKey(), status),
  });
}

export function useStripeOnboardingLink() {
  return useMutation({
    mutationFn: async () =>
      (await api.post<{ url: string }>('/api/settings/stripe/onboarding-link')).data.url,
  });
}
