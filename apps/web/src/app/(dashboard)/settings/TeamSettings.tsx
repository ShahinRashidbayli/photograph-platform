'use client';

import React, { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { asyncError, asyncErrorText, type AsyncError } from '@/lib/async-error';
import { useTranslation } from '@/lib/i18n';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useThemeStore } from '@/store/themeStore';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { UserAvatar } from '@/components/UserAvatar';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, useColors } from '@/components/ui';

type StaffRole = 'OWNER' | 'MEMBER';
type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

interface TeamMember {
  id: string;
  email: string;
  fullName: string | null;
  staffRole: StaffRole;
  avatarUrl: string | null;
}

interface TeamInvitation {
  id: string;
  email: string;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
}

interface Team {
  members: TeamMember[];
  invitations: TeamInvitation[];
  seatsUsed: number;
  seatsTotal: number;
  canManage: boolean;
}

/**
 * The studio's team: who is in it, who has been invited, and how many seats
 * the plan leaves.
 *
 * <p>Rendered for every photographer, not only owners. A member seeing the
 * colleagues they work alongside is the point of a team screen; what they do
 * not get is the controls, which is what `canManage` decides. That flag comes
 * from the server rather than from reading the current user's own role here,
 * so the screen and the API cannot disagree about who may act.
 *
 * <p>On a one-seat plan there is no team to manage, so the section becomes an
 * upgrade prompt instead. It previously rendered in full on Starter: an invite
 * form the API answers with 402, next to the line "2 of 1 seats used" — which
 * is a real state (a studio that downgraded keeps the people it already had)
 * but reads as a counting bug. The exception below is for exactly that case:
 * once somebody is over the limit they need to see who, or they cannot get
 * back under it.
 */
