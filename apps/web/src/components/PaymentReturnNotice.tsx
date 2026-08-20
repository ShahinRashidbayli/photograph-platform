'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useThemeStore } from '@/store/themeStore';
import { getColors } from '@/lib/design-tokens';
import { useTranslation } from '@/lib/i18n';

/**
 * Tells a client how a redirected card payment went.
 *
 * <p>SCA/3DS is mandatory for most EU cards, so leaving the page mid-payment is
 * the normal path, not an edge case — and Stripe brings the client back with
 * nothing but query parameters. Without this they land on a screen that looks
 * exactly like the one they left, with no confirmation that the bank approved
 * anything, which is the moment people pay twice.
 *
 * <p>Mounted once in the dashboard layout rather than per page, because the
 * return URL is wherever the client started (a booking, the payments screen),
 * and `redirect_status` means the same thing on all of them.
 */
/** What Stripe appends to the return URL, and the only keys we may remove. */
const STRIPE_RETURN_PARAMS = [
  'payment_intent',
  'payment_intent_client_secret',
  'redirect_status',
  'setup_intent',
  'setup_intent_client_secret',
] as const;

export function PaymentReturnNotice() {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const c = useMemo(() => getColors(theme), [theme]);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const status = searchParams.get('redirect_status');
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (!status) return;
    setShown(status);
    // The webhook is what actually marks the payment settled; refetch rather
    // than trusting the query string, which the client can edit.
    queryClient.invalidateQueries({ queryKey: ['payments'] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
    // Strip Stripe's parameters so a reload (or a shared link) doesn't replay
    // the banner over a payment that has long since settled.
    //
    // Only Stripe's, though. The return URL is wherever the payer started —
    // `confirmParams.return_url` is `location.href` — so it carries whatever
    // that screen had in its query string. Replacing with the bare pathname
    // dropped all of it, and a client who paid from a filtered or tabbed view
    // came back to a page reset to its defaults.
    const remaining = new URLSearchParams(searchParams);
    for (const key of STRIPE_RETURN_PARAMS) {
      remaining.delete(key);
    }
    const query = remaining.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [status, queryClient, router, pathname, searchParams]);

  if (!shown) return null;

  const failed = shown === 'failed';
  const pending = shown === 'pending' || shown === 'processing';
  const palette = failed
    ? { bg: c.dangerBg, border: c.dangerBorder, text: c.dangerText }
    : pending
      ? { bg: c.warningBg, border: c.warningBorder, text: c.warningText }
      : { bg: c.successBg, border: c.successBorder, text: c.successText };

  return (
    <div
      role="status"
      style={{
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.text,
        borderRadius: '12px',
        padding: '12px 16px',
        margin: '16px 24px 0',
        fontSize: '0.88rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <span>
        <strong style={{ marginRight: 6 }}>
          {failed
            ? t('invoices.payDialog.confirmFailed')
            : pending
              ? t('invoices.payDialog.pendingTitle')
              : t('invoices.payDialog.succeededTitle')}
        </strong>
        {failed
          ? ''
          : pending
            ? t('invoices.payDialog.pendingBody')
            : t('invoices.payDialog.succeededBody')}
      </span>
      <button
        type="button"
        onClick={() => setShown(null)}
        aria-label={t('invoices.payDialog.close')}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          fontSize: '1.2rem',
          lineHeight: 1,
          cursor: 'pointer',
        }}
      >
        ×
      </button>
    </div>
  );
}
