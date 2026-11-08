'use client';

import React, { useState } from 'react';
import { asyncError, asyncErrorText, type AsyncError } from '@/lib/async-error';
import { useTranslation } from '@/lib/i18n';
import { Alert, Button, Card, EmptyState, Field, Input, useColors } from '@/components/ui';
import {
  useCreateResource,
  useResources,
  useUpdateResource,
  type StudioResource as Resource,
} from '@/hooks/useResources';

/**
 * The studio's rooms and kit.
 *
 * <p>Retired resources stay on this screen — greyed, with a "bring back"
 * button — because retiring is not deleting. One that shot fifty weddings
 * still explains what shot them, and a studio that sells a lens and buys the
 * same model back should not have to reconstruct it.
 *
 * <p>Not plan-gated: writing down which room a shoot is in is the product's own
 * bookkeeping. What the Studio plan makes valuable is the conflict warning,
 * which only bites once several people book against one set of things.
 */
export function ResourceSettings() {
  const { t } = useTranslation();
  const c = useColors();

  // The settings screen is where a retired resource is brought back, so it is
  // the one caller that needs to see them.
  const resourcesQuery = useResources({ includeRetired: true });
  const createResource = useCreateResource();
  const updateResource = useUpdateResource();
  const resources = resourcesQuery.data ?? [];
  const loading = resourcesQuery.isLoading;
  const busy = createResource.isPending || updateResource.isPending;
  const [actionError, setActionError] = useState<AsyncError | null>(null);
  const error =
    actionError ??
    (resourcesQuery.isError
      ? asyncError(resourcesQuery.error, 'settings.resources.loadError')
      : null);

  const [name, setName] = useState('');
  const [kind, setKind] = useState<'ROOM' | 'EQUIPMENT'>('EQUIPMENT');

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setActionError(null);
    createResource.mutate(
      { name: name.trim(), kind },
      {
        onSuccess: () => setName(''),
        onError: (err) => setActionError(asyncError(err, 'settings.resources.addError')),
      }
    );
  }

  /** Retire or bring back. The same endpoint the edit form uses. */
  function setActive(resource: Resource, active: boolean) {
    setActionError(null);
    updateResource.mutate(
      { ...resource, active },
      { onError: (err) => setActionError(asyncError(err, 'settings.resources.saveError')) }
    );
  }

  if (loading) {
    return (
      <Card>
        <p style={{ margin: 0, fontSize: '0.9rem', color: c.textMuted }}>
          {t('settings.resources.loading')}
        </p>
      </Card>
    );
  }

  const rooms = resources.filter((r) => r.kind === 'ROOM');
  const equipment = resources.filter((r) => r.kind !== 'ROOM');

  return (
    <Card>
      {error && (
        <Alert tone="danger" style={{ marginBottom: 16 }}>
          {asyncErrorText(error, t)}
        </Alert>
      )}

      {resources.length === 0 ? (
        <EmptyState
          title={t('settings.resources.emptyTitle')}
          body={t('settings.resources.emptyBody')}
        />
      ) : (
        <>
          {[
            { label: t('settings.resources.rooms'), items: rooms },
            { label: t('settings.resources.equipment'), items: equipment },
          ]
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <div key={group.label} style={{ marginBottom: 18 }}>
                <div
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: c.textSubtle,
                    marginBottom: 8,
                  }}
                >
                  {group.label}
                </div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {group.items.map((r) => (
                    <li
                      key={r.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '10px 0',
                        borderTop: `1px solid ${c.border}`,
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.9rem',
                          // Retired reads as retired rather than disappearing:
                          // it is still what shot last year's work.
                          color: r.active ? c.text : c.textSubtle,
                          textDecoration: r.active ? 'none' : 'line-through',
                        }}
                      >
                        {r.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActive(r, !r.active)}
                        disabled={busy}
                      >
                        {r.active
                          ? t('settings.resources.retire')
                          : t('settings.resources.restore')}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </>
      )}

      <form onSubmit={add} style={{ borderTop: `1px solid ${c.border}`, paddingTop: 16 }}>
        <Field label={t('settings.resources.addLabel')}>
          {(props) => (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Input
                {...props}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('settings.resources.addPlaceholder')}
                style={{ flex: '1 1 200px' }}
                maxLength={120}
              />
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as 'ROOM' | 'EQUIPMENT')}
                aria-label={t('settings.resources.kind')}
                style={{
                  padding: '9px 10px',
                  borderRadius: 8,
                  border: `1px solid ${c.border}`,
                  background: c.surface,
                  color: c.text,
                  fontSize: '0.9rem',
                  fontFamily: 'inherit',
                }}
              >
                <option value="EQUIPMENT">{t('settings.resources.equipment')}</option>
                <option value="ROOM">{t('settings.resources.rooms')}</option>
              </select>
              <Button type="submit" busy={busy} disabled={!name.trim()}>
                {t('settings.resources.add')}
              </Button>
            </div>
          )}
        </Field>
      </form>
    </Card>
  );
}
