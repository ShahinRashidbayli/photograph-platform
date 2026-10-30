'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { asyncError, asyncErrorText, type AsyncError } from '@/lib/async-error';
import { useTranslation } from '@/lib/i18n';
import { UpgradeCard } from '@/components/UpgradeCard';
import { useEntitlements } from '@/hooks/useEntitlements';
import { Alert, Button, Card, Field, Input, useColors } from '@/components/ui';

interface Branding {
  logoUrl: string | null;
  brandColor: string | null;
  whiteLabel: boolean;
}

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

  const [branding, setBranding] = useState<Branding | null>(null);
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<AsyncError | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<Branding>('/api/settings/branding');
      setBranding(data);
      setColor(data.brandColor ?? DEFAULT_COLOR);
    } catch (err) {
      setError(asyncError(err, 'settings.branding.loadError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Saves one field at a time.
   *
   * <p>`undefined` is left out of the request entirely, which the API reads as
   * "leave it"; `null` is sent as `""`, which it reads as "clear it". Sending
   * both fields on every save is what made saving a colour delete the logo —
   * the two are edited by different controls and the form never holds the
   * logo's key, only its (expiring) URL.
   */
  async function save(next: { logoKey?: string | null; brandColor?: string | null }) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      // Only the field being changed is sent. Absent means "leave it" on the
      // server, and "" means "clear it" — sending both every time is what made
      // saving a colour delete the logo.
      const body: Record<string, string> = {};
      if (next.logoKey !== undefined) body.logoKey = next.logoKey ?? '';
      if (next.brandColor !== undefined) body.brandColor = next.brandColor ?? '';
      const { data } = await api.put<Branding>('/api/settings/branding', body);
      setBranding(data);
      setSaved(true);
    } catch (err) {
      setError(asyncError(err, 'settings.branding.saveError'));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Uploads straight to R2 through a pre-signed PUT, then stores the object
   * key — never the view URL, which expires within the hour. Same flow as the
   * profile photo, down to sending back the content type the URL was signed
   * with rather than the browser's own guess.
   */
  async function uploadLogo(file: File) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const contentType = file.type || 'image/png';
      const { data: presign } = await api.post<{
        uploadUrl: string;
        r2Key: string;
        contentType: string;
      }>(
        `/api/settings/branding/logo/presign?contentType=${encodeURIComponent(contentType)}` +
          `&fileSizeBytes=${file.size}`
      );
      const res = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': presign.contentType },
        body: file,
      });
      if (!res.ok) throw new Error('upload failed');
      await save({ logoKey: presign.r2Key });
    } catch (err) {
      setError(asyncError(err, 'settings.branding.uploadError'));
      setBusy(false);
    }
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
              if (file) void uploadLogo(file);
              e.target.value = '';
            }}
          />
          <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={busy}>
            {branding?.logoUrl
              ? t('settings.branding.replaceLogo')
              : t('settings.branding.uploadLogo')}
          </Button>
          {branding?.logoUrl && (
            <Button variant="ghost" onClick={() => void save({ logoKey: null })} disabled={busy}>
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
            <Button onClick={() => void save({ brandColor: color })} busy={busy}>
              {t('settings.branding.save')}
            </Button>
          </div>
        )}
      </Field>

      {saved && <Alert tone="success">{t('settings.branding.saved')}</Alert>}
    </Card>
  );
}
