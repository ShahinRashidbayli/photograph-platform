'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Modal, ModalHeader, useColors } from '@/components/ui';
import { useTranslation } from '@/lib/i18n';
import { planThatGrants, UPGRADE_HREF, type Plan } from '@/lib/plan-gate';

interface UpgradeDetail {
  message?: string;
  capability?: string;
  requiredPlan?: string;
}

/**
 * What the photographer sees when they try to do something their plan does not
 * include.
 *
 * <p>Mounted once in the dashboard shell and driven by the
 * `app:plan-upgrade-required` window event that `lib/api` raises on a 402 —
 * the same shape as the email-verification toast, and for the same reason: the
 * alternative is every call site growing its own handler, and the ones that
 * forget failing into a generic red banner that says nothing about plans.
 *
 * <p>A dialog rather than a toast, because this one is not an FYI. The action
 * the photographer just took did not happen, and the reason is something they
 * can fix — that deserves an interruption and a button, not a notice that
 * disappears after six seconds.
 *
 * <p>Text comes from the server when it sent any: `PlanUpgradeRequiredException`
 * carries a message written for the specific limit ("Your plan includes 3
 * seats"), which is more useful than this component's generic line.
 */
export function PlanUpgradeDialog() {
  const { t } = useTranslation();
  const c = useColors();
  const router = useRouter();
  const [detail, setDetail] = useState<UpgradeDetail | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      setDetail((event as CustomEvent<UpgradeDetail>).detail ?? {});
    };
    window.addEventListener('app:plan-upgrade-required', handler);
    return () => window.removeEventListener('app:plan-upgrade-required', handler);
  }, []);

  if (!detail) return null;

  const required = (detail.requiredPlan ??
    (detail.capability ? planThatGrants(detail.capability) : null)) as Plan | null;

  return (
    <Modal label={t('upgrade.dialogTitle')} maxWidth={460} onClose={() => setDetail(null)}>
      <ModalHeader title={t('upgrade.dialogTitle')} onClose={() => setDetail(null)} />

      {required && (
        <div style={{ marginBottom: 12 }}>
          <span
            style={{
              display: 'inline-block',
              padding: '3px 11px',
              borderRadius: 999,
              background: c.primaryBg,
              color: c.primaryText,
              border: `1px solid ${c.primaryBorder}`,
              fontSize: '0.72rem',
              fontWeight: 800,
              letterSpacing: '0.06em',
            }}
          >
            {required}
          </span>
        </div>
      )}

      <p style={{ fontSize: '0.92rem', color: c.text, lineHeight: 1.6, margin: '0 0 8px' }}>
        {detail.message || t('upgrade.dialogBody')}
      </p>
      {required && (
        <p
          style={{ fontSize: '0.88rem', color: c.textMuted, lineHeight: 1.55, margin: '0 0 18px' }}
        >
          {t('upgrade.dialogPlanLine' as never, { plan: required })}
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Button variant="secondary" onClick={() => setDetail(null)}>
          {t('upgrade.notNow')}
        </Button>
        {/* Navigated rather than wrapped in a Link so the dialog closes on the
            way out; leaving it mounted over the settings page would hide the
            very controls it just sent the photographer to use. */}
        <Button
          onClick={() => {
            setDetail(null);
            router.push(UPGRADE_HREF);
          }}
        >
          {t('upgrade.seePlans')}
        </Button>
      </div>
    </Modal>
  );
}
