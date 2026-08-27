'use client';

import React, { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { asyncError, asyncErrorText, type AsyncError } from '@/lib/async-error';
import { useTranslation } from '@/lib/i18n';
import { Alert, Button, Card, EmptyState, Field, Input, useColors } from '@/components/ui';

interface Resource {
  id: string;
  name: string;
  kind: 'ROOM' | 'EQUIPMENT';
  notes: string | null;
  active: boolean;
}

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

  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AsyncError | null>(null);

  const [name, setName] = useState('');
  const [kind, setKind] = useState<'ROOM' | 'EQUIPMENT'>('EQUIPMENT');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<Resource[]>('/api/resources', {
        // The settings screen is where a retired resource is brought back, so
        // it is the one caller that needs to see them.
        params: { includeRetired: true },
      });
      setResources(data);
    } catch (err) {
      setError(asyncError(err, 'settings.resources.loadError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/resources', { name: name.trim(), kind });
      setName('');
      await load();
    } catch (err) {
      setError(asyncError(err, 'settings.resources.addError'));
    } finally {
      setBusy(false);
    }
  }

  /** Retire or bring back. The same endpoint the edit form uses. */
  async function setActive(resource: Resource, active: boolean) {
    setBusy(true);
    setError(null);
    try {
      await api.put(`/api/resources/${resource.id}`, {
        name: resource.name,
        kind: resource.kind,
        notes: resource.notes,
        active,
      });
      await load();
    } catch (err) {
      setError(asyncError(err, 'settings.resources.saveError'));
    } finally {
      setBusy(false);
    }
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
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
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
                        onClick={() => void setActive(r, !r.active)}
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
