-- The durable outbox for work that runs after a request: email first (FU-10),
-- image derivatives later. See ADR-005.
--
-- A row is written in the same transaction as the business change it follows,
-- so a rolled-back write leaves no job behind and a committed one survives a
-- crash or deploy. OutboxWorker claims due rows with FOR UPDATE SKIP LOCKED,
-- which is what makes several API replicas safe without a lease per job.
CREATE TABLE outbox_jobs (
    id               UUID         NOT NULL DEFAULT gen_random_uuid(),
    -- Which worker drains this row. Email and image derivatives share the
    -- table but not a worker: derivatives are CPU-heavy and must not hold up a
    -- sign-in code.
    queue            VARCHAR(30)  NOT NULL,
    -- Which handler runs it, e.g. 'email'. A stable name, never a class name,
    -- so a refactor cannot strand rows that were written before it.
    kind             VARCHAR(60)  NOT NULL,
    -- Whose studio this concerns. The worker binds it as TenantContext before
    -- running the handler, so RLS applies to whatever the handler reads.
    tenant_id        UUID,
    -- What the handler needs, never a rendered email body (ADR-005 §3).
    payload          JSONB        NOT NULL,
    -- Who the job is addressed to, so a GDPR erasure is an indexed delete
    -- rather than a scan through JSON.
    recipient_email  VARCHAR(255),
    -- Lower runs first: a sign-in code before a lead alert.
    priority         SMALLINT     NOT NULL DEFAULT 5,
    status           VARCHAR(10)  NOT NULL DEFAULT 'PENDING',
    attempts         INT          NOT NULL DEFAULT 0,
    next_run_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    -- While RUNNING, the claim is held until this instant. A worker that dies
    -- mid-job leaves a RUNNING row whose lease runs out; the next poll takes it.
    locked_until     TIMESTAMPTZ,
    -- Past this, the job is dropped instead of run: a sign-in code that arrives
    -- after it stopped working is worse than none.
    expires_at       TIMESTAMPTZ,
    -- Enqueueing the same key twice keeps the first row. NULL for jobs with no
    -- natural key (each sign-in code is new work).
    idempotency_key  VARCHAR(200),
    -- Exception class and provider status only. Never a message: provider
    -- errors have echoed recipients and subjects back (BUG-014).
    last_error       VARCHAR(500),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_outbox_jobs PRIMARY KEY (id),
    CONSTRAINT ck_outbox_jobs_status CHECK (status IN ('PENDING', 'RUNNING', 'DEAD')),
    CONSTRAINT uq_outbox_jobs_idempotency_key UNIQUE (idempotency_key)
);

-- The poll: due rows of one queue, best priority first. DEAD rows never
-- match, so they stay out of the index.
CREATE INDEX idx_outbox_jobs_due
    ON outbox_jobs (queue, priority, next_run_at)
    WHERE status <> 'DEAD';

CREATE INDEX idx_outbox_jobs_recipient ON outbox_jobs (lower(recipient_email));

-- Platform-level, like scheduled_job_locks (V21): deliberately NOT under RLS.
-- The worker has to claim jobs across every tenant with no tenant bound, and
-- an app.tenant_id policy fails closed — it would see no rows at all. The
-- tenant_id column is what restores isolation, around each job.
GRANT SELECT, INSERT, UPDATE, DELETE ON outbox_jobs TO fotolio_app;

COMMENT ON TABLE outbox_jobs IS
    'Durable after-commit work (ADR-005). Succeeded rows are deleted at once; '
    'DEAD rows are purged after 30 days. No RLS: the worker reads across tenants '
    'and binds tenant_id per job.';
