'use client';

import React from 'react';
import { DatevExportSection, StripeConnectSection } from '../BillingSettings';

/**
 * Money coming in, and handing the books to someone else.
 *
 * <p>Payouts first — nothing can be collected until Stripe onboarding is done —
 * then the DATEV export, which is downstream of everything above it and of the
 * business name configured on the Business panel.
 *
 * <p>Stripe redirects back to this route after hosted onboarding
 * (`StripeConnectService` builds `/settings/payments?stripe=return`). The
 * banner that reads that parameter lives in the dashboard shell, so it renders
 * whichever settings panel the photographer lands on — including the old
 * `/settings` URL, which still forwards here for links minted before the split.
 */
export default function PaymentsSettingsPage() {
  return (
    <React.Suspense fallback={null}>
      <StripeConnectSection />
      <DatevExportSection />
    </React.Suspense>
  );
}
