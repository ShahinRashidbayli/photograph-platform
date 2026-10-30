'use client';

import React from 'react';
import { SubscriptionSection } from '../BillingSettings';

/**
 * The subscription the photographer holds with Fotolio.
 *
 * <p>A route of its own because every plan gate in the app points here — the
 * sidebar's locked rows, the four upgrade cards, and the 402 dialog. It used to
 * be a fragment two thirds of the way down a very long page, which needed a
 * retrying scroll shim to reach and still landed the photographer somewhere
 * they had to orient themselves. `DEVELOPMENT_PLAN.md` asked for this route in
 * Phase 1; the gates are what finally made it worth having.
 */
export default function PlanSettingsPage() {
  return <SubscriptionSection />;
}
