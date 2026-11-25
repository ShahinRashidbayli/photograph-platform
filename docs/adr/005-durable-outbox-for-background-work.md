# 005 — Background work goes through a Postgres outbox, not a broker

**Status:** Accepted (2026-11-25) · **Implemented** for email by #58.
**Related:** ADR-002 (extract only on measured pressure), `docs/BUGS.md` FU-10,
FU-11, FU-12, `V39__outbox_jobs.sql`, `common/outbox/`

## Context

Email ran on an in-memory `@Async` pool. A deploy or crash dropped what was
queued, a provider 429/5xx lost the message with one `ERROR` line, and the
callers sent from inside their transaction, so a rolled-back write could still
send its email. Nothing listed failed or pending mail.

Volume is tens of emails per studio per day: under one message per second at
1,000 studios.

## Decision

1. **A hand-rolled outbox table and poller (option C).** One table,
   `outbox_jobs`, and a worker in `common/outbox`. The columns are what the
   acceptance criteria name: `status`, `attempts`, `next_run_at`,
   `expires_at`, `priority`, a unique `idempotency_key`, `tenant_id`.
   - *Rejected: Spring Modulith's event publication registry (A).* On Boot 3.4
     it is Modulith 1.3, which knows only "completed / not completed". Failed
     state and resubmission came in 2.0, which belongs to the Boot 4 line, and
     even 2.0 has no backoff, attempt limit, TTL, priority or key. We would
     write C as a wrapper anyway, on a table schema we don't own, with the
     serialised event (PII) in it and no `tenant_id`. Revisit after the Boot 4
     upgrade if every cross-module event needs delivery guarantees.
   - *Rejected: JobRunr (B).* A third framework with its own tables, job
     arguments serialised into them (PII again), and tenant context carried by
     hand.
   - *Rejected: Kafka / RabbitMQ.* See §5.
2. **The job is written in the caller's transaction.** `EmailService.queue`
   joins it. No commit means no job, and a committed job survives a crash. The
   domain-event listeners (`LeadNotificationService`, `AutoReplyService`,
   `InquiryNotificationService`, `ContractNotificationService`) are
   `@TransactionalEventListener(BEFORE_COMMIT)`, so the event path is atomic
   too. `LeadCreatedEvent` and `InquiryCreatedEvent` now carry `tenantId`
   (FU-12).
3. **The payload holds inputs, never a rendered email.** Each email is an
   `EmailRenderer` bean with a stable template name. The job stores the
   template, its parameters as JSON, and the recipient in `recipient_email`.
   The subject and body are rendered when the email is sent.
   - Sign-in codes, reset/verification/invitation tokens and gallery access
     tokens have to be stored, because they are the email. Those jobs get an
     `expires_at` equal to the credential's own lifetime.
   - Parameters are the data the call site already holds (names, ids, the
     lead's address). Re-loading every entity by id at send time would make
     `notification` depend on the services of five modules.
   - Retention: a delivered job is deleted at once. A `DEAD` job is deleted
     30 days after it died (`OutboxPurgeJob`, daily, `JobLock`).
     `OutboxEraser` deletes a studio's queued and dead jobs to or about a
     person (GDPR Art. 17).
4. **Worker.** Every replica polls the email queue each second
   (`EmailOutboxPoller`). A claim is one
   `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED) RETURNING`, so two
   replicas never take the same row. A claim holds a 5-minute lease, and a
   worker that dies mid-job leaves a row the next poll reclaims. A batch
   whose lease runs low releases its unstarted jobs rather than run them
   under a claim another replica may take, and a row that keeps killing its
   worker is parked `DEAD` by the claim once its attempts are used up.
   - Retries come after 1 min, 5 min, 30 min, 2 h and 12 h. The next failure
     is `DEAD`, with the exception class and provider status in `last_error`,
     never the message (BUG-014).
   - Priority comes from `EmailType`: auth emails (1), then
     `CONTRACT_SIGNED` and `GALLERY_EXPIRY` (3), then lead and inquiry mail (5).
   - An expired job is deleted without being sent.
   - The job's `tenant_id` is bound as `TenantContext` while the handler runs,
     so RLS applies to anything it reads.
   - Delivery is at least once. A worker that dies after the provider accepted
     the email but before the delete sends it again. The idempotency key stops
     the same email being queued twice while the first copy waits.
5. **No RLS on `outbox_jobs`, grants only**, like `scheduled_job_locks`
   (V21). The worker claims across tenants with none bound, and an
   `app.tenant_id` policy fails closed: it would see nothing. Isolation comes
   from binding `tenant_id` around each job.

## When a broker becomes the right call

Add one when a module is extracted into its own service (ADR-002 §3 triggers)
or an external consumer needs the same events. The change is then mechanical:
a relay reads `outbox_jobs` and publishes to the broker instead of handing the
row to an in-process handler. A broker without the outbox would still have the
dual-write problem.

## Consequences

- **FU-11: `CallerRunsPolicy` stays, for audit only.** Email no longer uses
  the `@Async` pool. The poller takes work at its own pace, so a mail backlog
  creates back-pressure in the table rather than on request threads. Only
  `AuditLogWriter` and thumbnails are left on the pool.
- Image derivatives (`DeliveryPhotoProcessor`, `ThumbnailService`) move in a
  separate PR, into the same table under their own `queue` with a
  low-parallelism worker. They are CPU-heavy and must not hold up a sign-in
  code. They are already queued after commit, so today they are lost only on
  a crash, and can be regenerated from the original.
- `AuditLogWriter` stays as it is. It should become a synchronous write in the
  same transaction, not a queue job: that is a separate follow-up (FU-14).
- No HTTP replay endpoint: no platform-admin role exists to protect one.
  Watch the gauges `outbox.jobs{status=dead}` (alert on > 0) and
  `outbox.jobs.oldest.age`. To replay a dead job once the cause is fixed:

  ```sql
  UPDATE outbox_jobs
     SET status = 'PENDING', attempts = 0, next_run_at = now(), last_error = NULL
   WHERE id = '<job id>' AND status = 'DEAD';
  ```

  Set `expires_at = NULL` too only if late delivery is still useful. Never do
  that for a sign-in code.
- Renaming a template or removing a parameter field breaks the rows queued
  before the deploy. Add fields freely; rename by keeping the old name until
  the queue has drained.