export function TeamSettings() {
  const { t, format } = useTranslation();
  const c = useColors();
  const { theme } = useThemeStore();
  const { seats } = useEntitlements();

  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AsyncError | null>(null);

  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<AsyncError | null>(null);
  const [invited, setInvited] = useState<string | null>(null);

  const [pendingRemoval, setPendingRemoval] = useState<TeamMember | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data } = await api.get<Team>('/api/team');
      setTeam(data);
    } catch (err) {
      setError(asyncError(err, 'settings.team.loadError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const seatsLeft = team ? team.seatsTotal - team.seatsUsed : 0;

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || inviting) return;
    setInviting(true);
    setInviteError(null);
    setInvited(null);
    try {
      await api.post('/api/team/invitations', { email: email.trim() });
      setInvited(email.trim());
      setEmail('');
      await load();
    } catch (err) {
      setInviteError(asyncError(err, 'settings.team.inviteError'));
    } finally {
      setInviting(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    try {
      await api.delete(`/api/team/invitations/${id}`);
      await load();
    } catch (err) {
      setError(asyncError(err, 'settings.team.revokeError'));
    } finally {
      setBusy(false);
    }
  }

  async function removeMember() {
    if (!pendingRemoval) return;
    setBusy(true);
    try {
      await api.delete(`/api/team/members/${pendingRemoval.id}`);
      setPendingRemoval(null);
      await load();
    } catch (err) {
      setPendingRemoval(null);
      setError(asyncError(err, 'settings.team.removeError'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <p style={{ color: c.textMuted, fontSize: '0.9rem', margin: 0 }}>
          {t('settings.team.loading')}
        </p>
      </Card>
    );
  }

  if (!team) {
    return (
      <Card>
        <Alert tone="danger" title={t('settings.team.loadError')}>
          {error ? asyncErrorText(error, t) : null}
        </Alert>
      </Card>
    );
  }

  // Defaulted rather than trusted. This section renders inside the settings
  // page, so a response missing a list — an older API, a proxy returning
  // something else — would throw here and take every other setting on the
  // screen down with it, which is a bad trade for a list that can be empty.
  const members = team.members ?? [];
  const invitations = team.invitations ?? [];

  // A single-seat plan has no team, so the section is an upgrade prompt.
  //
  // The one exception is a studio still carrying *colleagues* from a plan it
  // used to be on: those are real accounts that can still sign in, and hiding
  // them would leave the owner unable to remove someone they can no longer see.
  //
  // A pending invitation is not such a case, which the first version of this
  // got wrong. It is not a person — accepting it is refused by the seat check
  // on the way in — so it is already inert, and it expires on its own. Keeping
  // the whole team manager on screen for a dead invitation is what made Starter
  // show "2 of 1 seats used" next to an invite form the API answers with 402.
  const singleSeat = seats <= 1;
  const extraMembers = members.length > 1;
  const deadInvites = invitations.filter((i) => i.status === 'PENDING');
  if (singleSeat && !extraMembers) {
    return (
      <Card>
        <EmptyState title={t('settings.team.upgradeTitle')} body={t('settings.team.upgradeBody')} />
        {/* Named rather than silently dropped: the owner sent it and would
            otherwise wonder where it went. Withdrawable here so it does not
            have to sit out its expiry. */}
        {deadInvites.length > 0 && team.canManage && (
          <div style={{ borderTop: `1px solid ${c.border}`, marginTop: 18, paddingTop: 14 }}>
            {deadInvites.map((i) => (
              <div
                key={i.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  fontSize: '0.85rem',
                  color: c.textMuted,
                }}
              >
                <span>{t('settings.team.inertInvite', { email: i.email })}</span>
                <Button variant="ghost" size="sm" onClick={() => void revoke(i.id)} disabled={busy}>
                  {t('settings.team.revoke')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  }

  // Settled invitations are worth showing — an owner who sees "revoked" knows
  // the seat came back, where a disappearing row reads as a bug — but they are
  // listed after the live ones and toned down.
  const liveInvites = invitations.filter((i) => i.status === 'PENDING');
  const settledInvites = invitations.filter((i) => i.status !== 'PENDING');

  return (
    <Card>
      {error && (
        <Alert tone="danger" style={{ marginBottom: 16 }}>
          {asyncErrorText(error, t)}
        </Alert>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <p style={{ margin: 0, fontSize: '0.88rem', color: c.textMuted }}>
          {t('settings.team.seatsUsed', {
            used: format.number(team.seatsUsed),
            total: format.number(team.seatsTotal),
          })}
        </p>
        {seatsLeft <= 0 && (
          <Badge tone={c.warningText} background={c.warningBg}>
            {t('settings.team.seatsFull')}
          </Badge>
        )}
      </div>

      <ul style={{ listStyle: 'none', margin: '0 0 4px', padding: 0 }}>
        {members.map((m) => (
          <li
            key={m.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 0',
              borderTop: `1px solid ${c.border}`,
            }}
          >
            <UserAvatar
              name={m.fullName ?? m.email}
              src={m.avatarUrl}
              size={34}
              background={theme === 'light' ? '#6366F1' : '#818CF8'}
              color="#fff"
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: c.text,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {m.fullName ?? m.email}
              </div>
              <div style={{ fontSize: '0.82rem', color: c.textMuted }}>{m.email}</div>
            </div>
            <Badge tone={m.staffRole === 'OWNER' ? c.primaryText : undefined}>
              {t(m.staffRole === 'OWNER' ? 'settings.team.roleOwner' : 'settings.team.roleMember')}
            </Badge>
            {/* The owner has no remove button, for anyone including themselves:
                the studio would be left with no account able to manage billing
                and nothing in the product could put one back. */}
            {team.canManage && m.staffRole !== 'OWNER' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPendingRemoval(m)}
                disabled={busy}
              >
                {t('settings.team.remove')}
              </Button>
            )}
          </li>
        ))}
      </ul>

      {liveInvites.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {liveInvites.map((i) => (
            <li
              key={i.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 0',
                borderTop: `1px solid ${c.border}`,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.9rem', color: c.text }}>{i.email}</div>
                <div style={{ fontSize: '0.82rem', color: c.textMuted }}>
                  {t('settings.team.invitedExpires', { date: format.dayMonth(i.expiresAt) })}
                </div>
              </div>
              <Badge tone={c.warningText} background={c.warningBg}>
                {t('settings.team.statusPending')}
              </Badge>
              {team.canManage && (
                <Button variant="ghost" size="sm" onClick={() => void revoke(i.id)} disabled={busy}>
                  {t('settings.team.revoke')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {members.length <= 1 && liveInvites.length === 0 && (
        <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: 18, marginTop: 4 }}>
          <EmptyState title={t('settings.team.emptyTitle')} body={t('settings.team.emptyBody')} />
        </div>
      )}

      {team.canManage && !singleSeat && (
        <form
          onSubmit={invite}
          style={{ borderTop: `1px solid ${c.border}`, paddingTop: 18, marginTop: 14 }}
        >
          <Field label={t('settings.team.inviteLabel')}>
            {(props) => (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Input
                  {...props}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('settings.team.invitePlaceholder')}
                  autoComplete="off"
                  style={{ flex: '1 1 220px' }}
                  disabled={seatsLeft <= 0}
                />
                <Button type="submit" busy={inviting} disabled={seatsLeft <= 0 || !email.trim()}>
                  {t('settings.team.invite')}
                </Button>
              </div>
            )}
          </Field>

          {seatsLeft <= 0 && (
            <Alert tone="info" style={{ marginTop: 12 }}>
              {t('settings.team.seatsFullHelp')}
            </Alert>
          )}
          {inviteError && (
            <Alert tone="danger" style={{ marginTop: 12 }}>
              {asyncErrorText(inviteError, t)}
            </Alert>
          )}
          {invited && (
            <Alert tone="success" style={{ marginTop: 12 }}>
              {t('settings.team.inviteSent', { email: invited })}
            </Alert>
          )}
        </form>
      )}

      {/* Over the limit after a downgrade, with real colleagues still in the
          studio. The invite form is gone — there is nothing to invite into —
          so this says what to do instead. */}
      {singleSeat && extraMembers && (
        <Alert tone="warning" style={{ marginTop: 16 }}>
          {t('settings.team.overLimit', { seats: format.number(seats) })}
        </Alert>
      )}

      {settledInvites.length > 0 && (
        <details style={{ marginTop: 18 }}>
          <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: c.textMuted }}>
            {t('settings.team.pastInvites')}
          </summary>
          <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0 }}>
            {settledInvites.map((i) => (
              <li
                key={i.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '8px 0',
                  fontSize: '0.85rem',
                  color: c.textMuted,
                }}
              >
                <span>{i.email}</span>
                <span>{t(`settings.team.status${titleCase(i.status)}` as never)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <ConfirmDialog
        open={pendingRemoval !== null}
        title={t('settings.team.removeTitle')}
        message={t('settings.team.removeBody', {
          name: pendingRemoval?.fullName ?? pendingRemoval?.email ?? '',
        })}
        confirmLabel={t('settings.team.remove')}
        tone="danger"
        theme={theme}
        busy={busy}
        onConfirm={() => void removeMember()}
        onCancel={() => setPendingRemoval(null)}
      />
    </Card>
  );
}

/** `ACCEPTED` → `Accepted`, to build the translation key for a status. */
function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
