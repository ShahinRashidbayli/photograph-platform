'use client';

import React, { useRef, useState } from 'react';
import { asyncError, asyncErrorText, type AsyncError } from '@/lib/async-error';
import { useTranslation } from '@/lib/i18n';
import { UpgradeCard } from '@/components/UpgradeCard';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useBranding, useSaveBranding, useUploadBrandingLogo } from '@/hooks/useBranding';
import { Alert, Button, Card, Field, Input, useColors } from '@/components/ui';

const DEFAULT_COLOR = '#6366F1';

/**
 * White-label branding — Studio's last unbuilt promise.
 *
 * <p>Two controls, because two things change what a client actually sees: the
 * mark at the top of a gallery, and the colour it is built around. A branding
 * screen is always tempted to offer fonts, layouts and custom CSS; all of them
 * are ways to make a photographer's own gallery look broken, and none of them
 * is what the pricing table promised.
 *
 * <p>Gated on the plan, not hidden by it: a Starter owner sees what the feature
 * is and what it costs, rather than a section that silently does not exist.
 */
export function BrandingSettings() {
  const { t } = useTranslation();
  const c = useColors();
  const { has } = useEntitlements();
  const allowed = has('WHITE_LABEL_BRANDING');

  const brandingQuery = useBranding();
  const saveBranding = useSaveBranding();
  const uploadLogoMutation = useUploadBrandingLogo();
  const branding = brandingQuery.data ?? null;
  const loading = brandingQuery.isLoading;
  const busy = saveBranding.isPending || uploadLogoMutation.isPending;
  // Untouched means the saved colour — derived rather than copied into state on
  // load, so the picker never shows one colour while the server holds another.
  const [chosenColor, setColor] = useState<string | null>(null);
  const color = chosenColor ?? branding?.brandColor ?? DEFAULT_COLOR;
  const [saved, setSaved] = useState(false);
  const [actionError, setActionError] = useState<AsyncError | null>(null);
  const error =
    actionError ??
    (brandingQuery.isError ? asyncError(brandingQuery.error, 'settings.branding.loadError') : null);
  const fileInput = useRef<HTMLInputElement>(null);

  /** Saves one field at a time — see useSaveBranding for why. */
  function save(next: { logoKey?: string | null; brandColor?: string | null }) {
    setActionError(null);
    setSaved(false);
    saveBranding.mutate(next, {
      onSuccess: () => setSaved(true),
      onError: (err) => setActionError(asyncError(err, 'settings.branding.saveError')),
    });
  }

  function uploadLogo(file: File) {
    setActionError(null);
    setSaved(false);
    uploadLogoMutation.mutate(file, {
      onSuccess: () => setSaved(true),
      onError: (err) => setActionError(asyncError(err, 'settings.branding.uploadError')),
    });
  }

  if (loading) {
    return (
      <Card>
        <p style={{ margin: 0, fontSize: '0.9rem', color: c.textMuted }}>
          {t('settings.branding.loading')}
        </p>
      </Card>
    );
  }

  if (!allowed) {
    return (
      <UpgradeCard
        capability="WHITE_LABEL_BRANDING"
        title={t('settings.branding.upgradeTitle')}
        body={t('settings.branding.upgradeBody')}
      />
    );
  }

  return (
    <Card>
      {error && (
        <Alert tone="danger" style={{ marginBottom: 16 }}>
          {asyncErrorText(error, t)}
        </Alert>
      )}

      {/* Not a `Field`: that renders `<label for=…>` and hands the id to its
          child, and this block's control is a button plus a hidden file input.
          A label pointing at nothing is worse than a plain heading. */}
      <div style={{ marginBottom: 18 }}>
        <span
          style={{
            display: 'block',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: c.text,
            marginBottom: 8,
          }}
        >
          {t('settings.branding.logo')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div
            style={{
              width: 96,
              height: 56,
              borderRadius: 8,
              border: `1px solid ${c.border}`,
              background: c.surfaceAlt,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {branding?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt={t('settings.branding.logo')}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            ) : (
              <span style={{ fontSize: '0.72rem', color: c.textSubtle }}>
                {t('settings.branding.noLogo')}
              </span>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadLogo(file);
              e.target.value = '';
            }}
          />
          <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={busy}>
            {branding?.logoUrl
              ? t('settings.branding.replaceLogo')
              : t('settings.branding.uploadLogo')}
          </Button>
          {branding?.logoUrl && (
            <Button variant="ghost" onClick={() => save({ logoKey: null })} disabled={busy}>
              {t('settings.branding.removeLogo')}
            </Button>
          )}
        </div>
      </div>

      <Field label={t('settings.branding.color')} hint={t('settings.branding.colorHint')}>
        {(props) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label={t('settings.branding.color')}
              style={{
                width: 44,
                height: 38,
                padding: 2,
                border: `1px solid ${c.border}`,
                borderRadius: 8,
                background: c.surface,
                cursor: 'pointer',
              }}
            />
            <Input
              {...props}
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{ width: 130, fontFamily: 'monospace' }}
              maxLength={7}
            />
            <Button onClick={() => save({ brandColor: color })} busy={busy}>
              {t('settings.branding.save')}
            </Button>
          </div>
        )}
      </Field>

      {saved && <Alert tone="success">{t('settings.branding.saved')}</Alert>}
    </Card>
  );
}
