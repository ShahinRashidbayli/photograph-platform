-- Leases for scheduled jobs, so exactly one instance runs each one.
--
-- Until now there were no scheduled jobs at all. The first one is gallery
-- retention (ADR-001), which deletes a client's wedding photos — and that is
-- precisely the job that must never run twice concurrently, on two Railway
-- replicas, racing each other through the same rows.
--
-- A lease rather than a mutex: an instance that is SIGKILLed mid-run cannot
-- release anything, so the lock has to expire on its own or the job stops
-- running forever and nobody notices until storage bills arrive.
CREATE TABLE scheduled_job_locks (
    name         VARCHAR(100) NOT NULL,
    -- Held until this instant. Acquisition is a single conditional upsert, so
    -- "is it free?" and "take it" cannot interleave between two instances.
    locked_until TIMESTAMPTZ  NOT NULL,
    -- Which instance holds it. Only the holder may release, so an instance
    -- that stalls past its lease cannot later release a lease a *different*
    -- instance has since acquired.
    locked_by    VARCHAR(200),
    locked_at    TIMESTAMPTZ,
    CONSTRAINT pk_scheduled_job_locks PRIMARY KEY (name)
);

-- Platform-level bookkeeping, not tenant data: no tenant_id, and deliberately
-- NOT under RLS. The jobs that take these leases run with no tenant bound, and
-- an RLS policy keyed on app.tenant_id would fail closed and make every lease
-- unacquirable.
GRANT SELECT, INSERT, UPDATE, DELETE ON scheduled_job_locks TO fotolio_app;

COMMENT ON TABLE scheduled_job_locks IS
    'Expiring leases held by scheduled jobs. See JobLock: acquisition is one '
    'conditional INSERT .. ON CONFLICT DO UPDATE .. WHERE locked_until < now(), '
    'which is atomic under the row lock ON CONFLICT takes.';
