-- Gallery retention (ADR-001) — the state a gallery moves through on its way
-- to being deleted, and the ledger proving the client was warned first.
--
-- `expires_at` has existed since V11 and nothing ever wrote it. The dashboard
-- already renders a countdown against it, so the model anticipated this; what
-- was missing was the value on write, the job, and — the actual point of
-- ADR-001 — the four guarantees that have to exist before anything is deleted.
--
-- Deleting a client's wedding photos is the most destructive thing this
-- product will ever do, and the failure lands on the photographer's
-- reputation. The columns below exist so that deletion is never a single
-- irreversible step: a gallery expires, loses access, keeps its bytes for a
-- grace period, and only then is purged.

ALTER TABLE galleries
    -- When retention starts counting. ADR-001 §2: measured from delivery, not
    -- from the booking or the event date.
    ADD COLUMN delivered_at    TIMESTAMPTZ,
    -- The window that was granted, captured at delivery. Stored rather than
    -- re-derived from the tenant's current plan because ADR-001 §4 is explicit
    -- that expires_at is set on write: resolving it lazily would mean a plan
    -- change silently rewrote the retention of galleries already delivered —
    -- a downgrade could retroactively expire a gallery that was live.
    ADD COLUMN retention_days  INTEGER,
    ADD COLUMN expiry_state    VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    -- Set when access is revoked. Bytes still exist at this point.
    ADD COLUMN soft_deleted_at TIMESTAMPTZ,
    -- Earliest moment the bytes may actually be destroyed. The gap between
    -- soft_deleted_at and this is the margin for OUR bugs (ADR-001 §4.3): a
    -- bad query that expires the wrong tenant has to be recoverable.
    ADD COLUMN purge_after     TIMESTAMPTZ,
    ADD COLUMN purged_at       TIMESTAMPTZ,
    ADD COLUMN extended_at     TIMESTAMPTZ,
    ADD COLUMN extension_count INTEGER     NOT NULL DEFAULT 0;

ALTER TABLE galleries
    ADD CONSTRAINT chk_galleries_expiry_state
        CHECK (expiry_state IN ('ACTIVE', 'EXPIRED', 'PURGED'));

-- Drives the job's three phases. Partial on ACTIVE because the sweep only ever
-- looks at live galleries for reminders and expiry, and that stays small even
-- as PURGED tombstones accumulate forever.
CREATE INDEX idx_galleries_active_expiry
    ON galleries (expires_at)
    WHERE expiry_state = 'ACTIVE';

CREATE INDEX idx_galleries_purge_due
    ON galleries (purge_after)
    WHERE expiry_state = 'EXPIRED';

-- ─────────────────────────────────────────
--  REMINDER LEDGER
-- ─────────────────────────────────────────
-- ADR-001 §4.1: the CLIENT must be warned, not just the photographer — a
-- client who never opens the dashboard sees nothing at all, and the photos
-- then vanish silently.
--
-- A ledger rather than a "last_reminder_sent" column, because the unique
-- constraint below is what makes the job idempotent: re-running the sweep, or
-- two instances overlapping past a lease, cannot send the same warning twice.
-- A client emailed three times in one morning about their wedding photos
-- expiring is its own kind of damage.
CREATE TABLE gallery_expiry_reminders (
    id          UUID        NOT NULL DEFAULT gen_random_uuid(),
    tenant_id   UUID        NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    gallery_id  UUID        NOT NULL REFERENCES galleries (id) ON DELETE CASCADE,
    -- How many days before expiry this warning was for (15 / 5 / 1). ADR-001
    -- §4.1 phrases these as days 45/55/59 of a 60-day window; expressing them
    -- as "days before expiry" generalises to Pro's year and Studio's two.
    days_before INTEGER     NOT NULL,
    sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_gallery_expiry_reminders PRIMARY KEY (id),
    CONSTRAINT uq_gallery_reminder UNIQUE (gallery_id, days_before)
);

CREATE INDEX idx_gallery_reminders_tenant ON gallery_expiry_reminders (tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON gallery_expiry_reminders TO fotolio_app;

ALTER TABLE gallery_expiry_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_expiry_reminders FORCE ROW LEVEL SECURITY;
CREATE POLICY gallery_expiry_reminders_tenant_isolation ON gallery_expiry_reminders
    FOR ALL TO fotolio_app
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- ─────────────────────────────────────────
--  BACKFILL
-- ─────────────────────────────────────────
-- Existing galleries were delivered under no retention promise at all, so they
-- are given a FULL window measured from now rather than from their creation
-- date. Backdating would expire live galleries the moment this deploys —
-- silently destroying photos whose owners were never told a deadline existed.
-- Same reasoning as V20's trial backfill, and the same answer: be generous
-- when the customer could not have known.
--
-- The day counts here duplicate ADR-001 §2 on purpose. A migration is a
-- historical record and must not depend on runtime configuration that may
-- have changed by the time it runs; the live source of truth is `app.plans`.
UPDATE galleries g
   SET delivered_at   = COALESCE(g.delivered_at, g.created_at),
       retention_days = CASE t.plan
                            WHEN 'PRO'    THEN 365
                            WHEN 'STUDIO' THEN 730
                            ELSE 60
                        END,
       expires_at     = now() + (CASE t.plan
                                     WHEN 'PRO'    THEN 365
                                     WHEN 'STUDIO' THEN 730
                                     ELSE 60
                                 END || ' days')::interval
  FROM tenants t
 WHERE t.id = g.tenant_id
   AND g.expires_at IS NULL;

COMMENT ON COLUMN galleries.expiry_state IS
    'ACTIVE (live) -> EXPIRED (access revoked, bytes retained during the grace '
    'period) -> PURGED (bytes gone, row kept as a tombstone so the client link '
    'can explain itself instead of 404ing). See GalleryRetentionService.';

COMMENT ON COLUMN galleries.expires_at IS
    'When the gallery stops being reachable. Written at delivery from the '
    'tenant plan''s retention window (ADR-001 §2) — never supplied by a client, '
    'and never recomputed at read time.';
