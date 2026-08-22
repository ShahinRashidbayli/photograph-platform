'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useThemeStore } from '@/store/themeStore';
import { getColors } from '@/lib/design-tokens';
import { useTranslation } from '@/lib/i18n';
import { useIsPhotographer } from '@/store/authStore';

interface Entitlements {
  plan: string;
  capabilities: string[];
  galleryRetentionDays: number;
  seats: number;
  commissionBps: number;
  writable: boolean;
  lockReason: string | null;
  trialEndsAt: string | null;
  subscriptionStatus: string;
}

/**
 * Explains a read-only account, once, at the top of every dashboard page.
 *
 * <p>Without it the lock is invisible until something fails: the server
 * refuses every write with a 402, so a photographer clicking "Create booking"
 * would get a generic error on that screen and no reason anywhere. The reason
 * is not a message this component writes — it comes from
 * {@code GET /api/entitlements}, which is the same object the API gates on, so
 * the banner cannot drift from what is actually being enforced.
 *
 * <p>Renders nothing at all in the normal case, which is almost always.
 */
export function AccountLockNotice() {
  const { t, format } = useTranslation();
  const { theme } = useThemeStore();
  const c = getColors(theme);
  const isPhotographer = useIsPhotographer();
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);

  useEffect(() => {
    // Clients share the tenant but are not the party being billed, and their
    // writes are never locked — asking on their behalf would only produce a
    // banner about someone else's subscription.
    if (!isPhotographer) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await api.get<Entitlements>('/api/entitlements');
        if (!cancelled) setEntitlements(data);
      } catch {
        // Best-effort: a banner that cannot load must not break the shell.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPhotographer]);

  if (!entitlements) return null;

  // The last days of a trial are worth flagging before they run out, not after
  // — by then the account is already locked and the work is already blocked.
  const trialEndsAt = entitlements.trialEndsAt ? new Date(entitlements.trialEndsAt) : null;
  const daysLeft = trialEndsAt
    ? Math.ceil((trialEndsAt.getTime() - Date.now()) / 86_400_000)
    : null;
  const endingSoon =
    entitlements.writable &&
    entitlements.subscriptionStatus === 'TRIALING' &&
    daysLeft !== null &&
    daysLeft <= 3;

  if (entitlements.writable && !endingSoon) return null;

  const locked = !entitlements.writable;

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '12px 16px',
        marginBottom: '20px',
        borderRadius: '12px',
        border: `1px solid ${locked ? c.dangerBorder : c.warningBorder}`,
        background: locked ? c.dangerBg : c.warningBg,
        color: locked ? c.dangerText : c.warningText,
        fontSize: '0.88rem',
        lineHeight: 1.55,
      }}
    >
      <span>
        {locked
          ? (entitlements.lockReason ?? t('account.locked.fallback'))
          : t('account.trialEndingSoon', {
              days: String(daysLeft),
              date: trialEndsAt ? format.dayMonthYearLong(trialEndsAt.toISOString()) : '',
            })}
      </span>
      <Link
        href="/settings"
        style={{
          fontWeight: 700,
          textDecoration: 'underline',
          color: 'inherit',
          whiteSpace: 'nowrap',
        }}
      >
        {t('account.choosePlan')}
      </Link>
    </div>
  );
}
