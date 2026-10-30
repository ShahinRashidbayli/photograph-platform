-- Multiple photographers in one studio — the seats the Studio plan sells.
--
-- `users` could already hold more than one staff row per tenant: tenant_id is
-- on the row and uq_users_tenant_email only stops the same address twice. What
-- was missing is everything around it — who owns the studio, how a second
-- person gets in, and what stops a Starter tenant from having five of them.
--
-- ─────────────────────────────────────────
--  Why a second column and not a new `role`
-- ─────────────────────────────────────────
-- `users.role` answers "how does this account authenticate and which API
-- surface may it reach" — PHOTOGRAPHER and ADMIN are both staff and are
-- gated together everywhere (`hasAnyRole("PHOTOGRAPHER","ADMIN")`), CUSTOMER
-- is the magic-link side. Ownership is a different question asked of the same
-- row: two accounts can be identical to Spring Security and still differ on
-- whether one may cancel the subscription. Folding that into `role` would mean
-- every existing authority check had to learn two new values, and V23's
-- partial unique index on staff emails would need rewriting with them.

ALTER TABLE users ADD COLUMN staff_role VARCHAR(20);

-- The founder of each tenant. `tenants.owner_email` is globally UNIQUE
-- (uq_tenants_email) and is what the product has been treating as ownership
-- all along, so it is the only defensible source for the backfill.
UPDATE users u
SET staff_role = 'OWNER'
FROM tenants t
WHERE u.tenant_id = t.id
  AND u.role <> 'CUSTOMER'
  AND lower(u.email) = lower(t.owner_email);

-- Any other staff row predates seats and cannot be the founder.
UPDATE users
SET staff_role = 'MEMBER'
WHERE role <> 'CUSTOMER'
  AND staff_role IS NULL;

-- Staff always carry one of the two; customers never carry either. Written as
-- one constraint rather than a NOT NULL so the two halves cannot drift: a
-- customer row with staff_role = 'OWNER' would otherwise satisfy every check
-- individually and still be nonsense.
ALTER TABLE users ADD CONSTRAINT chk_users_staff_role CHECK (
    (role =  'CUSTOMER' AND staff_role IS NULL)
 OR (role <> 'CUSTOMER' AND staff_role IN ('OWNER', 'MEMBER'))
);

-- Exactly one owner per tenant. Ownership decides who may change the plan and
-- who may remove people, so two of them is not a lesser bug than none: it is
-- two accounts that can each lock the other out.
--
-- Transferring ownership therefore has to demote before it promotes, inside
-- one transaction. That is the intended cost — the alternative is discovering
-- the second owner from a support ticket.
CREATE UNIQUE INDEX uq_users_tenant_owner
    ON users (tenant_id)
    WHERE staff_role = 'OWNER';

-- ─────────────────────────────────────────
--  Invitations
-- ─────────────────────────────────────────
-- A pending seat. The row is the invitation, not the user: an invited person
-- has no `users` row until they accept, so a revoked invite leaves nothing
-- behind and a seat is only consumed once somebody actually holds it.
--
-- Same shape as the other one-time tokens in this schema (V6, V7, V9): the
-- plaintext goes in the email, only the SHA-256 hash is stored, so a database
-- compromise cannot be replayed into someone else's studio.
CREATE TABLE staff_invitations (
    id          UUID         NOT NULL DEFAULT gen_random_uuid(),
    tenant_id   UUID         NOT NULL,
    email       VARCHAR(320) NOT NULL,
    token_hash  VARCHAR(64)  NOT NULL,
    -- Who sent it, for the audit trail the team screen shows. ON DELETE SET
    -- NULL: removing the person who sent an invitation must not take the
    -- invitation — or, through a cascade, the colleague who accepted it.
    invited_by  UUID,
    expires_at  TIMESTAMPTZ  NOT NULL,
    accepted_at TIMESTAMPTZ,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT pk_staff_invitations        PRIMARY KEY (id),
    CONSTRAINT uq_staff_invitations_hash   UNIQUE (token_hash),
    CONSTRAINT fk_staff_invitations_tenant FOREIGN KEY (tenant_id)
        REFERENCES tenants (id) ON DELETE CASCADE,
    CONSTRAINT fk_staff_invitations_inviter FOREIGN KEY (invited_by)
        REFERENCES users (id) ON DELETE SET NULL,
    -- An invitation is pending, accepted or revoked — never both of the last
    -- two. Without this, re-revoking an accepted invite would silently read as
    -- "this seat was never taken" while the user row it created still exists.
    CONSTRAINT chk_staff_invitations_outcome CHECK (
        accepted_at IS NULL OR revoked_at IS NULL
    )
);

-- One live invitation per address per studio. Re-inviting somebody who already
-- has a pending invite should resend or replace it, not queue a second seat
-- claim against the same person — two valid tokens for one address means
-- revoking one leaves the other working.
CREATE UNIQUE INDEX uq_staff_invitations_pending
    ON staff_invitations (tenant_id, lower(email))
    WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- The team screen lists a tenant's invitations newest-first.
CREATE INDEX idx_staff_invitations_tenant
    ON staff_invitations (tenant_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON staff_invitations TO fotolio_app;

-- ─────────────────────────────────────────
--  No RLS policy here, deliberately
-- ─────────────────────────────────────────
-- The table carries tenant_id, so the absence of a policy looks like an
-- oversight next to V22's gallery_expiry_reminders. It is not.
--
-- RLS in this schema is enforced through `app.tenant_id`, set as the first
-- statement of a transaction by TenantRoutingDataSource — which requires the
-- request to already know which tenant it belongs to. Accepting an invitation
-- cannot: the visitor has no account, no session and no subdomain, and the
-- only thing they carry is the token. Resolving the tenant IS the query, so a
-- policy that demands the answer first would make the row unreadable to the
-- one flow that needs it.
--
-- That is why every other table on this side of authentication — users,
-- tenants, refresh_tokens, magic_link_tokens, password_reset_tokens,
-- email_verification_tokens — has RLS off too. They all run before a tenant
-- context exists.
--
-- Isolation is therefore the application's job here, and it is done the same
-- way the token tables do it: lookups are by the token's SHA-256 hash, which
-- is unguessable, and every tenant-scoped operation (listing, revoking,
-- removing) filters on the caller's own tenant_id in StaffInvitationService
-- rather than trusting an id from the request.
