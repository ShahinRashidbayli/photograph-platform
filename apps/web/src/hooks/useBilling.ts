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
    'NONE' | 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE' | 'UNPAID';
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
 * Whether the status already reflects a Stripe subscription, i.e. the webhook
 * has landed. Not just "ACTIVE": a checkout made mid-trial carries the trial
 * over to Stripe and comes back TRIALING, and a failed first payment stays
 * INCOMPLETE — waiting for ACTIVE polled those forever.
 *
 * <p>TRIALING is also our own pre-checkout default, told apart by
 * `currentPeriodEnd`, which only the webhook writes. It is never cleared on
 * cancellation, so a CANCELED status with one set is the old subscription,
 * not the new one.
 */
export function reflectsCheckout(status: BillingStatus): boolean {
  switch (status.subscriptionStatus) {
    case 'NONE':
    case 'CANCELED':
      return false;
    case 'TRIALING':
      return status.currentPeriodEnd !== null;
    default:
      return true;
  }
}

/** About a minute at 2s — past that a webhook is not late, it is not coming. */
export const CHECKOUT_POLL_MAX_READS = 30;

/**
 * @param pollAfterCheckout re-read every 2s until the webhook from a
 *        successful checkout has landed — it is authoritative but can arrive
 *        after the browser does. Gives up after {@link CHECKOUT_POLL_MAX_READS}.
 */
export function useBillingStatus({ pollAfterCheckout = false } = {}) {
  return useQuery({
    queryKey: billingStatusKey(),
    queryFn: async () => (await api.get<BillingStatus>('/api/billing')).data,
    refetchInterval: ({ state }) => {
      if (!pollAfterCheckout) return false;
      if (state.data && reflectsCheckout(state.data)) return false;
      return state.dataUpdateCount + state.errorUpdateCount < CHECKOUT_POLL_MAX_READS
        ? 2000
        : false;
    },
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
